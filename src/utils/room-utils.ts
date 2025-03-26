import BattleUtils from "./battle-utils";
import SocketUtils from "./socket-utils";
import CryptorUtils from "./cryptor-utils";
import UserDao from "../dao/user-dao";
import BattleDao from "../dao/battle-dao";
import BattleHistoryDao from "../dao/battle-history-dao";
import BattleUserDao from "../dao/battle-user-dao";
import UserStateDao from "../dao/user-state-dao";
import RoomFlowDao from "../dao/room-flow-dao";
import {Transaction} from "../aop/transaction-aop";
import {
    BATTLE,
    DATA_CHANGE_TYPE,
    GAME_OVER_TYPE,
    ONLINE_DATA_TYPE,
    PAGE_STATUS,
    ROOM_JOIN_TYPE,
    ROOM_STATUS,
    USER_STATUS
} from "../configs/enums";
import UserStateVo from "../model/vo/user-state-vo";
import FenUtils from "./fen-utils";
import OnlineUtils from "./online-utils";
import {CatchException} from "../aop/exception-aop";
import UserVo from "../model/vo/user-vo";

const battleUtils = new BattleUtils();
const socketUtils = new SocketUtils();
const onlineUtils = new OnlineUtils();

class RoomUtils {

    /**
     * 离开房间处理
     * @param userId
     * @param roomId
     * @returns {Promise<void>}
     */
    leaveRoom = async (userId: string, roomId: string) => {
        const log = global.logUtils.createContext('RoomUtils', 'leaveRoom', {userId, roomId});

        if (!roomId) {
            log.info(`[${userId}]所在的房间号为空`);
            return;
        }
        // 检查用户是否在房间中
        const userStateRows: any = await UserStateDao.builder().select({roomId: roomId});
        if (userStateRows.length === 0 || !userStateRows.some((user: any) => user.userId === userId)) {
            log.info(`用户[${userId}]早已离开房间[${roomId}]`);
        } else {

            const columns: UserStateVo = {
                first: null,
                isRoomAdmin: null,
                // isReady: null,
                roomStatus: null,
                isReady: false,
                roomId: null,
                battleId: null,
                userStatus: USER_STATUS.PLATFORM,
                joinType: null,
                userPage: PAGE_STATUS.PLATFORM,
            };
            await UserStateDao.builder().updateSelective(columns, {userId: userId});
            const userState = userStateRows.find((user: any) => user.userId === userId);
            log.info(`[${userId}]在房间的游离数据为：`, userState);

            // 离开房间时进行数据累计更新
            // if (userState.userStatus === USER_STATUS.WATCH) {
            //     const user: any = UserDao.getUserByPrimaryKey(userId);
            //     // 发送离开观战通知
            //     global.socketIO.to(roomId).emit('watchNotifyRespApi', CryptorUtils.encrypt({
            //         code: 'success',
            //         msg: `[${userId}]离开观战`,
            //         data: {
            //             action: 'sub',
            //             // action: add 和 sub 时 watchUserId 必需有值
            //             watchUserId: userId,
            //             watchUserName: user.userName,
            //             // action: update 时 watchUserList 为全量数据
            //             watchUserList: [],
            //         }
            //     }));
            //     log.info(`[${userId}]操作离开房间[${roomId}]，其用户状态为[${userState.userStatus}]，不需要更新房间状态`);
            // } else {
            // 在房间或对战时，判断是否有对手，若有则更新对手所在房间的状态
            const enemy = userStateRows.find((user: any) => user.userId !== userId && user.userStatus !== USER_STATUS.WATCH);
            if (enemy) {
                // 更新房间状态
                const updColumns: UserStateVo = {
                    roomStatus: ROOM_STATUS.WAIT,
                    first: true,
                    isRoomAdmin: true,
                };
                await UserStateDao.builder().updateSelective(updColumns, {userId: enemy.userId});
                log.info(`[${enemy.userId}]所在房间[${roomId}]的状态已更新为[${ROOM_STATUS.WAIT}]`);
            }
            const changeUserIds = []
            changeUserIds.push(userId)
            // 1.如果需要通知对手，则直接发送全局事件，或没有对手，也可以直接发送全局事件
            if (!enemy) {
                // 对房间内的用户进行已经离开房间的提醒(离开用户的对手以及吃瓜群众)
                const sockets = socketUtils.getSocketsBy(userState.token);
                for (let socket of sockets) {
                    // 发送给除对手以外的所有人
                    socket.emit('enemyLeaveRoomRespApi', CryptorUtils.encrypt({
                        code: 'success',
                        msg: '对方离开房间',
                        data: {
                            userId: userId,
                        }
                    }));
                }
                log.info(`我方[${userId}]离开房间[${roomId}]时，已通知所有人(不包括自己)`);
            } else {
                // 2.如果不需要通知对手的情况下，直接拿到对手的socket，然后发给除它以外的所有人
                global.socketIO.to(roomId).emit('enemyLeaveRoomRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: '对方离开房间',
                    data: {
                        userId: userId,
                    }
                }));
                log.info(`我方[${userId}]离开房间[${roomId}]时，已通知对手外的所有人`);
                changeUserIds.push(enemy.userId)
            }

