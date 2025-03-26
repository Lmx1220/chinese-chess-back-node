import UserStateDao from "../dao/user-state-dao";
import CryptorUtils from "../utils/cryptor-utils";
import VersionDao from "../dao/version-dao";
import BattleDao from "../dao/battle-dao";
import DataResp from "../model/data-resp";
import {CatchException} from "../aop/exception-aop";
import SocketUtils from "../utils/socket-utils";
import DateUtils from "../utils/date-utils";
import {BATTLE, DATA_CHANGE_TYPE, ONLINE_DATA_TYPE, USER_STATUS} from "../configs/enums";
import BattleUserDao from "../dao/battle-user-dao";
import {Transaction} from "../aop/transaction-aop";
import RoomException from "../exception/room-exception";
import RestException from "../exception/rest-exception";
import {Log} from "../aop/log-aop";
import OnlineUtils from "../utils/online-utils";

const socketUtils = new SocketUtils();
const dateUtils = new DateUtils();
const onlineUtils = new OnlineUtils();

class SystemCore {
    /**
     * 检查session是否过期
     * @param userId
     * @param token
     * @param ip
     */
    checkSessionExpired = async (userId: string, token: string, ip: string) => {
        const log = global.logUtils.createContext('SocketServiceImpl', 'watchListImpl', {userId});
        const userState = await UserStateDao.getUserStateByUserId(userId);
        // log.debug("会话预检，用户信息为：", userState);
        return userState ? userState.token !== token : true;
    }

    async getVersionImpl(socket: any) {
        const log = global.logUtils.createContext('SocketServiceImpl', 'getVersionImpl');
        const versionId = await VersionDao.getClientVersion();
        const versionDetailList = await VersionDao.getVersionIdDetailList(versionId);
        log.info(`当前版本为：${versionId}`);
        socket.emit('versionRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '客户端版本',
            data: {
                versionId: versionId,
                versionDetailList: versionDetailList,
            },
        }));
    }

    /**
     * 在线数据统计
     * @param socket
     * @param userId
     */
    @Log({excludeNames: 'socket'})
    async onlineCountImpl(socket: any, userId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId});
        log.info('用户在线数据统计');

        await onlineUtils.loadAllOnlineCount()

        global.socketIO.emit('onlineCountRespApi', CryptorUtils.encrypt(DataResp.success('在线数据统计').setData({
            battleCount: await onlineUtils.getCountByType(ONLINE_DATA_TYPE.BATTLE),
            roomCount: await onlineUtils.getCountByType(ONLINE_DATA_TYPE.IN_ROOM),
            userArray: []
        })));
        return DataResp.success();
    }
    /**
     * 观战人数信息累计
     * @param socket
     * @param userId
     * @param roomId
     */
    @Log({excludeNames: 'socket'})
    async watchCountImpl(socket: any, userId: string, roomId:string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId});
        log.info('观战人数信息累计');
        const watchUserList = await UserStateDao.builder().queryWatchCount(roomId);

        global.socketIO.emit('watchNotifyRespApi', CryptorUtils.encrypt(DataResp.success('观战人数信息累计').setData({
            action: DATA_CHANGE_TYPE.SET,
            watchUserList: watchUserList

        })));
        return DataResp.success();
    }

    /**
     * 获取版本详情
     * @param socket
     */

    async getVersionDetailImpl(socket: any): Promise<DataResp<any>> {
        const log = global.logUtils.createContext('SocketServiceImpl', 'getVersionDetailImpl');
        const vDetailList = await VersionDao.getVersionDetailList();
        log.info(`版本信息获取完成`);
        return DataResp.success('游戏版本信息').setData(vDetailList);
    }

    /**
     * 断开连接逻辑
     * @param socket
     * @param reason
     * @return {Promise<void>}
     */
    @Transaction
    @CatchException
    async disconnectImpl(socket: any, reason: string): Promise<void> {
        const log = global.logUtils.createContext('SocketServiceImpl', 'disconnectImpl');

        const token = socketUtils.getToken(socket);
        log.info(`检测到token:[${token}]已离线，离线原因为：${reason}`);

        const allSockets = socketUtils.getSocketsBy(token);
        // 查询游离数据
        const userState: any = await UserStateDao.builder().selectOne({token});
        log.info(`用户游离数据为:`, userState);

        if (userState) {

            const {userId, userStatus, battleId, roomId} = userState;
            const offlineTime = new Date();
            // 为用户状态游离表更新断开时间
            log.info(`开始更新用户[${userId}]的断开时间, offlineTime:[${dateUtils.formatDate(offlineTime)}]`);
            await UserStateDao.builder()
                .updateSelective({disconnectTime: offlineTime}, {userId});
            // 继续判断是否在房间中
            if (roomId != null) {
                // 观战用户不需要通知
                if (userStatus !== USER_STATUS.WATCH) {
                    // 若该用户发生了对战，则为用户更新当前局的对战离线时间
                    battleId && await BattleUserDao.builder().updateBattleUserOfflineTime(battleId, userId, roomId, offlineTime);

                    log.info(`开始告诉对手方我方已离线的信息，userId:[${userId}]`);
                    // 通知房间内的对手，该用户已离线，并进行倒计时自动判定负
                    socket.to(roomId).emit('enemyOfflineRespApi', CryptorUtils.encrypt({
                        code: 'success',
                        msg: '对手暂时离线',
                        data: {
                            userId: userId,
                            offlineTime: offlineTime.getTime(),
                            offlineTimeout: BATTLE.OFFLINE_TIME_SECONDS,
                        },
                    }));
                } else {
                    log.info(`[${userId}]为观战用户，不需要对房间内的用户发送离线通知`);
                }
                log.info(`[${userId}]暂时断开，服务器将会话保持${BATTLE.OFFLINE_TIME_SECONDS / 60}分钟`);
            } else {
                log.info(`[${userId}]无房间信息，仅更新游戏表数据中的超时时间:${dateUtils.formatDate(offlineTime)}`);
            }
        } else {
            log.info(`token:[${token}]已断开连接（未登录/正常退出）`);
        }
    }
}

export default SystemCore;
