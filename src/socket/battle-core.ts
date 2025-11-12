import UserDao from '../dao/user-dao';
import RoomUtils from '../utils/room-utils';
import BattleUtils from '../utils/battle-utils';
import BoardUtils from '../utils/board-utils';
import {
    APP, BATTLE,
    // BATTLE,
    BATTLE_FLOW_TYPE,
    BOOLEAN,
    DATA_CHANGE_TYPE,
    GAME_OVER_TYPE,
    ONLINE_DATA_TYPE,
    PAGE_STATUS,
    ROOM_STATUS,
    USER_STATUS
} from '../configs/enums';
import CryptorUtils from '../utils/cryptor-utils';
import BattleChatDao from '../dao/battle-chat-dao';
import BattleDao from '../dao/battle-dao';
import BattleHistoryDao from '../dao/battle-history-dao';
import BattleFlowDao from '../dao/battle-flow-dao';
import UserStateDao from '../dao/user-state-dao';
import BattleUserDao from '../dao/battle-user-dao';
import ConstUtils from "../utils/const-utils";
import {Transaction} from '../aop/transaction-aop';
import {CatchException} from '../aop/exception-aop';
import FenUtils from '../utils/fen-utils';
import LongFightIng from '../utils/long-fighting';
import OnlineUtils from '../utils/online-utils';
import {Log} from '../aop/log-aop';
import CheckWin from '../utils/check-win';
import DataResp from '../model/data-resp';
import ShareDao from '../dao/share-dao';
import SessionUtils from '../utils/session-utils';
import UserStateDo from '../model/do/user-state-do';
import BattleHistoryDo from '../model/do/battle-history-do';

const roomUtils = new RoomUtils();
const battleUtils = new BattleUtils();
const boardUtils = new BoardUtils();
const constUtils = new ConstUtils();
const checkWin = new CheckWin();
const longFighting = new LongFightIng();
const sessionUtils = new SessionUtils();
const onlineUtils = new OnlineUtils();

/**
 * 对局，观战，复盘核心逻辑
 */
class BattleServiceImpl {

