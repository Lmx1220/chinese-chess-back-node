import {DATA_CHANGE_TYPE, ONLINE_DATA_TYPE, REDIS_KEYS, ROOM_STATUS, USER_STATUS} from "../configs/enums";
import RedisUtils from "./redis-utils";
import CryptorUtils from "./cryptor-utils";
import UserStateDao from "../dao/user-state-dao";
import BattleDao from "../dao/battle-dao";
import ConstUtils from "./const-utils";
import RedLockUtils from "./red-lock-utils";
import {Log} from "../aop/log-aop";

const redisUtils = new RedisUtils();
const constUtils = new ConstUtils();

// 更新在线数据的选项
declare interface UpdateOnlineCountOptions {
    // 变更人列表
    changeUserIds: string[],
    // 更新数量
    number: number,
    dataType: ONLINE_DATA_TYPE,
    changeType: DATA_CHANGE_TYPE,
}

class OnlineUtils {

    /**
     * 在线数据变更时会向此房间进行广播
     */
    DEFAULT_ROOM_ID = '0';

    /**
     * 发下在线用户变动信息
     * @param param
     * @private
     */
    @Log()
    private async sendOnlineUserInfo(param: UpdateOnlineCountOptions) {
        const log = global.logUtils.getArgsLogger(arguments);
        // 用户的在线数据
        const changeUserDetailList = [];
        for (let userId of param.changeUserIds) {
            const user = await UserStateDao.builder().getOnlineUserBy(userId);
            if (user) {
                const userInfo = constUtils.buildUserOnlineInfo(user);
                const onlineUser = {
                    userId: user.userId,
                    roomId: user.roomId,
                    battleId: user.battleId,
                    userName: user.userName,
                    // 积分
                    score: user.score,
                    // 用户头像
                    iconUrl: user.iconUrl,
                    // 当前用户的状态及名称
                    status: userInfo.status,
                    statusName: userInfo.statusName,
                    // 胜率(一个整数)
                    sucPercentage: userInfo.sucPercentage,
                    // 其它内容描述
                    extendStr: userInfo.extendStr,
                }
                changeUserDetailList.push(onlineUser);
            }
        }
        if (changeUserDetailList.length) {
            // 数据下发
            global.socketIO.to(this.DEFAULT_ROOM_ID)
                .emit('onlineUserChangeRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: '在线用户变更',
                    data: {
                        userArray: changeUserDetailList,
                        dataType: param.dataType,
                        changeType: param.changeType,
                    },
                }))
        }
    }

    /**
     * 保存进redis
     * @param param
     */
    @Log()
    private async save2Redis(param: UpdateOnlineCountOptions) {
        const lock = await RedLockUtils.acquire([this.DEFAULT_ROOM_ID]);
        const log = global.logUtils.getArgsLogger(arguments);
        try {
            // 查询Redis该类型的数据
            const cacheKey = `${REDIS_KEYS.ONLINE_DATA_CACHE_KEY}:${param.dataType}`;
            const oldNumber: any = await redisUtils.getStr(cacheKey);
            let newNumber = oldNumber?.length ? Number(oldNumber) : 0;
            // 操作数据
            switch (param.changeType) {
                case DATA_CHANGE_TYPE.ADDED:
                    newNumber += param.number;
                    break;
                case DATA_CHANGE_TYPE.SUBTRACTION:
                    newNumber -= param.number;
                    break;
                case DATA_CHANGE_TYPE.SET:
                    newNumber = param.number;
                    break;
                default:
                    break;
            }
            // 写入缓存
            await redisUtils.setStr(cacheKey, String(newNumber), 2 * 60 * 60 * 1000);
            // FIXME 比对一下数据库的数据，排查下在线数据不一致的问题
            const dbNumber: number = await UserStateDao.builder().queryInRoomCount();
            if(dbNumber !== newNumber && param.dataType === 'roomCount') {
                log.error(`数值统计不一致，db: ${dbNumber}, curr: ${newNumber}`)
            }

            global.socketIO.to(this.DEFAULT_ROOM_ID)
                .emit('onlineCountRespApi', CryptorUtils.encrypt({
                    code: 'success',
                    msg: '在线用户数量变更',
                    data: {
                        [param.dataType]: newNumber,
                    },
                }))
            // 下发在线用户变动通知
            await this.sendOnlineUserInfo(param);
            log.debug(`下发类型：[${param.dataType}]，内容：${newNumber}`);
        } finally {
            await lock.release();
        }
    }

    /**
     * 从db中加载全量在线数据
     */
    loadAllOnlineCount = async () => {
        redisUtils.delete(`${REDIS_KEYS.ONLINE_DATA_CACHE_KEY}:${ONLINE_DATA_TYPE.IN_ROOM}`);
        redisUtils.delete(`${REDIS_KEYS.ONLINE_DATA_CACHE_KEY}:${ONLINE_DATA_TYPE.BATTLE}`);

        await this.save2Redis({
            changeUserIds: [],
            number: await UserStateDao.builder().queryInRoomCount(),
            dataType: ONLINE_DATA_TYPE.IN_ROOM,
            changeType: DATA_CHANGE_TYPE.SET,
        });

        await this.save2Redis({
            changeUserIds: [],
            number: await BattleDao.builder().selectCount({roomStatus: ROOM_STATUS.BATTLE}),
            dataType: ONLINE_DATA_TYPE.BATTLE,
            changeType: DATA_CHANGE_TYPE.SET,
        });
    }

    /**
     * 更新在线数据
     * @param ops
     */
    updateOnlineCount = async (ops: UpdateOnlineCountOptions | UpdateOnlineCountOptions[]) => {
        const execOps = Array.isArray(ops) ? ops : [ops];
        for (let param of execOps) {
            await this.save2Redis(param);
        }
    }

    /**
     * 根据类型获取在线数量
     */
    getCountByType = async (dataType: ONLINE_DATA_TYPE): Promise<Number> => {
        const cacheKey = `${REDIS_KEYS.ONLINE_DATA_CACHE_KEY}:${dataType}`;
        const countStr = await redisUtils.getStr(cacheKey);
        return countStr?.length ? Number(countStr) : 0;
    }

    /**
     * 发送在线用户数据(全量)
     * @param socket
     * @param userId
     */
    @Log()
    async sendOnlineUserList(socket: any, userId: string) {
        const log = global.logUtils.getArgsLogger(arguments);
        log.info(`[${userId}]准备下发在线用户数据`);

        const userList: any = await UserStateDao.builder().getOnlineUserList(userId);
        // 组装数据
        const resultDataList: any = [];
        userList.map((user: any) => {
            const userInfo = constUtils.buildUserOnlineInfo(user);
            const onlineUser = {
                userId: user.userId,
                roomId: user.roomId,
                battleId: user.battleId,
                userName: user.userName,
                // 积分
                score: user.score,
                // 用户头像
                iconUrl: user.iconUrl,
                // 当前用户的状态及名称
                status: userInfo.status,
                statusName: userInfo.statusName,
                // 胜率(一个整数)
                sucPercentage: userInfo.sucPercentage,
                // 其它内容描述
                extendStr: userInfo.extendStr,
            }
            resultDataList.push(onlineUser);
        })
        log.info(`下发的数据为：`, resultDataList);

        socket.emit('onlineUserListRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '请求成功',
            data: resultDataList
        }))
    }
}

export default OnlineUtils;