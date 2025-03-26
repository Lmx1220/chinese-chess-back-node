import * as schedule from "node-schedule";
import BattleUserDao from "../dao/battle-user-dao";
import {BATTLE, GAME_OVER_TYPE, ROOM_STATUS} from "../configs/enums";
import BattleDao from "../dao/battle-dao";
import RoomUtils from "../utils/room-utils";
import RedLockUtils from "../utils/red-lock-utils";
import BasicJob from "./basic-job";

const roomUtils = new RoomUtils();

/**
 * 对战离线处理（在对局过程中离线了）
 */
class BattleOfflineJob implements BasicJob {
    private cron: string = '*/1 * * * * ?';

    exec(params?: Map<string, object>): boolean {
        schedule.scheduleJob(this.cron, () => this.doAction());
        return true;
    }

    private async doAction() {
        global.logUtils.createTraceId();
        const log = global.logUtils.createContext('BattleOfflineJob', '定时任务(离线超时通知)');

        const offlineBattleUsers: any = await BattleUserDao.builder().getOfflineTimeoutUser(BATTLE.OFFLINE_TIME_SECONDS);
        if (offlineBattleUsers.length > 0) {
            for (let battleUser of offlineBattleUsers) {
                const {battleId, userId, roomId} = battleUser;
                global.logUtils.addContext(log, { battleId, userId, roomId });

                // 查询该对战房间的游戏状态
                const battleData: any = await BattleDao.builder().select({id: battleId, roomStatus: ROOM_STATUS.BATTLE_OVER});
                if (battleData && battleData.length > 0) {
                    await BattleUserDao.builder().updateBattleUserOfflineTime(battleId, userId, roomId,null);
                    // log.warn(`用户[${userId}]所在的对战区[${battleId}]早已完成结算`);
                } else {
                    let lock = await RedLockUtils.acquire([battleId]);
                    try {
                        log.info(`用户[${userId}]在对战区[${battleId}]超时离开房间[${roomId}]，开始发起结算(逃跑)`)
                        await roomUtils.handleGameResult(battleId, userId, roomId, GAME_OVER_TYPE.USER_LEAVE);
                        // 结算完成离开房间
                        await roomUtils.leaveRoom(userId, roomId);
                        log.info(`用户[${userId}]所在的对战区[${battleId}]结算完成`);
                    } finally {
                        await lock.release();
                    }
                }
            }
        }
        global.logUtils.destroyContext();
    }
}

export default BattleOfflineJob;