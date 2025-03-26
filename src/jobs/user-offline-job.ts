import * as schedule from "node-schedule";
import UserStateDao from "../dao/user-state-dao";
import {BATTLE, GAME_OVER_TYPE, PAGE_STATUS, USER_STATUS} from "../configs/enums";
import RoomUtils from "../utils/room-utils";
import RedLockUtils from "../utils/red-lock-utils";
import BasicJob from "./basic-job";

const roomUtils = new RoomUtils();

/**
 * 用户离线处理（与服务器断开）
 */
class UserOfflineJob implements BasicJob {
    private cron: string = '0 */1 * * * ?';

    exec(params?: Map<string, object>): boolean {
        schedule.scheduleJob(this.cron, () => this.doAction());
        return true;
    }

    private async doAction() {
        global.logUtils.createTraceId();
        const log = global.logUtils.createContext('UserOfflineJob', '定时任务(与服务器断开)');
        const disconnectTimeUsers: any = await UserStateDao.builder().getDisconnectTimeUser(BATTLE.DISCONNECT_TIME_SECONDS);
        if (disconnectTimeUsers.length > 0) {
            for (let userState of disconnectTimeUsers) {
                const {userId, roomId, token, battleId, userStatus} = userState;
                // 判断该用户是否为对战用户
                global.logUtils.addContext(log, {token, userId, roomId, battleId});
                log.info(`用户[${userId}]的游离数据为：`, userState);

                if (userStatus === USER_STATUS.BATTLE) {
                    let lock = await RedLockUtils.acquire([battleId]);
                    try {
                        log.info(`用户[${userId}]所在的房间[${roomId}]还在对战，开始结算(逃跑)`);
                        await roomUtils.handleGameResult(battleId, userId, roomId, GAME_OVER_TYPE.USER_LEAVE);

                        log.info(`用户[${userId}]开始离开房间[${roomId}]`);
                        await roomUtils.leaveRoom(userId, roomId);
                        log.info(`用户[${userId}]已离开对战房间[${roomId}], 即将重置游离数据`);
                        await this.resetUserStateData(userId, log);
                    } finally {
                        await lock.release();
                    }
                } else {
                    // 若用户在房间中，则离开房间
                    roomId && (await roomUtils.leaveRoom(userId, roomId));

                    await this.resetUserStateData(userId, log);
                }
            }
        }
        global.logUtils.destroyContext();
    }

    /**
     * 重置游离数据
     * @param userId
     * @param log
     */
    private resetUserStateData = async (userId: string, log: any) => {
        await UserStateDao.builder().updateSelective({
            roomId: null,
            roomStatus: null,
            first: null,
            isReady: null,
            battleId: null,
            userStatus: null,
            disconnectTime: null,
            joinType: null,
            lockPass: null,
            isRoomAdmin: null,
            actionTime: null,
            userPage: PAGE_STATUS.LOGIN,
            // 不重置token，下次同一个客户端连接时，可不需要登录直接操作
            // token: null,
        }, {userId});
        log.info(`用户[${userId}]已与服务器断开很长时间被重置游离数据`);
    }
}

export default UserOfflineJob;