            await onlineUtils.updateOnlineCount({
                changeUserIds,
                number: 1,
                dataType: ONLINE_DATA_TYPE.IN_ROOM,
                changeType: DATA_CHANGE_TYPE.SUBTRACTION,
            })
            await this.sendRoomData(userId, roomId)
        }
        log.info(`[${userId}]离开了[${roomId}]号房间`);
    }

    /**
     * 处理游戏胜利
     * @param battleId
     * @param userId
     * @param roomId
     * @param type
     */

    handleGameResult = async (battleId: string, userId: string, roomId: string, type: GAME_OVER_TYPE) => {
        const log = global.logUtils.createContext('RoomUtils', 'handleGameResult', {userId, battleId});

        log.info(`对战房间[${battleId}]请求结算, [${userId}]的结算类型为:[${type}]`);
        // 获取房间信息
        const battleRoom: any = await BattleDao.builder().select({id: battleId, roomId});
        log.info(`对战房间[${battleId}]对应的数据为:`, battleRoom);
        if (battleRoom.length === 0) {
            log.info(`对战房间[${battleId}]无法被获取，结算中止(未结算)`);
        } else {
            const [battle] = battleRoom;
            const {roomStatus} = battle;
            if (roomStatus === ROOM_STATUS.BATTLE_OVER) {
                log.info(`对战房间[${battleId}]已经被结算，本次结算中止`);
                return false;
            } else if (roomStatus !== ROOM_STATUS.BATTLE && roomStatus !== ROOM_STATUS.TIMEOUT) {
                log.info(`对战房间[${battleId}]状态不为对局，结算中止(未结算) ${roomStatus}`);
                return false;
            }
            // 清除游戏倒计时
            global.battleTimeJob.deleteBattleTimeData(battleId);

            // 获取对战房间的用户信息
            const battleUserData = await BattleUserDao.builder().select({battleId: battleId});
            const battleUser = battleUserData.find((user: any) => user.userId === userId);
            const battleEnemy = battleUserData.find((user: any) => user.userId !== userId);
            if (battleUser && battleEnemy) {

                const userDetail: any = await UserDao.getUserByPrimaryKey(battleUser.userId);

                const enemyDetail: any = await UserDao.getUserByPrimaryKey(battleEnemy.userId);
                const userState: any = await UserStateDao.getUserStateByUserId(battleUser.userId);
                const enemyState: any = await UserStateDao.getUserStateByUserId(battleEnemy.userId);

                log.info(`开始结算[${battleUser.userId}]PK[${battleEnemy.userId}]`);

                // 先将房间状态进行更新(防止重复结算)
                await BattleDao.updateBattleStatus(battleId, ROOM_STATUS.BATTLE_OVER);

                // 获取棋盘的对局信息
                const userHistoryData = await BattleHistoryDao.getLastBattleMapHistory(battleId, userId);
                const gameMap = FenUtils.fromFen(userHistoryData.gameFen);
                log.info(`[${userId}]最后一条历史数据为:`, userHistoryData);

                const isPiece = [GAME_OVER_TYPE.USER_PEACE,GAME_OVER_TYPE.NO_ATTACH_PIECE].includes(type)
                let isRedColorWin = null;
                if (type === GAME_OVER_TYPE.USER_TIMEOUT) {
                    // 超时方的对手胜利
                    isRedColorWin = !battleUser.first;
                } else if (type === GAME_OVER_TYPE.BATTLE) {
                    // 对局结束，当前的落子方的对手胜利
                    isRedColorWin = !userHistoryData.isRedMove;
                }
                // else if (type === GAME_OVER_TYPE.USER_PEACE) {
                //     // 对方发起求和，我方同意时会进行结算，优势方为胜利方
                //     isRedColorWin = battleUtils.calcBestUser(gameMap);
                // }
                else if (type === GAME_OVER_TYPE.ADMIT_DEFEAT) {
                    // 我方认输，对手方胜利
                    isRedColorWin = !battleUser.first;
                } else if (type === GAME_OVER_TYPE.USER_LEAVE) {
                    // 我方逃跑，对手胜利
                    isRedColorWin = !battleUser.first;
                }
                const winUserId = isPiece ? null : battleUser.first === isRedColorWin ? battleUser.userId : battleEnemy.userId;
                const winMsg = `${isPiece ? '和棋' : isRedColorWin ? '红棋' : '黑棋'}`;
                const winMessage = `房间[${battleUser.roomId}], 胜利方：${winUserId || ''}(${winMsg})`;
                log.info(winMessage);
                // 更新对战结果
                winUserId && await BattleDao.updateBattleResult(battleId, type, winMsg, winUserId);

                // 对棋盘进行结算
                const winResult = battleUtils.calcScore(gameMap, type, userHistoryData.stepCount);
                log.debug("得分结果：", winResult);

                // 保存结算的数据
                const userData: UserVo = {
                    pkTotalCount: userDetail.pkTotalCount + (winResult.isValidScore ? 1 : 0),
                    pkWinCount: userDetail.pkWinCount + ((battleUser.first === isRedColorWin && winResult.isValidScore) ? 1 : 0),
                    pkFailCount: userDetail.pkFailCount + ((battleUser.first !== isRedColorWin && winResult.isValidScore) ? 1 : 0),
                    pkPeaceCount: userDetail.pkPeaceCount + ((isPiece) ? 1 : 0),
                    // 离线率暂时设置成0
                    pkOfflineCount: 0,
                };
                if (!isPiece) {
                    userData.score = userDetail.score + (battleUser.first === isRedColorWin ? winResult.winScore : winResult.failScore);
                }

                // 更新数据库的对战信息
                await BattleUserDao.builder().updateSelective({
                    changeScore: battleUser.first === isRedColorWin ? winResult.winScore : winResult.failScore
                },{
                    battleId,
                    userId: battleUser.userId,
                });
                console.log({
                    changeScore: battleUser.first === isRedColorWin ? winResult.winScore : winResult.failScore,
                    isRedColorWin,
                    first:battleUser.first,
                    battleId,
                    userId: battleUser.userId,
                })
                // await BattleUserDao.updateBattleUserResult(battleId, battleUser.userId, battleUser.first === isRedColorWin ? winResult.winScore : winResult.failScore);

                // await BattleUserDao.updateBattleUserResult(battleId, userData.userId, battleUser.first === isRedColorWin ? winResult.winScore : winResult.failScore);
                // 更新数据库的信息
                await UserDao.builder().updateSelective(userData, {userId: battleUser.userId});

                // await UserDao.updateUser(userData.userId, userData.score, userData.pkTotalCount, userData.pkWinCount, userData.pkOfflineCount, userData.pkFailCount, userData.pkPeaceCount);

                // 对手方
                const enemyData: UserVo = {
                    pkTotalCount: enemyDetail.pkTotalCount + (winResult.isValidScore ? 1 : 0),
                    pkWinCount: enemyDetail.pkWinCount + ((battleEnemy.first === isRedColorWin && winResult.isValidScore) ? 1 : 0),
                    pkFailCount: enemyDetail.pkFailCount + ((battleEnemy.first !== isRedColorWin && winResult.isValidScore) ? 1 : 0),
                    pkPeaceCount: enemyDetail.pkPeaceCount + ((type === GAME_OVER_TYPE.USER_PEACE && winResult.isValidScore) ? 1 : 0),
                    pkOfflineCount: 0,
                };
                if (!isPiece) {
                    enemyData.score = enemyDetail.score + (battleEnemy.first === isRedColorWin ? winResult.winScore : winResult.failScore);
                }
                // 更新数据库的对战信息
                await BattleUserDao.builder().updateSelective({
                    changeScore: battleEnemy.first === isRedColorWin ? winResult.winScore : winResult.failScore
                },{
                    battleId,
                    userId: battleEnemy.userId,
                });
                console.log({
                    changeScore: battleEnemy.first === isRedColorWin ? winResult.winScore : winResult.failScore,
                    isRedColorWin,
                    first:battleEnemy.first,
                    battleId,
                    userId: battleEnemy.userId,
                })
                // 更新数据库的信息
                await UserDao.builder().updateSelective(enemyData, {userId: battleEnemy.userId});

                // 更新双方用户的游离状态
                const updUserColumn: UserStateVo = {
                    isReady: false,
                    userPage: userState.joinType === ROOM_JOIN_TYPE.RANDOM ? PAGE_STATUS.PLAYER_RANDOM : PAGE_STATUS.PLAYER_FREEDOM,
                    first: winResult.isValidScore ? !battleUser.first : battleUser.first,
                    roomStatus: ROOM_STATUS.MULTIPLE_WAIT,
                    userStatus: USER_STATUS.PLATFORM,
                    battleId: null,
                    actionTime: null,
                };
                await UserStateDao.builder().updateSelective(updUserColumn, {userId: battleUser.userId});

                const updEnemyColumn: UserStateVo = {
                    isReady: false,
                    userPage: enemyState.joinType === ROOM_JOIN_TYPE.RANDOM ? PAGE_STATUS.PLAYER_RANDOM : PAGE_STATUS.PLAYER_FREEDOM,
                    first: winResult.isValidScore ? !battleEnemy.first : battleEnemy.first,
                    roomStatus: ROOM_STATUS.MULTIPLE_WAIT,
                    userStatus: USER_STATUS.PLATFORM,
                    battleId: null,
                    actionTime: null,
                }
                await UserStateDao.builder().updateSelective(updEnemyColumn, {userId: battleEnemy.userId});

                // 结算信息发送给双方
                global.socketIO.to(roomId).emit('gameWinRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: '对局结算完成',
                    data: {
                        // 相关扣分数据
                        winScore: winResult.winScore,
                        failScore: winResult.failScore,
                        // 是否为红棋胜
                        isRedColorWin: isRedColorWin,
                        // 游戏结算类型
                        type: type,
                        // 对局步数
                        stepCount: userHistoryData.stepCount,
                    },
                }));
                await onlineUtils.updateOnlineCount({
                    changeUserIds: [userDetail.userId, enemyDetail.userId],
                    number: 1,
                    dataType: ONLINE_DATA_TYPE.BATTLE,
                    changeType: DATA_CHANGE_TYPE.SUBTRACTION,
                })

                global.socketIO.emit('roomStatusChangeRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: '全局-房间状态改变通知(对局结算)',
                    data: {
                        roomId: battleUser.roomId,
                    },
                }));

                // 清除缓存
                // await battleUtils.clearBattleCache(battleId, userState.userId);
                // await battleUtils.clearBattleCache(battleId, enemyState.userId);
                log.info(`房间:[${battleUser.roomId}]结算完成`);

            }
        }
    }

    async joinRoom(userId: string, roomId: string, joinType: string) {
        const log = global.logUtils.createContext('RoomUtils', 'joinRoom', {userId, roomId});
        const roomDataList: any = await UserStateDao.builder().getRoomData(roomId);
        if (roomDataList && roomDataList.length >= BATTLE.ROOM_MAX_BATTLE_USER_COUNT){
            return false
        }
        await UserStateDao.builder().updateSelective({
            roomId: roomId,
            userPage: joinType === ROOM_JOIN_TYPE.RANDOM ? PAGE_STATUS.PLAYER_RANDOM : PAGE_STATUS.PLAYER_FREEDOM,
            joinType: joinType,
            // 用户在房间时，以当前用户为起始方，否则按谁先手为起始方
            isRoomAdmin: roomDataList.length === 0,
            first: roomDataList.length === 0,
            roomStatus: roomDataList.length >= 1 ? ROOM_STATUS.MULTIPLE_WAIT : ROOM_STATUS.WAIT,
            userStatus: USER_STATUS.IN_ROOM,
        }, {userId: userId});
        const changeUserIds = []
        changeUserIds.push(userId)
        if (roomDataList && roomDataList.length !== 0) {
            const [enemy] = roomDataList
            await UserStateDao.builder().updateSelective({
                roomStatus: ROOM_STATUS.MULTIPLE_WAIT
            }, {
                userId: enemy.userId
            })
            changeUserIds.push(enemy.userId)
        }
        log.info(`用户[${userId}]分配的房间号为[${roomId}](指定加入)`);

        await onlineUtils.updateOnlineCount({
            changeUserIds,
            number: 1,
            dataType: ONLINE_DATA_TYPE.IN_ROOM,
            changeType: DATA_CHANGE_TYPE.ADDED,
        });
        return true;
    }

    async sendRoomData(userId: string, roomId: string) {
        const log = global.logUtils.createContext('SocketServiceImpl', 'handleRoomData', {userId, roomId});

        log.info(`[${userId}]请求同步房间[${roomId}]数据`);
        // 获取房间的数据
        const roomDataList: any = await UserStateDao.builder().getRoomData(roomId);
        global.socketIO.to(roomId).emit('syncRoomDataRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '获取房间数据成功',
            data: {
                roomDataList,
                roomId,
            },
        }));
        log.info(`[${userId}]已同步房间数据`);
    }

    /**
     * 发送房间数据(只发送房间数据，不发送用户数据)
     * @param socket
     * @param userId
     * @param roomId
     */
    async sendRoomDataOnly(socket: any, userId: string, roomId: string) {
        const roomDataList: any = await UserStateDao.builder().getRoomData(roomId);
        socket.emit('syncRoomDataRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '获取房间数据成功',
            data: {
                roomDataList,
                roomId,
            },
        }));
    }

}

export default RoomUtils;
