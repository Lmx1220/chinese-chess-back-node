import {CatchException} from "../aop/exception-aop";
import {Log} from "../aop/log-aop";
import UserStateDao from "../dao/user-state-dao";
import CryptorUtils from "./cryptor-utils";
import BattleDao from "../dao/battle-dao";
import {
    BATTLE,
    BOOLEAN,
    DATA_CHANGE_TYPE,
    ONLINE_DATA_TYPE,
    PAGE_STATUS,
    REDIS_KEYS,
    ROOM_JOIN_TYPE,
    ROOM_STATUS,
    USER_ROLE,
    USER_STATUS
} from "../configs/enums";
import BattleUserDao from "../dao/battle-user-dao";
import OnlineUtils from "./online-utils";
import SocketUtils from "./socket-utils";
import BattleUtils from "./battle-utils";
import RoomUtils from "./room-utils";
import DateUtils from "./date-utils";
import RedisUtils from "./redis-utils";
import ConstUtils from "./const-utils";

const socketUtils = new SocketUtils();
const battleUtils = new BattleUtils();
const roomUtils = new RoomUtils();
const dateUtils = new DateUtils();
const onlineUtils = new OnlineUtils();
const redisUtils = new RedisUtils();
const constUtils = new ConstUtils();

/**
 * 会话管理工具
 */
class SessionUtils {

