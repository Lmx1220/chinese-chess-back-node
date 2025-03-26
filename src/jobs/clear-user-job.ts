import * as schedule from "node-schedule";
import UserStateDao from "../dao/user-state-dao";
import {APP, USER_TYPE} from "../configs/enums";
import UserDao from "../dao/user-dao";
import BasicJob from "./basic-job";

/**
 * 用户长时间未登录
 * 目前只处理游客数据
 */
class ClearUserJob implements BasicJob {
    private cron: string = '0 0 0 */1 * ?';

    exec(params?: Map<string, object>): boolean {
        schedule.scheduleJob(this.cron, () => this.doAction());
        return true;
    }

    private async doAction() {
        global.logUtils.createTraceId();
        const log = global.logUtils.createContext('ClearUserJob', '定时任务(用户长时间未登录)');
        const longTimeUserList: any = await UserStateDao.builder().getLongTimeNotOperate(USER_TYPE.TOURIST_USER, APP.LONG_TIME_NOT_OPERATE_DAYS);

        if (longTimeUserList.length) {
            for (let user of longTimeUserList) {
                const {userId} = user;
                log.info(`账号：[${userId}]在[${APP.LONG_TIME_NOT_OPERATE_DAYS}]天内未登录，即将注销...`);
                await UserStateDao.builder().deleteSelective({ userId });
                await UserDao.builder().deleteSelective({ userId });
            }
        }
        global.logUtils.destroyContext();
    }
}

export default ClearUserJob;