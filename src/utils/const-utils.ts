/**
 * 放一些基础的方法
 */
import * as uuid from "uuid";
import {BOOLEAN, ROOM_STATUS, USER_STATUS} from "../configs/enums";
import DateUtils from "./date-utils";

const dateUtils = new DateUtils();

class ConstUtils {
    private chars: any[] = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

    /**
     * 生成随机Id
     * @param len
     * @param radix
     */
    getRandomId = (len: number, radix = this.chars.length) => {
        const uuid = [];
        let i;
        if (len) {
            // Compact form
            for (i = 0; i < len; i++) uuid[i] = this.chars[0 | Math.random() * radix];
        } else {
            // rfc4122, version 4 form
            let r;
            // rfc4122 requires these characters
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
            uuid[14] = '4';
            // Fill in random data.  At i==19 set the high bits of clock sequence as
            // per rfc4122, sec. 4.1.5
            for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | Math.random() * 16;
                    uuid[i] = this.chars[(i === 19) ? (r & 0x3) | 0x8 : r];
                }
            }
        }
        return uuid.join('');
    }

    /**
     * 获取uuid
     */
    getUUId = () => {
        return uuid.v4().replace(/-/g, '');
    }

    /**
     * 休眠
     * @param time 时间，单位：ms
     */
    sleep = async (time: number) => {
        return new Promise(resolve => setTimeout(() => resolve(BOOLEAN.SHORT_YES), time));
    }

    buildUserOnlineInfo(user: any): any {
        let statusName = ""
        let extendStr = user.actionTime
        if (user.userStatus === USER_STATUS.PLATFORM) {
            statusName = "空闲"
        } else if (user.userStatus === USER_STATUS.IN_ROOM) {
            statusName = "房间"
            extendStr = user.roomStatus === ROOM_STATUS.MULTIPLE_WAIT ? '(2/2)' : '(1/2)'
        } else if (user.userStatus === USER_STATUS.BATTLE) {
            statusName = "对局"
        } else if (user.userStatus === USER_STATUS.WATCH) {
            statusName = "观战"
        }


        return  {
            status: user.userStatus,
            statusName: user.userStatus ? statusName : '离线',
            sucPercentage: this.calculateWinRate(user.pkTotalCount, user.pkWinCount),
            extendStr,
        }
    }

    private calculateWinRate(pkTotalCount: number, pkWinCount: number) {
        if (pkTotalCount > 0) {
            return Math.floor((pkWinCount / pkTotalCount) * 100);
        } else {
            return 0; // 如果总对局次数为0，胜率为0
        }
    }
}

export default ConstUtils;
