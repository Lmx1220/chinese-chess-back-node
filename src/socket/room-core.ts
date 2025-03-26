import {firstBlackMap, firstRedMap} from "../utils/map-res";
import UserDao from "../dao/user-dao";
import RoomUtils from "../utils/room-utils";
import DateUtils from "../utils/date-utils";
import {
    APP,
    BATTLE,
    BOOLEAN,
    DATA_CHANGE_TYPE,
    ONLINE_DATA_TYPE,
    PAGE_STATUS,
    REDIS_KEYS,
    ROOM_FLOW_TYPE,
    ROOM_STATUS,
    USER_STATUS
} from "../configs/enums";
import SocketUtils from "../utils/socket-utils";
import CryptorUtils from "../utils/cryptor-utils";
import BattleDao from "../dao/battle-dao";
import BattleHistoryDao from "../dao/battle-history-dao";
import UserStateDao from "../dao/user-state-dao";
import BattleUserDao from "../dao/battle-user-dao";
import ConstUtils from "../utils/const-utils";
import {Transaction} from "../aop/transaction-aop";
import {CatchException} from "../aop/exception-aop";
import RoomFlowDao from "../dao/room-flow-dao";
import OnlineUtils from "../utils/online-utils";
import {Log} from "../aop/log-aop";
import RedisUtils from "../utils/redis-utils";
import DataResp from "../model/data-resp";
import SessionUtils from "../utils/session-utils";
import moment from "moment";
import UserStateDo from "../model/do/user-state-do";

const roomUtils = new RoomUtils();
const dateUtils = new DateUtils();
const socketUtils = new SocketUtils();
const constUtils = new ConstUtils();
const redisUtils = new RedisUtils();
const sessionUtils = new SessionUtils();
const onlineUtils = new OnlineUtils();

/**
 * 房间服务实现
 */
class RoomServiceImpl {