    /**
     * 获取观战列表核心逻辑
     * @param socket
     * @param userId
     * @param pageNum
     * @param pageSize
     */
    @CatchException
    @Log()
    async watchListImpl(socket: any, userId: string, pageNum: number, pageSize: number): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});

        // 分页获取观战列表
        const allWatchList = await BattleUserDao.builder().allWatchListByPage(pageNum, pageSize);
        const {dataTotal, list} = allWatchList;
        log.info(`请求了观战列表，共[${list.length}]条数据`);
        return DataResp.success('获取观战列表')
            .setData({
                list: list,
                pageSize: pageSize,
                pageNum: pageNum,
                dataTotal: dataTotal,
            });
    }

    /**
     * 加入观战房间核心逻辑
     * @param socket
     * @param userId
     * @param roomId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async joinWatchImpl(socket: any, userId: string, roomId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});
        // 检查用户是否在对战
        const isInBattle = await BattleDao.builder().checkUserInBattle(userId);
        if (isInBattle) {
            await sessionUtils.inBattleRecover(socket, userId, roomId);
            log.info(`[${userId}]正在战斗中`);
            return DataResp.success('您正在对局中');
        }

        const battleData: any = await BattleDao.builder().select({roomId, roomStatus: ROOM_STATUS.BATTLE});
        log.info(`[${roomId}]号房间数据为(仅对局)信息`, battleData);
        if (battleData.length === 0) {
            log.info(`[${roomId}]号房间对局已经结束`);
            return DataResp.fail('对局已经结束');
        } else {
            const [battle] = battleData;
            const userState: UserStateDo = await UserStateDao.builder().selectOne({userId});
            await UserStateDao.builder().updateSelective({
                battleId: battle.id,
                userStatus: USER_STATUS.WATCH,
                userPage: PAGE_STATUS.WATCH,
                roomId,
                actionTime: new Date(),
                userId: userId,
            }, {userId});
            log.info(`[${roomId}]号房间数据已变更`);

            // 下发对战数据
            const sendResult: boolean = await battleUtils.sendBattleData(userId, battle.id);
            if (sendResult) {
                // 加入房间 (socket)
                socket.join(roomId);

                const currUser: any = await UserDao.builder().selectOne({userId});
                // 发生加入观战通知
                socket.to(roomId).emit('watchNotifyRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: `(${userId})加入观战`,
                    data: {
                        action: DATA_CHANGE_TYPE.ADDED,
                        watchUserList: [{userId: currUser.userId, userName: currUser.userName}],
                    },
                }));
                // 在线数据累计
                await onlineUtils.updateOnlineCount({
                    changeUserIds: [userId],
                    number: userState.roomId === roomId ? 0 : 1,
                    dataType: ONLINE_DATA_TYPE.IN_ROOM,
                    changeType: DATA_CHANGE_TYPE.ADDED,
                });
                log.info(`[${userId}]加入了[${roomId}]号房间`);
            } else {
                log.info(`[${roomId}]号房间的观战数据无法被获取`);
                return DataResp.fail('无法获取到对局');
            }
        }
        return DataResp.success();
    }

    /**
     * 离开观战房间核心逻辑
     * @param socket
     * @param userId
     * @param roomId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async leaveWatchImpl(socket: any, userId: string, roomId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});
        log.info(`请求离开观战房间[${roomId}]`);
        if (userId && roomId) {
            // 在用户离开度房前也没有观战数据
            await UserStateDao.builder().updateSelective({
                battleId: null,
                userStatus: USER_STATUS.PLATFORM,
                actionTime: null,
                userPage: PAGE_STATUS.PLATFORM,
                roomId: null,
            }, {userId});
            const user: any = await UserDao.builder().selectOne({userId});
            // 发送用户观战通知
            socket.to(roomId).emit('watchNotifyRespApi', CryptorUtils.encrypt({
                code: 'success',
                msg: `${userId}离开观战`,
                data: {
                    action: DATA_CHANGE_TYPE.SUBTRACTION,
                    // action: add 或 sub, 只传一条数据, 增删时为全量数据
                    watchUserList: [{userId: userId, userName: user.userName}],
                }
            }));
        }
        // 在线数据累计
        await onlineUtils.updateOnlineCount({
            changeUserIds: [userId],
            number: 1,
            dataType: ONLINE_DATA_TYPE.IN_ROOM,
            changeType: DATA_CHANGE_TYPE.SUBTRACTION,
        });
        log.info(`已离开[${roomId}]号房间的观战`);
        // socket 离开
        socket.leave(roomId);
        return DataResp.success(`已离开房间`);
    }

    /**
     * 发起求和棋核心逻辑
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async sendPeaceImpl(socket: any, userId: string, roomId: string, battleId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});
        // 更新请求和状态
        await BattleDao.builder().updateSelective({
            sendPeace: BOOLEAN.YES,
            sendUserId: userId,
        }, {id: battleId});

        socket.to(roomId).emit('sendPeaceRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '对方发送求和',
        }));
        log.info(`[${userId}]在[${roomId}]号房间发起了求和请求`);
        return DataResp.success(`求和请求发送成功`);
    }

    /**
     * 发起求和结果处理
     * @param socket
     * @param userId
     * @param roomId
     * @param result
     * @param battleId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async sendPeaceResultImpl(socket: any, userId: string, roomId: string, result: string, battleId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});

        // 更新求和状态
        await BattleDao.builder().updateSelective({
            sendPeace: BOOLEAN.NO,
            sendUserId: null,
        }, {id: battleId});

        // 记录求和流水
        const userStateRows: any = await UserStateDao.builder().select({
            roomId,
            battleId,
            userStatus: USER_STATUS.BATTLE
        });

        const enemyUser = userStateRows.find((user: any) => user.userId != userId);
        enemyUser && await BattleFlowDao.builder().insertSelective({
            userId: enemyUser.userId,
            roomId,
            battleId,
            type: BATTLE_FLOW_TYPE.PEACE,
            result: BOOLEAN.AGREE == result ? BOOLEAN.SHORT_YES : BOOLEAN.SHORT_NO
        });

        socket.to(roomId).emit('sendPeaceResultRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '对方处理了请求和回应',
            data: {
                result: result,
            }
        }));

        // 同意和棋时进行游戏结算
        if (BOOLEAN.AGREE == result) {
            const userState = await UserStateDao.builder().selectOne({userId});
            userState.battleId && await roomUtils.handleGameResult(userState.battleId, userId, roomId, GAME_OVER_TYPE.USER_PEACE);
        }
        log.info(`[${userId}]在[${roomId}]号房间里处理了求和愿意，结果为${result}`);
        return DataResp.success(`已处理请求和请求`);
    }

    /**
     * 校验对局中, 数据的状态
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     * @param step
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async userBattleDataCheckImpl(socket: any, userId: string, roomId: string, battleId: string, step: number): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});
        // 查询当前用户，如果其本身就已离线，就交给「断线重连」功能恢复数据
        const userState: UserStateDo = await UserStateDao.builder().selectOne({userId});
        if (userState.disconnectTime) {
            log.info('服务器检测到该用户本身已离线，将结束本次检验');
            return DataResp.success('用户早已离线');
        }
        log.debug('用户游戏数据为：', userState);
        // 查询用户最后一步棋局信息(最后对局数据是双方的，所以即便是离线，数据库中的数据仍然是一致的)
        let battleHistory: BattleHistoryDo | null = null;
        // 判断是否是观战的用户
        if (USER_STATUS.BATTLE === userState.userStatus) {
            battleHistory = await BattleHistoryDao.builder().getUserLastBattleHistory(battleId, userId);
        } else if (USER_STATUS.WATCH === userState.userStatus) {
            battleHistory = await BattleHistoryDao.builder().getLastBattleHistory(battleId, 1);
        }
        if (!battleHistory) {
            log.warn('无法找到对局历史信息，开始检查对局是否结束');
            await this.userOfflineBattleOver(socket, userId, roomId, battleId);
            return DataResp.success();
        }
        log.debug('棋局最后一步数据为：', battleHistory);
        // 校验对局步数是否一致
        if (battleHistory.stepCount !== step) {
            log.info('校验到步数不一致，开始下发对局信息');
            await battleUtils.sendBattleData(userId, battleId);
        }
        log.info('校验完成');
        return DataResp.success('校验处理完成');
    }

    /**
     * 检查用户离线后，对局是否结束了（状态同步）
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     */
    @Log({excludeNames: 'socket'})
    async userOfflineBattleOver(socket: any, userId: string, roomId: string, battleId: string): Promise<DataResp<any>> {
        await battleUtils.handleUserOfflineBattleOver(socket, userId, roomId, battleId);
        return DataResp.success();
    }

    /**
     * 请求悔棋
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async backMoveImpl(socket: any, userId: string, roomId: string, battleId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});

        // 更新悔棋状态
        await BattleDao.builder().updateSelective({
            sendBackChess: BOOLEAN.YES,
            sendUserId: userId,
            id: battleId,
        }, {id: battleId});

        socket.to(roomId).emit('backMoveRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '对方请求悔棋',
            data: {
                userId: userId,
            },
        }));

        log.info(`[${userId}]在[${roomId}]号房间请求悔棋`);
        return DataResp.success('请求悔棋成功');
    }

    /**
     * 悔棋结果核心逻辑
     * @param socket
     * @param userId
     * @param roomId
     * @param result
     * @param battleId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async backMoveResultImpl(socket: any, userId: string, roomId: string, result: string, battleId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});

        // 更新悔棋状态
        await BattleDao.builder().updateSelective({
                sendBackChess: BOOLEAN.YES,
                sendUserId: null,
            },
            {id: battleId});

        // 获取悔棋流水
        const userStateRows: any = await UserStateDao.builder().select({
            roomId,
            battleId,
            userStatus: USER_STATUS.BATTLE
        });

        const enemyUser = userStateRows.find((user: any) => user.userId !== userId);

        enemyUser && await BattleFlowDao.builder().insertSelective({
            userId: enemyUser.userId,
            roomId,
            battleId,
            type: BATTLE_FLOW_TYPE.BACK_MOVE,
            result: BOOLEAN.AGREE === result ? BOOLEAN.SHORT_YES : BOOLEAN.SHORT_NO,
        });

        // 拒绝情况下直接返回
        if (BOOLEAN.REJECT === result) {
            // 通知对手
            socket.to(roomId).emit('backMoveResultRespApi', CryptorUtils.encrypt({
                code: 'success',
                data: {result: result, userId: userId},
            }));
            log.info(`[${userId}在[${roomId}]号房间处理悔棋意愿：[${result}]`);
            return DataResp.success();
        } else if (BOOLEAN.AGREE === result) {
            // 调用方法操作棋盘数据
            const userStateData: any = await UserStateDao.builder().select({
                userId,
                roomId,
                roomStatus: ROOM_STATUS.BATTLE
            });

            if (userStateData.length === 0) {
                // 通知对手
                socket.to(roomId).emit('backMoveResultRespApi', CryptorUtils.encrypt({
                    code: 'fail',
                    msg: '错误数据错误'
                }));
                // 主动查一下该用户的游离数据
                const userStateData: any = await UserStateDao.builder().selectOne({userId});
                log.warn(`[${userId}]处理悔棋响应时，无法获取到房间[${roomId}]对应战信息`, userStateData);
                return DataResp.fail('棋盘数据错误');
            } else {
                const [user] = userStateData;
                log.info(`[${userId}]在房间[${roomId}]悔棋时，游离数据为：`, user);
                // 判断落子方是否为我方
                const userBattleHistoryData: any = await BattleHistoryDao.builder().getUserLastBattleHistory(battleId, userId);

                log.info(`[${userId}]在房间[${roomId}]悔棋时，当前落子方数据为：`, userBattleHistoryData);
                if (userBattleHistoryData.isRedMove !== user.first) {
                    socket.to(roomId).emit('backMoveResultRespApi', CryptorUtils.encrypt({
                        code: 'fail',
                        msg: '悔棋无效，落子方已交换',
                    }));
                    log.info(`[${userId}]悔棋时，房间[${roomId}]的落子方已交换`);
                    return DataResp.fail('悔棋无效，落子方已交换');
                } else {

                    // 更新当前的落子方
                    await BattleDao.builder().updateSelective({
                            currIsRedMove: !userBattleHistoryData.isRedMove,
                        },
                        {id: battleId});
                    global.battleTimeJob.updateBattleData(user.battleId, {isRedMove: !userBattleHistoryData.isRedMove});

                    // 数据库删除历史消息
                    await BattleHistoryDao.builder().deleteLastMapHistory(user.battleId);

                    // 重置战斗时间
                    const lastBattleData: any = await BattleHistoryDao.builder().getLastBattleHistory(battleId);
                    const userLastBattleData = lastBattleData.find((itemUser: any) => itemUser.userId === userId);
                    const enemyLastBattleData = lastBattleData.find((itemUser: any) => itemUser.userId === enemyUser.userId);
                    global.battleTimeJob.backMoveResetBattleTime(user.battleId, userLastBattleData, enemyLastBattleData);
                    // 记录用户的棋子移动时间
                    await BattleUserDao.builder().updateSelective({
                            moveChessTime: new Date(),
                        },
                        {battleId: user.battleId, userId: enemyUser.userId},
                    );

                    // 获取倒计时数据（重置完时间后立即获取）
                    const battleTimeList = await global.battleTimeJob.getBattleTimeList(user.battleId);
                    global.socketIO.to(roomId).emit('userTimeRespApi', CryptorUtils.encrypt({
                        code: 'success',
                        data: {userList: battleTimeList},
                    }));

                    // 获取房间数据
                    const userBattleDataList = await battleUtils.getBattleData(userId, battleId) || [];
                    socket.to(roomId).emit('backMoveResultRespApi', CryptorUtils.encrypt({
                        code: 'success',
                        msg: '对方处理了悔棋意愿',
                        data: {
                            result: result,
                            user: userId,
                            battleDataList: userBattleDataList
                        },
                    }));
                    log.info(`[${userId}]在[${roomId}]号房间处理了悔棋意愿：[${result}]`);
                    return DataResp.success('允许悔棋');
                }
            }
        } else {
            log.warn(`悔棋结果错误，错误值为：[${result}]`);
            return DataResp.fail('未知的悔棋结果');
        }
    }

    /**
     * 移动棋子逻辑
     * @param socket
     * @param battleId
     * @param userId
     * @param roomId
     * @param from
     * @param to
     * @param fromChessBox
     * @param toChessBox
     * @param stepExplain
     * @constructor
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async moveChessImpl(socket: any, battleId: string, userId: string, roomId: string, from: any, to: any, fromChessBox: object, toChessBox: object, stepExplain: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});
        const lastBattleData = await BattleHistoryDao.builder().getUserLastBattleHistory(battleId, userId);
        // 查询当前用户的对战状态
        const userState: any = await UserStateDao.builder().select({roomId, userStatus: USER_STATUS.BATTLE});
        if (userState.length === 0 || userState.length !== 2) {
            log.info('无法获取对战用户信息, 错误用户状态: ${userState}');
            return DataResp.fail('对战数据丢失');
        } else {
            // 保存对战要移动棋子的数据
            const enemy = userState.find((user: any) => user.userId !== userId);
            const user = userState.find((user: any) => user.userId === userId);
            if (lastBattleData.isRedMove !== user.first) {
                return DataResp.fail('当前落子方不为我方');
            }
            // 检查用户的棋子是否可以移动
            if (!(await battleUtils.checkUserMove(userId, from, to))) {
                log.warn(`为用户[${userId}]检测棋子移动状态时, 校验不通过`);
                return DataResp.fail('落子状态异常');
            } else {

                const tryMoveGameMap = boardUtils.tryMoveChess(FenUtils.fromFen(lastBattleData.gameFen), from, to);

                const isKillBoss = battleUtils.killBossCheck(FenUtils.fromFen(tryMoveGameMap), from.isBlackColor);
                const chessId = from.id;

                // log.info(`[${userId}]是否将军: ${isKillBoss}`);
                if (isKillBoss) {

                    const oneChessCount = longFighting.getOneLongFightData(userId, chessId);
                    const multipleChessCount = longFighting.getMultipleLongFightData(userId);
                    if (oneChessCount >= BATTLE.ONE_LONG_FIGHTING_COUNT) {
                        log.info(`(${userId})已多个子拼杀将被检测到${BATTLE.ONE_LONG_FIGHTING_COUNT}次`);
                        return DataResp.fail('禁止长将(单子强攻)');
                    }

                    if (multipleChessCount >= BATTLE.MULTIPLE_LONG_FIGHTING_COUNT) {
                        log.info(`(${userId})已多个子拼杀将被检测到${BATTLE.MULTIPLE_LONG_FIGHTING_COUNT}次`);
                        return DataResp.fail('禁止长将(多子围攻)');
                    }

                    // 将军则累计持续将军次数
                    await longFighting.updateLongFighting(userId, chessId, 1);
                    log.info(`[${userId}]累计后的次数,单个子: ${oneChessCount},多个子: ${multipleChessCount}`);
                } else {
                    // 末将军，清除记录的持续将军的次数
                    await longFighting.clearLongFightCount(userId);
                }


                await battleUtils.saveMoveChessData(user, enemy, from, to, fromChessBox, toChessBox, stepExplain);

                // 检查游戏是否结束 ，
                const result = await checkWin.judgeGameWin(userId, battleId, tryMoveGameMap, from, to)

                return DataResp.success(`移动棋子成功`)
                    .setData({
                        isOver: result.isOver,
                        type: result.type,
                        nextIsRedMove: !lastBattleData.isRedMove
                    });
            }
        }
    }

    /**
     * 同步房间数据
     * @param socket
     * @param userId
     * @param roomId
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async syncRoomDataImpl(socket: any, userId: string, roomId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});
        // 检查用户是否在房间中
        const userStateRows = await UserStateDao.builder().select({userId, roomId});
        if (userStateRows.length > 0) {
            await roomUtils.sendRoomData(userId, roomId);
            log.info(`[${userId}对应的[${roomId}]号房间数据同步成功`);
            return DataResp.success('同步房间数据成功');
        } else {
            log.info(`[${userId}对应的[${roomId}]号房间数据同步失败(离开或被踢了)`);
            return DataResp.fail('已离开或被踢了');
        }
    }

    /**
     * 同步对战数据
     * @param socket
     * @param battleId
     * @param userId
     * @param roomId
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async syncBattleDataImpl(socket: any, battleId: string, userId: string, roomId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});
        log.info(`[${userId}]请求同步房间[${roomId}]的对战数据`);
        const userStateData: any = await UserStateDao.builder().select({userId, battleId});

        if (userStateData.length) {
            const [userState] = userStateData;
            log.info(`[${userId}]对应房间[${roomId}]的对战数据`, userState);

            // 查询对战数据
            const battleData = await BattleDao.builder().selectOne({id: userState.battleId});
            if (!battleData || battleData.roomStatus !== ROOM_STATUS.BATTLE) {
                log.info(`[${userId}]的对战数据在同步过程中对局已结束`);
                return DataResp.success(`对战已经结束`);
            } else {
                await battleUtils.sendBattleData(userId, battleId);
                return DataResp.success('数据下发成功');
            }

        } else {
            log.info(`[${userId}]同步房间的对战数据失败(用户不在房间中)`);
            return DataResp.success(`对战已经结束`);
        }

    }

    /**
     * 发起认输
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async userAdmitDefeatImpl(socket: any, userId: string, roomId: string, battleId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});

        log.info(`[${userId}]发起认输`);
        await BattleFlowDao.builder().insertSelective({
            userId: userId,
            roomId: roomId,
            battleId: battleId,
            type: BATTLE_FLOW_TYPE.ADMIT_DEFEAT,
            result: BOOLEAN.SHORT_YES,
        });
        await roomUtils.handleGameResult(battleId, userId, roomId, GAME_OVER_TYPE.ADMIT_DEFEAT);
        return DataResp.success('发起认输操作成功');
    }

    /**
     * 玩家聊天
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     * @param content
     */
    @Transaction
    @CatchException
    @Log({excludeNames: 'socket'})
    async userChatImpl(socket: any, userId: string, roomId: string, battleId: string, content: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId, battleId});

        const userDetail: any = await UserDao.builder().selectOne({userId});
        if (!userDetail) {
            log.info(`[${userId}]发送消息[${content}]失败, 无法获取用户信息`);
            return DataResp.fail('消息发送失败');
        } else {
            // 数据库记录聊天消息
            await BattleChatDao.builder().insertSelective({userId, battleId, content});

            // 消息转发给对方
            socket.to(roomId).emit('chatRespApi', CryptorUtils.encrypt({
                code: 'success',
                msg: '消息传递',
                data: {
                    userId: userId,
                    userName: userDetail.userName,
                    content: content,
                },
            }));
            return DataResp.success('消息推送成功');
        }
    }

    /**
     * 游戏胜利
     * @param socket
     * @param userId
     * @param battleId
     * @param roomId
     * @param gameOverType
     */
    @Transaction
    @Log({excludeNames: 'socket'})
    async gameWinImpl(socket: any, userId: string, battleId: string, roomId: string, gameOverType: string): Promise<DataResp<any>> {
        await roomUtils.handleGameResult(battleId, userId, roomId, gameOverType as GAME_OVER_TYPE);
        return DataResp.success();
    }

    /**
     * 获取复盘详情
     * @param socket
     * @param userId
     * @param battleId
     * @param pageSize
     */
    @Log({excludeNames: 'socket'})
    async battleReviewDetailImpl(socket: any, userId: string, battleId: string, pageSize: number): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId});
        // 获取对局详情（分页）
        const pageBattleData = await BattleHistoryDao.builder().getBattleReviewDetail(userId, battleId, pageSize);
        log.info(`[${userId}]所关联的对局[${battleId}]复盘详细数据获取完成`);
        return DataResp.success('获取要复盘的对局详情').setData(pageBattleData);
    }

    /**
     * 获取分享的链接
     * @param socket
     * @param userId
     * @param battleId
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async getShareLinkImpl(socket: any, userId: string, battleId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId});
        const userDetail = await UserDao.builder().selectOne({userId});

        if (!userDetail) {
            // 返回分享链接和内容
            return DataResp.fail('用户信息不存在');
        }
        //查询用户在该对局下是否已经有分享的码
        const shareRows = await ShareDao.builder().select({userId, battleId});

        let shareCode;
        if (shareRows.length > 0) {
            // 有分享记录
            shareCode = shareRows[0].shareCode;
            log.info(`[${userId}]所在的对战区[${battleId}]分享码为：${shareCode}`);
        } else {
            // 创建分享码
            shareCode = constUtils.getRandomId(8);
            // 在分享表创建一条数据
            await ShareDao.builder().insertSelective({
                battleId,
                userId,
                userName: userDetail.userName,
                shareCode,
                validityDay: null,
                sharePassword: null
            });
            log.info(`[${userId}]所在的对战区[${battleId}]已创建分享记录，码为：${shareCode}`);
        }

        const url = `${APP.SHARE_DOMAIN}/shared?code=${shareCode}`;
        const shareLinkText = `${userDetail.userName}分享了一盘对局给你~\n${url}`;
        // 返回分享链接和内容
        log.info(`[${userId}]所在的对战区[${battleId}]分享链接获取成功`);
        return DataResp.success('分享链接获取成功').setData(shareLinkText);
    }

    /**
     * 对局复盘
     * @param socket
     * @param userId
     * @param pageNum
     * @param pageSize
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async battleReviewImpl(socket: any, userId: string, pageNum: number, pageSize: number): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});

        // 获取可复盘的对局
        const pageList: any = await BattleUserDao.builder().getBattleReviewListByPage(userId, pageNum, pageSize);
        // 切换到复盘页面
        await UserStateDao.builder().updateSelective({userPage: PAGE_STATUS.REVIEW}, {userId});
        const {dataTotal, list} = pageList;
        log.debug(`[${userId}]请求了对局复盘数据列表, 共[${list.length}]条数据`);
        return DataResp.success('获取复盘列表成功')
            .setData({
                list: list,
                pageSize: pageSize,
                pageNum: pageNum,
                dataTotal: dataTotal,
            });
    }

    /**
     * 离开复盘列表
     * @param socket
     * @param userId
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async leaveReviewListImpl(socket: any, userId: string): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});
        await UserStateDao.builder().updateSelective({userPage: PAGE_STATUS.PLATFORM}, {userId});
        log.debug(`[${userId}]已离开复盘列表`);
        return DataResp.success('已离开复盘列表');
    }
}

export default BattleServiceImpl;