    @CatchException
    @Log({excludeNames: 'socket'})
    async inBattleRecover(socket: any, userId: string, roomId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, roomId});

        log.info("检测到该用户正在对局，开始进行对局恢复");
        // 获取该房间的基本信息
        const [battleInfo]: any = await BattleDao.builder().getBattleInfoList(userId, ROOM_STATUS.BATTLE);
        log.info("用户对应的对战信息为:", battleInfo);
        // 设置基本信息
        await UserStateDao.builder().updateSelective({
            userPage: PAGE_STATUS.BOARD,
            roomId: battleInfo.roomId,
            battleId: battleInfo.battleId,
        }, {userId});

        log.info("已更新游离状态，开始正式恢复数据");
        await this.sessionRecoverDetail(socket);
    }

    /**
     * 数据恢复
     * @param socket
     */
    @CatchException
    @Log({excludeNames: 'socket'})
    async sessionRecoverDetail(socket: any): Promise<void> {
        const log = global.logUtils.getArgsLogger(arguments);
        const token = socketUtils.getToken(socket);

        // 查询游离数据
        const userState = await UserStateDao.builder().selectOne({token});
        log.info(`token:[${token}]关联的用户游离数据为:`, userState);
        if (userState) {
            const { userId, roomId, battleId } = userState;
            global.logUtils.addContext(log, { userId, roomId, battleId });

            // 若存在历史会话，且会话Id不一致，则账号已经在别处登录
            const closeSocket = socketUtils.getSocketBy(userState.token);
            if (closeSocket && token !== userState.token) {
                // 发送账号冲突请求
                socket.emit('userConflictRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: '账号已在别处登录',
                }));
                // 将socket关闭
                socket.disconnect(true);
                // 会话已过期，因为已在别处登录了
                log.info(`token:[${token}]已在其它地方登录`);
            } else {
                // 清除断线时间
                await UserStateDao.builder().updateSelective({disconnectTime: null}, {userId});
                log.info(`token:[${token}]关联的用户[${userId}]已清除断线时间`);

                // 恢复会话
                await this.loginAfterSessionRecover(socket, userId);
            }
        } else {
            // 带userId恢复数据，但又无游离数据，表示会话已经过期了
            socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                code: 'S000003',
                msg: '您的会话已经过期，请重新登录',
            }));
            // 会话已过期
            log.info(`token:[${token}]无法查询到会话信息，可能已过期`);
        }
    }


    /**
     * 恢复会话数据（仅处理登录时是否需要恢复）
     * @param socket
     * @param userId
     */
    @CatchException
    @Log({ excludeNames: 'socket' })
    async loginAfterSessionRecover(socket: any, userId: string): Promise<boolean> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});
        if (!userId) {
            log.info(`会话恢复时，传入的用户为：[${userId}]，恢复已停止`);
            return false;
        }
        // 查询用户状态表中是否有数据
        const userState = await UserStateDao.builder().selectOne({userId});
        log.info(`[${userId}]查询用户状态表中的数据，结果:`, userState);
        if (!userState) {
            log.warn(`[${userId}]无游离数据，会话恢复终止`);
            return false;
        }
        const {roomId, battleId, userStatus, joinType, userPage} = userState;
        // 检查是否还有正在进行的对局
        const isInBattle = await BattleDao.builder().checkUserInBattle(userId);

        // 决策：需要做哪种类型的数据恢复
        if (isInBattle || userStatus === USER_STATUS.BATTLE) {
            await this.battleRecover(socket, userId, roomId, battleId, joinType);
        } else if (userStatus === USER_STATUS.WATCH) {
            await this.watchRecover(socket, userId, roomId, battleId);
        } else if (roomId) {
            await this.roomRecover(socket, userId, roomId, battleId, joinType);
        } else {
            await this.defaultRecover(socket, userId, roomId, battleId, userPage);
        }
        // 发一个在线消息，冲刷在线列表
        await onlineUtils.updateOnlineCount({
            changeUserIds: [userId],
            number: 0,
            dataType: ONLINE_DATA_TYPE.IN_ROOM,
            changeType: DATA_CHANGE_TYPE.DEFAULT,
        })
        return true;
    };

    /**
     * 默认会话恢复逻辑(一般是转入大厅)
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     * @param userPage
     * @private
     */
    @Log({ excludeNames: 'socket' })
    private async defaultRecover(socket: any, userId: string, roomId: string, battleId: string, userPage: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId, roomId});

        // 数据断连恢复时，检查是否有结束的对局
        if(await this.checkOverBattle(socket, userId)) {
            log.info("数据断连(默认页)恢复时，检测到有已结束的对局...");
            return;
        }

        // 分两种情况，第一种是被服务器打回了登录页面，此种情况直接发送会话过期
        if(userPage === PAGE_STATUS.LOGIN) {
            socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                code: 'S000003',
                msg: '您因长时间未活跃，会话已过期',
            }));
            log.warn(`[${userId}]因长时间未活跃，会话已过期`);
            // 主动断开
            socket.disconnect(true);
            return true;
        } else {
            // 第二种情况则是恢复到用户当前所在页面
            socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                code: 'S000002',
                msg: null,
                data: {
                    page: userPage
                },
            }));
            // 更新我方页面的状态
            await UserStateDao.builder().updateSelective({userPage: userPage}, {userId});
            log.info(`[${userId}]停留到用户所在页面:${userPage}`);
        }
    }

    /**
     * 处于房间时恢复逻辑
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     * @param joinType
     * @private
     */
    @Log({ excludeNames: 'socket' })
    private async roomRecover(socket: any, userId: string, roomId: string, battleId: string, joinType: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId, roomId});
        // 数据断连恢复时，检查是否有结束的对局
        if(await this.checkOverBattle(socket, userId)) {
            log.info("数据断连(在房间中)恢复时，检测到有已结束的对局...");
            return;
        }
        // 如果在匹配平台，就一定有房间号
        socket.join([onlineUtils.DEFAULT_ROOM_ID, roomId]);
        const joinTypeMapping = new Map();
        joinTypeMapping.set(ROOM_JOIN_TYPE.RANDOM, PAGE_STATUS.PLAYER_RANDOM);
        joinTypeMapping.set(ROOM_JOIN_TYPE.FREEDOM, PAGE_STATUS.PLAYER_FREEDOM);
        const currPage = joinTypeMapping.get(joinType);

        log.info(`[${userId}]无对战数据，尝试恢复房间[${roomId}]数据`);
        // 引导客户端到指定页面
        socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
            code: 'S000002',
            msg: null,
            data: {
                page: currPage,
                roomId: roomId,
                joinType: joinType
            },
        }));
        log.info(`[${userId}]有房间[${roomId}]的数据，当前页:${currPage}`);
        // 更新我方页面的状态
        await UserStateDao.builder().updateSelective({userPage: currPage}, {userId});

        log.info(`主动为用户[${userId}]下发房间[${roomId}]的数据`);
        await roomUtils.sendRoomData(userId, roomId);

        log.info(`主动为用户[${userId}]下发在线用户的状态数据`);
        await onlineUtils.sendOnlineUserList(socket, userId);
    }

    /**
     * 处于观战时恢复逻辑
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     * @private
     */
    @Log({ excludeNames: 'socket' })
    private async watchRecover(socket: any, userId: string, roomId: string, battleId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId, roomId});
        log.info(`[${userId}]有对战区[${battleId}]，开始恢复数据（观战）`);
        // 如果在匹配平台，就一定有房间号
        socket.join(roomId);
        // 检查该房间是否有对局数据
        const battleData: any = await BattleDao.builder().select({roomId, roomStatus: ROOM_STATUS.BATTLE});
        if (battleData.length > 0) {
            const [battle] = battleData;

            socket.emit('sessionRecoverNotifyApi', CryptorUtils.encrypt({
                code: 'success',
                msg: `断线了，正在进入...`,
                data: {
                    battleId: battle.id,
                    // 是否为新开对局
                    isNewBattle: battle.id !== battleId,
                }
            }));

            // 更新对局信息
            await UserStateDao.builder().updateSelective({
                battleId: battle.id,
                userStatus: USER_STATUS.WATCH,
                userPage: PAGE_STATUS.WATCH,
                roomId: battle.roomId,
            }, {userId});

            // 观战用户恢复数据
            socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                code: 'S000002',
                msg: '恢复观战数据',
                data: {
                    role: USER_ROLE.WATCH,
                    roomId: roomId,
                },
            }));
            // 更新我方页面的状态
            await UserStateDao.builder().updateSelective({userPage: PAGE_STATUS.WATCH}, {userId});
            // 主动下发对战数据(用新查询的对局id，因为可能在此期间上一盘已经结束了)
            await battleUtils.sendBattleData(userId, battle.id);

            log.info(`已通知[${userId}]同步观战数据`);
        } else {
            // 对局已经结束
            socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                code: 'S000002',
                msg: '被观战的对局已经结束',
                data: {
                    role: USER_ROLE.WATCH,
                    roomId: roomId,
                },
            }));

            // 下发房间数据(给客户端一个切页面的时间，若切失败也没关系，有其它事件补偿)
            await constUtils.sleep(100);
            await roomUtils.sendRoomDataOnly(socket, userId, roomId);

            log.info(`[${userId}]观战的对战区[${battleId}]对局已结束(观战)`);
        }
    }

    /**
     * 处于对战时恢复逻辑
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     * @param joinType
     * @private
     */
    @Log({ excludeNames: 'socket' })
    private async battleRecover(socket: any, userId: string, roomId: string, battleId: string, joinType: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId, roomId});
        // 如果在匹配平台，就一定有房间号
        socket.join(roomId);

        // 如果在对局，就一定有battleId
        log.info(`[${userId}]有对战区[${battleId}]，开始恢复数据（对局）`);
        socket.emit('sessionRecoverNotifyApi', CryptorUtils.encrypt({
            code: 'success',
            msg: `断线了，正在进入...`,
        }));
        log.info(`[${userId}]所在对战区[${battleId}]对局未结束，开始恢复数据`);
        // 清除对战用户表中的离线时间
        await BattleUserDao.builder().updateBattleUserOfflineTime(battleId, userId, roomId, null);
        // 清除离线时，记录的对战变更标记
        await this.clearBattleChangeMarker(userId, roomId, battleId);
        // 获取房间的数据
        const battleData = await battleUtils.getBattleData(userId, battleId);
        // log.info(`[${userId}]所在对战区[${battleId}]房间对战数据为`, battleData);
        if (!battleData) {
            socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                code: 'S000001',
                msg: '对局已经结束',
            }));
            socket.leave(roomId);
            log.info(`[${userId}]所在对战区[${battleId}]在恢复过程中对局已经结束`);
            return;
        }
        // 获取用户数据
        const user: any = battleData.find((user: any) => user.userId === userId);
        const enemy: any = battleData.find((user: any) => user.userId !== userId);
        // 处理对局数据
        await this.handleBattleRecoverData(socket, user, enemy, roomId, battleId, joinType);
        // 更新我方页面的状态
        await UserStateDao.builder().updateSelective({userPage: PAGE_STATUS.BOARD}, {userId});
        // 下发房间数据
        await roomUtils.sendRoomData(userId, roomId);
        // 主动下发对战数据
        await battleUtils.sendBattleData(userId, battleId);
        // 查询对方有没有求和、悔棋等请求
        await this.handleBattleReq(socket, user, enemy, roomId, battleId);
        log.info(`[${userId}]所在对战区[${battleId}]已同步对战数据`);
    }

    @Log({ excludeNames: 'socket' })
    private async clearBattleChangeMarker(userId: string, roomId: string, battleId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId, roomId});

        const userRedisKey = `${REDIS_KEYS.USER_OFFLINE_BATTLE_CHANGE_KEY}:${userId}`;
        const userRedisData = await redisUtils.getStr(userRedisKey);

        // 判断是否有标记，且标记还未记录结算信息，表示对局未结束
        if(userRedisData == "" || userRedisData?.length === 0) {
            await redisUtils.delete(userRedisKey);
            log.info(`用户[${userId}]已重新上线且对局未结算，清除记录的缓存标记`)
        }
    }

    /**
     * 处理对战数据
     * @param socket
     * @param user
     * @param enemy
     * @param roomId
     * @param battleId
     * @param joinType
     * @private
     */
    @Log({ excludeNames: 'socket' })
    private async handleBattleRecoverData(socket: any, user: any, enemy: any, roomId: string, battleId: string, joinType: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId: user.userId, battleId, roomId});

        socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
            code: 'S000002',
            msg: '恢复对局数据',
            data: {
                roomId: roomId,
                roomUser: user,
                roomEnemy: enemy,
                role: USER_ROLE.BATTLE,
                battleId: battleId,
                page: PAGE_STATUS.BOARD,
                joinType: joinType
            },
        }));
        // 通知对手已经上线
        socket.to(roomId).emit('enemyOnlineRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '对手已经上线',
            data: {
                // 我方上线通知对手
                onlineUserId: user.userId,
            }
        }));

        // 查询敌人有没有离线
        if (enemy.offlineTime) {
            // 通知房间内的对手，该用户已离线，并进行倒计时自动判定负
            global.socketIO.to(roomId).emit('enemyOfflineRespApi', CryptorUtils.encrypt({
                code: 'success',
                msg: '对手暂时离线',
                data: {
                    offlineUserId: enemy.userId,
                    offlineTime: dateUtils.strToDate(enemy.offlineTime).getTime(),
                    offlineTimeout: BATTLE.OFFLINE_TIME_SECONDS,
                },
            }));
            log.info(`[${user.userId}]房间中的对手[${enemy.userId}]暂时断开`);
        } else {
            // 我方已上线且对方也未离线，删除服务器的计时数据，交由客户端处理
            log.info(`检测到双方未离线，即将删除服务端计时数据`);
            await global.battleTimeJob.deleteBattleTimeData(battleId);
            // 告诉我方，对方是在线状态(适用场景：对方先离线，我方后离线，在我方离线这段时间内，对方上线了)
            socket.emit('enemyOnlineRespApi', CryptorUtils.encrypt({
                code: 'success',
                msg: '对手已经上线',
                data: {
                    onlineUserId: enemy.userId,
                }
            }));
        }
    }

    /**
     * 处理积压的请求（求和、认输等）
     * @param socket
     * @param user
     * @param enemy
     * @param roomId
     * @param battleId
     * @private
     */
    @Log({ excludeNames: 'socket' })
    private async handleBattleReq(socket: any, user: any, enemy: any, roomId: string, battleId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId: user.userId, battleId, roomId});

        log.info(`开始查询[${enemy.userId}]是否有求和、悔棋等未响应的请求，参数：${battleId}, ${enemy.userId}`);
        const battleRows: any = await BattleDao.builder().select({id: battleId, sendUserId: enemy.userId});
        if (battleRows.length) {
            const [battle] = battleRows;
            log.info(`查询出用户[${enemy.userId}]的对战数据为：`, battle);
            let apiName = null;
            let apiMsg = ''
            if (battle.sendPeace === BOOLEAN.YES) {
                apiName = 'sendPeaceRespApi';
                apiMsg = '对方发起求和';
            } else if (battle.sendBackChess === BOOLEAN.YES) {
                apiName = 'backMoveRespApi';
                apiMsg = '对方请求悔棋';
            }
            if (apiName) {
                socket.emit(apiName, CryptorUtils.encrypt({
                    code: 'success',
                    msg: apiMsg,
                    data: {
                        userId: enemy.userId,
                    },
                }));
                log.info(`检测到用户[${enemy.userId}]有操作：[${apiMsg}]`);
            } else {
                log.error("对战流水类型错误，查出来的数据为：", battle);
            }
        }
    }

    /**
     * 检查当前用户是否有已经结束的对战
     * @param socket
     * @param userId
     * @private
     */
    @Log({ excludeNames: 'socket' })
    private async checkOverBattle(socket: any, userId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId});

        const redisKey = `${REDIS_KEYS.USER_OFFLINE_BATTLE_CHANGE_KEY}:${userId}`;
        const redisData = await redisUtils.getStr(redisKey);
        if(redisData && redisData.length > 0) {
            const parseRedisData = JSON.parse(redisData);
            const { battleId, roomId, joinType} = parseRedisData;
            socket.join(roomId);

            // 进入棋盘界面
            const battleData = await battleUtils.getBattleData(userId, battleId);
            if(!battleData) {
                // 对局数据不存在，对战ID肯定有问题
                log.info("对局数据不存在");
                return false;
            }

            // 获取用户数据
            const user: any = battleData.find((user: any) => user.userId === userId);
            const enemy: any = battleData.find((user: any) => user.userId !== userId);
            socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                code: 'S000002',
                msg: '恢复对局数据',
                data: {
                    roomId: roomId,
                    roomUser: user,
                    roomEnemy: enemy,
                    role: USER_ROLE.BATTLE,
                    battleId: battleId,
                    page: PAGE_STATUS.BOARD,
                    joinType: joinType,
                },
            }));
            log.info("存在对局信息");
            return true;
        }
        return false;
    }
}

export default SessionUtils;