    /**
     * 为用户分配房间
     * @param userId
     * @param oldRoomIds
     */
    @CatchException
    @Log()
    async distributionRoomImpl(userId: string, oldRoomIds: string[]): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});
        log.info(`用户[${userId}]请求分配的房间，历史分配过的有：`, oldRoomIds);
        // 把用户被踢的那些房间号计入不能匹配列表
        const roomIds: string[] = await RoomFlowDao.builder().getKickRoomIdsBy(userId, BATTLE.KICK_LIMIT_SECONDS);
        // 处理NPE
        if(!oldRoomIds) {
            oldRoomIds = [];
        }
        oldRoomIds.push(...roomIds);
        log.info(`用户[${userId}]被踢的房间列表有：`, roomIds);

        // 优先从数据库查询数据进行分配
        const rows: any = await UserStateDao.builder().queryValidRooms(userId, oldRoomIds, ROOM_STATUS.WAIT);
        if (rows.length === 0) {
            log.info(`从数据库中未检索到可分配的房间, 开始自由分配`);
            const tryRoomIds = [];
            // 录入已经分配过的房间
            tryRoomIds.push(...oldRoomIds);

            for (let i = 0; i < BATTLE.MAX_ROOM; ++i) {
                const roomId = Math.floor(Math.random() * BATTLE.MAX_ROOM) + 1;
                if (!tryRoomIds.some(roomIdItem => roomIdItem === roomId)) {
                    tryRoomIds.push(roomId);
                    // 判断数据库中是否有该房间且房间的状态是否可加入
                    const rows: any = await UserStateDao.builder().select({roomId: String(roomId)});
                    if (rows.length === 0 || rows[0].roomStatus === ROOM_STATUS.WAIT) {
                        // 记录房间号
                        log.info(`为用户[${userId}]分配的房间号为[${roomId}]`);
                        return DataResp.success().setData(roomId);
                    }
                }
            }
            log.info(`已遍历完所有可分配的房间，无法为其[${userId}]进行分配(配额不够)，配额为: ${BATTLE.MAX_ROOM}`);
            return DataResp.fail('服务器爆满，请稍候再试');
        } else {
            // 随机分配一间
            const userState = rows[Math.floor(Math.random() * rows.length)];
            log.info(`为用户[${userId}]分配的房间号为[${userState.roomId}](DB)`);
            return DataResp.success().setData(userState.roomId);
        }
    }

    /**
     * 加入房间核心逻辑
     * @param socket
     * @param userId
     * @param joinType
     * @param roomId
     * @param oldRoomIds
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async joinRoomImpl(socket: any, userId: string, joinType: string, roomId: string, oldRoomIds: string[]): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});
        // 检查用户是否在对战
        const isInBattle = await BattleDao.builder().checkUserInBattle(userId);
        if (isInBattle) {
            await sessionUtils.inBattleRecover(socket, userId, roomId);
            log.info(`用户[${userId}]正在对战中`);
            return DataResp.fail('您正在对局中');
        }
        // 查询游离信息
        const userState = await UserStateDao.builder().selectOne({userId});

        // 检查用户是否已分配过房间，若分配过就先退出(当前所在的房间和主动加入的房间一致时不离房)
        if (userState.roomId && userState.roomId !== roomId) {
            log.info(`用户[${userId}]正在房间[${userState.roomId}]中...`);
            await roomUtils.leaveRoom(userId, userState.roomId);
        }

        const joinRoomStatus = await roomUtils.joinRoom(userId, roomId, joinType);
        if (joinRoomStatus) {
            // 加入房间
            socket.join([onlineUtils.DEFAULT_ROOM_ID, roomId]);
            // 下发房间数据
            await roomUtils.sendRoomData(userId, roomId);
            // 下发在线用户数据
            await onlineUtils.sendOnlineUserList(socket, userId);

            log.info(`[${userId}]加入[${roomId}]号房间`);
            return DataResp.success('加入房间成功').setData({roomId});
        } else {
            socket.join([onlineUtils.DEFAULT_ROOM_ID]);
            return DataResp.fail('房间已满');
        }
    }

    /**
     * 加入受邀请的房间
     * @param socket
     * @param userId
     * @param joinType
     * @param inviteId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async joinInviteRoomImpl(socket: any, userId: string, joinType: string, inviteId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});

        const inviteFlowRedisKey = `${REDIS_KEYS.INVITE_USER_KEY}:${inviteId}`;
        const inviteDetailJsonStr = await redisUtils.getStr(inviteFlowRedisKey);

        // 查询对应的邀请信息
        if (!inviteDetailJsonStr) {
            log.info(`邀请id[${inviteId}]对应的数据不存在`);
            return DataResp.fail('邀请已过期');
        }
        const inviteDetail = JSON.parse(inviteDetailJsonStr);
        const {userId: inviteUserId, roomId, lockPass} = inviteDetail;

        // 检查用户是否还在房间中
        const userStateRows: any = await UserStateDao.builder().select({userId: inviteUserId, roomId});
        if (!userStateRows.length) {
            log.info(`邀请id[${inviteId}]要加入的房间[${roomId}]，其信息已被更新`);
            return DataResp.fail('邀请已过期');
        }

        // 进房预查询
        const userState = await UserStateDao.builder().selectOne({userId});

        if (userState.roomId) {
            log.info(`检测到用户[${userId}]存在旧房间：${userState.roomId}，游离数据为：`, userState);
            if (userState.roomId === roomId) {
                return DataResp.fail('您已进入该房间');
            } else {
                // 因为存在旧房间，需要离开旧房间，为保证能加入新房间，做一遍预查询
                const waitJoinRoomUserList: any = await UserStateDao.builder().getRoomData(roomId);
                if (waitJoinRoomUserList.length < BATTLE.ROOM_MAX_BATTLE_USER_COUNT) {
                    log.info(`房间[${roomId}]人数正常，允许离开旧房间`);
                    await roomUtils.leaveRoom(userId, userState.roomId);
                }
            }
        }

        // 加入房间
        const joinRoomStatus = await roomUtils.joinRoom(userId, roomId, joinType);
        if (joinRoomStatus) {
            // 加入房间
            socket.join([onlineUtils.DEFAULT_ROOM_ID, roomId]);
            log.info(`[${userId}]加入[${roomId}]号房间`);
            await roomUtils.sendRoomData(userId, roomId);
            return DataResp.success();
        }
        return DataResp.fail('房间已满');
    }

    /**
     * 玩家进行准备
     * @param socket
     * @param userId
     * @param roomId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async userReadyImpl(socket: any, userId: string, roomId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});

        const userState = await UserStateDao.builder().selectOne({userId});
        log.info(`[${userId}]所对应的用户信息为:`, userState);
        if (userState?.isReady) {
            log.info(`[${userId}]所在的房间:[${roomId}]已进行准备，本次请求取消`);
            return DataResp.fail('您已准备');
        } else if (userState?.roomId !== roomId) {
            log.warn(`[${userId}]所在的房间:[${roomId}]与游离数据中的房间号[${userState?.roomId}]不一致`);
            return DataResp.fail('房间信息错误');
        }

        await UserStateDao.builder().updateSelective({isReady: true}, {userId});
        log.info(`我方[${userId}]已准备，房间:[${roomId}]`);

        // 判断房间内是否有用户
        const room: any = await UserStateDao.builder().getRoomData(roomId);
        log.info(`房间[${roomId}]数据为:`, room);
        const user = room.find((user: any) => user.userId === userId);
        const enemy = room.find((user: any) => user.userId !== userId);

        if (!user) {
            log.warn(`[${userId}]无法获取房间[${roomId}]的数据`);
            return DataResp.fail('您已不在房间中');
        }

        if (enemy) {
            // 判断是否可以进行对局
            if (enemy.isReady) {
                // 保存相关数据
                const playOne = {
                    ...user,
                    stepCount: 0,
                    isRedMove: true,
                    historyMoveStep: [],
                    gameFen: enemy.first ? firstBlackMap : firstRedMap,
                    stepTime: BATTLE.STEP_TIME_SECONDS,
                    allTime: BATTLE.TOTAL_TIME_SECONDS,
                    basicStepTime: BATTLE.STEP_TIME_SECONDS,
                    basicAllTime: BATTLE.TOTAL_TIME_SECONDS,
                    readSeconds: BATTLE.READ_SECONDS,
                };
                const playTwo = {
                    ...enemy,
                    stepCount: 0,
                    isRedMove: true,
                    historyMoveStep: [],
                    gameFen: enemy.first ? firstRedMap : firstBlackMap,
                    stepTime: BATTLE.STEP_TIME_SECONDS,
                    allTime: BATTLE.TOTAL_TIME_SECONDS,
                    basicStepTime: BATTLE.STEP_TIME_SECONDS,
                    basicAllTime: BATTLE.TOTAL_TIME_SECONDS,
                    readSeconds: BATTLE.READ_SECONDS,
                };
                // 保存棋盘数据，不需要区分先后方
                const saveBoardResp: any = await this.saveBoardData(roomId, playOne, playTwo);
                log.debug(`创建对局返回的数据为：`, saveBoardResp);
                if (!saveBoardResp.result) {
                    log.info(`[${userId}]所在的房间:[${roomId}]无法创建对局(可能已创建)，本次请求取消`);
                    return DataResp.success();
                }
                log.info(`匹配成功，双方数据为:`, playOne, playTwo);
            } else {
                log.info(`[${userId}]已准备但房间[${roomId}]中的敌对方未准备`);
            }
        } else {
            log.info(`[${userId}]已准备但房间[${roomId}]无敌对方`);
        }

        // 下发房间数据
        await roomUtils.sendRoomData(userId, roomId);
        log.info(`房间[${roomId}]消息通知发送完毕`);

        // 通知客户端
        return DataResp.success(`我方已准备通知`);
    }

    /**
     * 玩家发起换桌
     * @param socket
     * @param userId
     * @param roomId 当前所在的桌号
     * @param joinType 房间加入类型
     * @param oldRoomIds 旧房间号列表
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async swapDeskImpl(socket: any, userId: string, roomId: string, joinType: string, oldRoomIds: string[]): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});
        // 检查用户是否在对战
        const isInBattle = await BattleDao.builder().checkUserInBattle(userId);
        if (isInBattle) {
            await sessionUtils.inBattleRecover(socket, userId, roomId);
            log.info(`用户[${userId}]正在对战中`);
            return DataResp.success('您正在对局中');
        }

        // 分配房间前，先离开旧房间
        await roomUtils.leaveRoom(userId, roomId);
        socket.leave(roomId);

        // 分配新房间
        const dataResp: DataResp<any> = await this.distributionRoomImpl(userId, oldRoomIds);
        if (!dataResp.isSuccess()) {
            return dataResp;
        }
        const newRoomId = dataResp.getData();
        // 加入该房间
        const joinRoomStatus = await roomUtils.joinRoom(userId, newRoomId, joinType);
        if (joinRoomStatus) {
            // 加入房间
            socket.join([onlineUtils.DEFAULT_ROOM_ID, newRoomId]);

            log.info(`[${userId}]加入[${newRoomId}]号房间`);
            // 下发当前房间的数据和旧房间的数据
            await roomUtils.sendRoomData(userId, newRoomId);
            await roomUtils.sendRoomData(userId, roomId);
            return DataResp.success('加入房间成功').setData({roomId: newRoomId});
        }
        // 加入失败，恢复旧房间
        socket.join([onlineUtils.DEFAULT_ROOM_ID, roomId]);
        return DataResp.fail('房间已满');
    }

    /**
     * 邀请用户
     * @param socket
     * @param userId
     * @param roomId
     * @param inviteUserId 被邀请人
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async inviteUserImpl(socket: any, userId: string, roomId: string, inviteUserId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});
        // 短时间不能重复邀请
        const shortTimeRepeatInviteRedisKey = `${REDIS_KEYS.INVITE_USER_KEY}:${userId}:${inviteUserId}`;

        // 校验缓存中是否有邀请记录(短时间内禁止重复邀请)
        const redisInviteData = await redisUtils.getStr(shortTimeRepeatInviteRedisKey);
        if (redisInviteData) {
            const {inviteCreateUnix} = JSON.parse(redisInviteData);
            const seconds = dateUtils.dateDiffSeconds(dateUtils.strToDate(inviteCreateUnix), new Date());
            return DataResp.fail(`请在${APP.INVITE_LIMIT_SECONDS - seconds}秒后操作`);
        }
        // 被邀请方游离数据
        const inviteUserState = await UserStateDao.builder().selectOne({userId: inviteUserId});
        if (!inviteUserState) {
            log.info(`被邀请的用户[${inviteUserId}]无游离数据`);
            return DataResp.fail(`邀请用户不存在`);
        }
        const inviteId = constUtils.getRandomId(32, 10);
        log.info(`用户[${userId}]邀请[${inviteUserId}]时，生成的邀请id为：[${inviteId}]`);

        // 当前用户的房间锁等信息
        const userState = await UserStateDao.builder().selectOne({userId});

        // 创建缓存数据
        const inviteFlowRedisKey = `${REDIS_KEYS.INVITE_USER_KEY}:${inviteId}`;
        await redisUtils.setStr(inviteFlowRedisKey, JSON.stringify({
            inviteId: inviteId,
            userId: userId,
            inviteUserId: inviteUserId,
            roomId: roomId,
            lockPass: userState.lockPass
        }), APP.INVITE_LIMIT_SECONDS * 1000);

        // 创建Redis数据
        await redisUtils.setStr(shortTimeRepeatInviteRedisKey,
            JSON.stringify({inviteCreateUnix: Date.now()}),
            APP.INVITE_LIMIT_SECONDS * 1000);

        // 邀请人的用户信息
        const user: any = await UserDao.builder().selectOne({userId});
        // 向对方发送邀请
        const inviteSocket = socketUtils.getSocketBy(inviteUserState.token);
        inviteSocket?.emit('inviteUserRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '邀请参与对局',
            data: {
                // 邀请编号
                inviteId: inviteId,
                // 过期时间
                expiredTimeUnix: moment().add(APP.INVITE_LIMIT_SECONDS, 'seconds').toDate().getTime(),
                // 邀请人用户详情
                userDetail: {
                    userId: userId,
                    roomId: roomId,
                    iconUrl: user.iconUrl,
                    userName: user.userName,
                    score: user.score,
                    // 胜率
                    sucPercentage: user.pkTotalCount > 0 ? Math.floor((user.pkWinCount / user.pkTotalCount) * 100) : 0
                },
            }
        }));
        return DataResp.success(`已发送邀请`);
    }

    /**
     * 被邀用户结果响应
     * @param socket
     * @param userId
     * @param inviteId
     * @param result 结果：agree / reject
     * @param rejectDesc 当被拒绝时，此字段有值
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async inviteUserResultImpl(socket: any, userId: string, inviteId: string, result: string, rejectDesc: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});

        const inviteFlowRedisKey = `${REDIS_KEYS.INVITE_USER_KEY}:${inviteId}`;
        const inviteDetailJsonStr = await redisUtils.getStr(inviteFlowRedisKey);
        if (!inviteDetailJsonStr) {
            log.info(`邀请id[${inviteId}]查询到的邀请信息为空`);
            return DataResp.fail(`邀请已过期`);
        }
        const inviteDetail = JSON.parse(inviteDetailJsonStr);

        // 更新处理结果
        log.info(`邀请id[${inviteId}]对应处理结果为：${result}, 拒绝原因(如果有)：${rejectDesc}`);

        // 若是拒绝的话，发送消息给邀请人
        if (BOOLEAN.REJECT === result) {
            const inviteUserState = await UserStateDao.builder().selectOne({userId: inviteDetail.userId});
            if (inviteUserState) {
                // 查询邀请人(此处注意是邀请人)
                const inviteUser: any = await UserDao.builder().selectOne({userId});
                // 发送消息通知
                const inviteSocket = socketUtils.getSocketBy(inviteUserState.token);
                inviteSocket?.emit('inviteUserResultRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: '对方处理了邀请请求',
                    data: {
                        userId,
                        result,
                        userName: inviteUser.userName,
                        // 拒绝理由
                        rejectDesc: rejectDesc,
                    }
                }));
            } else {
                log.info(`邀请人[${inviteDetail.userId}]已下线`);
            }
        }
        return DataResp.success(`处理了邀请请求`);
    }

    /**
     * 离开房间核心逻辑
     * @param socket
     * @param userId
     * @param roomId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async leaveRoomImpl(socket: any, userId: string, roomId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});

        log.info(`[${userId}]请求离开房间[${roomId}]`);
        // 检查用户是否正在对局
        const isInBattle = await BattleDao.builder().checkUserInBattle(userId);
        if (isInBattle) {
            await sessionUtils.inBattleRecover(socket, userId, roomId);
            return DataResp.fail(`已在对局中`);
        } else {
            // 调用离开房间的公共方法
            await roomUtils.leaveRoom(userId, roomId);

            // 离开系统为它分配的房间
            socket.leave(roomId);
            // 通知客户端逻辑处理完成
            return DataResp.success(`已离开房间`);
        }
    }


    /**
     * 双方都准备后，保存棋盘信息
     * @param roomId
     * @param user
     * @param enemy
     */
    @CatchException
    @Log()
    async saveBoardData(roomId: string, user: any, enemy: any) {
        const log = global.logUtils.getArgsLogger(arguments, {userId: user.userId, roomId});

        log.info(`开始校验房间:[${roomId}]是否为重复创建对局`);
        // 检测是否已创建过对战
        const count: number = await BattleDao.builder().countCreatedBattleByRoomId(roomId);
        log.info(`房间:[${roomId}]已创建的对局有: [${count}]条`);
        if (count > 0) {
            log.info(`房间:[${roomId}]已存在对战数据，已停止重复创建对局`);
            return {
                result: false,
                battleId: null,
            }
        }

        /** === 对手已准备，更新双方信息为匹配成功 === */
        await UserStateDao.builder().updateSelective({roomStatus: ROOM_STATUS.MATCH_SUCCESS}, {userId: user.userId});
        await UserStateDao.builder().updateSelective({roomStatus: ROOM_STATUS.MATCH_SUCCESS}, {userId: enemy.userId});
        // 通知房间内的所有人匹配成功
        global.socketIO.to(roomId).emit('matchSuccessRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '匹配成功',
        }));

        /** === 创建对战数据 === */
        const battleId = constUtils.getRandomId(32, 10);
        await BattleDao.builder().insertSelective({
            id: battleId,
            roomId,
            roomStatus: ROOM_STATUS.BATTLE,
            currIsRedMove: true
        })

        /** === 创建对战用户数据 === */
        // 自己的数据
        await BattleUserDao.builder().insertSelective({
            battleId,
            userId: user.userId,
            userName: user.userName,
            enemyId: enemy.userId,
            enemyName: enemy.userName,
            roomId,
            first: user.first,
            moveChessTime: new Date()
        })
        // 对方的数据
        await BattleUserDao.builder().insertSelective({
            battleId,
            userId: enemy.userId,
            userName: enemy.userName,
            enemyId: user.userId,
            enemyName: user.userName,
            roomId,
            first: enemy.first,
            moveChessTime: new Date()
        })

        /** === 创建对战历史步骤数据 === */
        // 自己的数据
        await BattleHistoryDao.builder().insertSelective({
            battleId,
            userId: user.userId,
            stepExplain: '',
            gameFen: user.gameFen,
            isRedMove: user.isRedMove,
            stepCount: user.stepCount,
            thinkTime: null,
            lastSrcChess: null,
            lastTargetChess: null,
            srcBoxChess: JSON.stringify({show: false}),
            targetBoxChess: JSON.stringify({show: false}),
            allTime: user.allTime,
            stepTime: user.stepTime
        })
        // 对方的数据
        await BattleHistoryDao.builder().insertSelective({
            battleId,
            userId: enemy.userId,
            stepExplain: '',
            gameFen: enemy.gameFen,
            isRedMove: enemy.isRedMove,
            stepCount: enemy.stepCount,
            thinkTime: null,
            lastSrcChess: null,
            lastTargetChess: null,
            srcBoxChess: JSON.stringify({show: false}),
            targetBoxChess: JSON.stringify({show: false}),
            allTime: enemy.allTime,
            stepTime: enemy.stepTime
        })

        /** === 更新游戏游离表中的数据 === */
        const  actionTime = new Date()
        await UserStateDao.builder().updateSelective({
            battleId,
            userStatus: USER_STATUS.BATTLE,
            userPage: PAGE_STATUS.BOARD,
            roomStatus: ROOM_STATUS.BATTLE,
            actionTime
        }, {userId: user.userId});

        await UserStateDao.builder().updateSelective({
            battleId,
            userStatus: USER_STATUS.BATTLE,
            userPage: PAGE_STATUS.BOARD,
            roomStatus: ROOM_STATUS.BATTLE,
            actionTime
        }, {userId: enemy.userId});

        /** === 创建该对战房间的倒计时数据 === */
        // await global.battleTimeJob.createBattleUserTime(battleId);

        await onlineUtils.updateOnlineCount({
            changeUserIds: [user.userId, enemy.userId],
            number: 1,
            dataType: ONLINE_DATA_TYPE.BATTLE,
            changeType: DATA_CHANGE_TYPE.ADDED,
        })

        // 通知可以进入对战
        global.socketIO.to(roomId).emit('allowInBattleApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '允许进入对局',
            data: {
                // 将双方信息返回给客户端（这里不区分敌我方，因为有可能是对手方准备触发的数据）
                playOne: user,
                playTwo: enemy,
                battleId: battleId
            },
        }));

        log.info(`房间:[${roomId}]对局已完成创建`);
        return {
            result: true,
            battleId: battleId,
        }
    };


    /**
     * 桌子列表查询
     * @param socket
     * @param userId
     * @param bindRoomLocation 是否按当前用户所在的房间位置进行分页查询
     * @param pageNum
     * @param pageSize
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async roomListImpl(socket: any, userId: string, bindRoomLocation: boolean, pageNum: number, pageSize: number): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});

        log.info(`开始为用户[${userId}]查询桌子列表`);
        // 绑定用户所在的房间时，按房间号重新分页
        let roomId = null;
        if (bindRoomLocation) {
            // 查询用户游离数据，并获取房间号
            const userState = await UserStateDao.builder().selectOne({userId});
            log.info(`用户[${userId}]的游离数据为：`, userState);
            if (userState) {
                roomId = userState.roomId;
                if (roomId) {
                    // 当用户存在某个房间号时，根据用户所在的房间号查询分页数据
                    pageNum = Math.ceil(Number(roomId) / pageSize);
                }
            }
        }
        // 查询桌子数据
        const pageList: any = await UserStateDao.builder().getRoomListByPage(userId, pageNum, pageSize);
        const {dataTotal, list} = pageList;
        log.info(`[${userId}]请求桌子列表，共[${list.length}]条数据`);
        return DataResp.success('获取桌子列表')
            .setData({
                list: list,
                pageSize: pageSize,
                pageNum: pageNum,
                dataTotal: dataTotal,
                roomId: roomId,
            })
    }


    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async kickUserImpl(socket: any, userId: string, kickUserId: string, roomId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});
        const userStateRows: UserStateDo[] = await UserStateDao.builder().select({userId: kickUserId, roomId});
        if (!userStateRows || userStateRows.length === 0) {
            log.info(`无法查询到用户游离数据，用户账号[${kickUserId}],房间[${roomId}],游离数据为:`, userStateRows)
            return DataResp.fail('用户数据错误');
        } else {
            const [userState] = userStateRows;
            const {token, disconnectTime} = userState;
            log.info(`开始踢出房间[${roomId}]中的[${kickUserId}]`);
            await roomUtils.leaveRoom(kickUserId, roomId);

            log.info(`开始发送房间[${roomId}]，用户[${kickUserId}]的踢出提醒信息, token: ${token}`);
            // 提示此用户被踢出房间
            const kickSocket = socketUtils.getSocketBy(token);
            // 通知对方被踢了
            kickSocket?.emit('kickUserRespApi', CryptorUtils.encrypt({
                code: 'success',
                msg: '您被踢出了房间',
                data: {
                    userId: kickUserId,
                    roomId: roomId
                }
            }));
            // 之后离开房间
            kickSocket?.leave(roomId);

            // 如果用户断开了，额外缓存一条流水，如果用户在缓存有效期内恢复，则可以收到被踢的提醒
            if(disconnectTime) {
                const kickOutOfRoomRedisKey = `${REDIS_KEYS.USER_KICK_ROOM_KEY}:${kickUserId}`;
                const kickOutOfRoomExpireTime = BATTLE.DISCONNECT_TIME_SECONDS * 1000;
                await redisUtils.setStr(kickOutOfRoomRedisKey, JSON.stringify({roomId, kickUserId}), kickOutOfRoomExpireTime);
            }

            // 记录踢人流水
            await RoomFlowDao.builder().insertSelective({
                userId,
                roomId,
                enemyId: kickUserId,
                type: ROOM_FLOW_TYPE.KICK,
                value: null,
            })

            // 通知我方操作已完成
            return DataResp.success('踢出用户操作成功');
        }
    }

}

export default RoomServiceImpl;