import BattleUserDao from "../dao/battle-user-dao";
import BattleHistoryDao from "../dao/battle-history-dao";
import {BATTLE, GAME_OVER_TYPE, ROOM_STATUS} from "../configs/enums";
import BattleDao from "../dao/battle-dao";
import * as schedule from "node-schedule";
import RoomUtils from "../utils/room-utils";
import DateUtils from "../utils/date-utils";
import RedLockUtils from "../utils/red-lock-utils";
import {Log} from "../aop/log-aop";
import BasicJob from "./basic-job";

const roomUtils = new RoomUtils();
const dateUtils = new DateUtils();

declare interface BattleDataParam {
    // 是否红棋落子
    isRedMove: boolean,
}

declare interface TimeUserDataParam {
    // 用户账号
    userId: string,
    // 局时
    allTime: number,
    // 步时
    stepTime: number,
    // 是否先手
    first: boolean,
    // 房间号
    roomId: string,
    // 是否红棋落子
    isRedMove: boolean,
}

class BattleTimeJob implements BasicJob {
    private cron: string = '0/1 * * * * ?';
    // key: battleId
    private timeUserData: any = new Map<String, TimeUserDataParam>();
    // key: battleId
    private battleData: any = new Map<String, BattleDataParam>();


    exec(params?: Map<string, object>): boolean {
        this.initResource();
        // 玩家对局超时倒计时
        schedule.scheduleJob(this.cron, () => this.doAction());
        return false;
    }

    /**
     * 系统启动时的相关数据放此处加载
     * 服务器重启后需要恢复的数据
     */
    @Log()
    private initResource() {
        const log = global.logUtils.getArgsLogger(arguments);
        BattleDao.builder().select({roomStatus: ROOM_STATUS.BATTLE})
            .then((battleData: any) => {
                if (battleData && battleData.length > 0) {
                    log.info(`本次初始化共需要恢复${battleData.length}条数据`);
                    for (let battle of battleData) {
                        if (!this.timeUserData.has(battle.id)) {
                            log.info(`开始恢复对战房间[${battle.id}]的数据`);
                            this.createBattleUserTime(battle.id)
                                .then(() => log.info(`对战房间[${battle.id}]的数据已恢复`));
                        }
                    }
                } else {
                    log.info(`本次初始化不需要恢复数据`);
                }
            });
    }

    /**
     * 初始化定时任务
     */
    private async doAction() {
        global.logUtils.createTraceId();
        const log = global.logUtils.createContext('BattleTimeJob', '定时任务(对局超时)');
        if (this.timeUserData.size) {
            for (let [battleId, userList] of this.timeUserData) {
                // 进行结算
                const [playOne, playTwo] = userList;
                // 拿最新的落子方(任意一方的数据即可)
                const {isRedMove} = this.battleData.get(battleId) || {};
                if (typeof isRedMove === 'boolean') {
                    // 判断出当前的计时方
                    const user = playOne.first === isRedMove ? playOne : playTwo;
                    if (user.stepTime >= 0 || user.allTime >= 0) {
                        // 步时
                        user.stepTime > 0 && (user.stepTime = user.stepTime - 1);
                        // 局时读尽时步时改成读秒
                        user.allTime === 1 && (user.stepTime = BATTLE.READ_SECONDS);
                        user.allTime > 0 && (user.allTime = user.allTime - 1);
                        // 步时超时后结算
                        if (user.stepTime <= 0) {
                            log.info(`[${battleId}]用户[${user.userId}]超时数据为`, user);
                            // 更新数据库对战状态
                            await BattleDao.builder().updateSelective({roomStatus: ROOM_STATUS.TIMEOUT}, {id: battleId});

                            // 清除倒计时
                            this.timeUserData.delete(battleId);
                            let lock = await RedLockUtils.acquire([battleId]);
                            try {
                                log.info(`对战区[${battleId}]用户[${user.userId}]所在的房间[${user.roomId}]读秒超时`);
                                // 对游戏进行结算
                                await roomUtils.handleGameResult(battleId, user.userId, user.roomId, GAME_OVER_TYPE.USER_TIMEOUT);
                            } finally {
                                await lock.release();
                            }
                        }
                    }
                } else {
                    this.timeUserData.delete(battleId);
                    log.info(`对战区[${battleId}]房间内的用户已提前离开`);
                }
            }
        }
        global.logUtils.destroyContext();
    }

    /**
     * 创建倒计时数据
     * @param battleId
     * @returns {Promise<boolean>}
     */
    @Log()
    async createBattleUserTime(battleId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {battleId});
        log.info(`开始为对战区[${battleId}]创建倒计时数据`);
        const timeUsers = await this.handleBattleTimeList(battleId);
        if (timeUsers.length) {
            const [playOne] = timeUsers;
            // 创建计时数据
            this.timeUserData.set(battleId, timeUsers);
            // 创建对战数据
            this.battleData.set(battleId, {isRedMove: playOne.isRedMove});
            log.info(`对战区[${battleId}]对局倒计时数据已创建`, timeUsers);
        } else {
            log.info(`对战区[${battleId}]无历史对局数据`);
        }
    };

    /**
     * 更新对战的相关数据
     * 1.移动棋子后需要更新
     * 2.悔棋同意需要更新
     * 3.新建对局数据需要更新
     */
    updateBattleData = (battleId: string, data: BattleDataParam) => {
        if (this.battleData.has(battleId)) {
            // 判断对战数据是否存在
            const historyData = this.battleData.get(battleId) || {};
            this.battleData.set(battleId, {...historyData, ...data});
        } else if (this.timeUserData.has(battleId)) {
            // 如果对局数据不存在，判断该对战是否有倒计时(有则新建)
            this.battleData.set(battleId, data);
        }
    }

    /**
     * 获取对战计时数据
     * @param battleId
     */
    getBattleTimeList = async (battleId: string): Promise<TimeUserDataParam[]> => {
        const dataList = this.timeUserData.get(battleId) || [];
        // 没有值时，从数据库查询数据并计算时间
        return dataList.length ? dataList : (await this.handleBattleTimeList(battleId));
    }

    /**
     * 获取对战时间列表（内部方法）
     * @param battleId
     */
    @Log()
    private async handleBattleTimeList(battleId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {battleId});
        // 查询对战的用户
        const battleUserRows: any = await BattleUserDao.builder().select({battleId});
        if (battleUserRows.length) {
            const [playOne, playTwo] = battleUserRows;
            // log.debug(`对战用户数据为：`, battleUserRows);
            // 对战历史数据
            const battleHistoryRows: any = await BattleHistoryDao.builder().getLastBattleHistory(battleId);
            if (battleHistoryRows.length) {
                // log.debug(`对战历史数据为：`, battleHistoryRows);

                const playOneHistory = battleHistoryRows.find((user: any) => user.userId === playOne.userId);
                const playTwoHistory = battleHistoryRows.find((user: any) => user.userId === playTwo.userId);
                // 计时数据
                const playOneBattleTime = this.battleTimeCalc(playOne, playOneHistory);
                const playTwoBattleTime = this.battleTimeCalc(playTwo, playTwoHistory);
                // log.debug(`双方的计时数据：`, playOneBattleTime, playTwoBattleTime);

                const timeUsers = new Array<TimeUserDataParam>();
                timeUsers.push({
                    userId: playOne.userId,
                    first: playOne.first,
                    roomId: playOne.roomId,
                    allTime: playOneBattleTime.allTime,
                    stepTime: playOneBattleTime.stepTime,
                    isRedMove: playTwoHistory.isRedMove,
                });
                timeUsers.push({
                    userId: playTwo.userId,
                    first: playTwo.first,
                    roomId: playOne.roomId,
                    allTime: playTwoBattleTime.allTime,
                    stepTime: playTwoBattleTime.stepTime,
                    isRedMove: playTwoHistory.isRedMove,
                });
                // log.debug(`对战区[${battleId}]检索到计时数据：`, timeUsers);
                return timeUsers;
            } else {
                log.warn(`对战区[${battleId}]无对战历史数据，请检查`);
            }
        } else {
            log.warn(`对战区[${battleId}]无对战用户数据，请检查`);
        }
        return [];
    }

    /**
     * 计算对战时间的时间差
     * @param battleUser
     * @param battleHistory
     */
    battleTimeCalc = (battleUser: any, battleHistory: any) => {
        let {allTime, stepTime, isRedMove} = battleHistory;
        let {moveChessTime, first} = battleUser;
        if (isRedMove === first) {
            // 上一次走棋的时间
            moveChessTime = dateUtils.strToDate(moveChessTime);

            // 计算时间差(单位：秒)
            const timeSeconds = dateUtils.dateDiffSeconds(moveChessTime, new Date());
            // 如果局时超了，则需要进一步计算读秒的数据
            if (allTime - timeSeconds < 0) {
                const overStepTime = timeSeconds - allTime;
                return {allTime: 0, stepTime: BATTLE.READ_SECONDS - overStepTime};
            }
            return {allTime: allTime - timeSeconds, stepTime: stepTime - timeSeconds};
        }
        // 非当前用户计时，按默认时间返回
        return {allTime, stepTime: allTime <= 0 ? BATTLE.READ_SECONDS : BATTLE.STEP_TIME_SECONDS};
    }

    /**
     * 移除对战倒计时
     * @param battleId
     */
    deleteBattleTimeData = (battleId: string) => {
        // 清除对战数据
        this.battleData.delete(battleId);
        // 清除计时数据
        this.timeUserData.delete(battleId);
    }

    /**
     * 重置某个对战房间的步时
     * @param battleId
     * @param userId
     */
    resetBattleStepTime = (battleId: string, userId: string) => {
        const userList = this.timeUserData.get(battleId) || [];
        if (userList.length) {
            const user = userList.find((user: any) => user.userId === userId);
            // 判断步时（是否需要进入读秒）
            user.stepTime = user.allTime <= 0 ? BATTLE.READ_SECONDS : BATTLE.STEP_TIME_SECONDS;
            this.timeUserData.set(battleId, userList);
        }
    }

    /**
     * 悔棋后重置某个对战区的时间
     * @param battleId
     * @param user
     * @param enemy
     */
    backMoveResetBattleTime = (battleId: string, user: any, enemy: any) => {
        const userList = this.timeUserData.get(battleId) || [];
        if (userList.length) {
            // 我方数据
            const timeUser = userList.find((item: any) => item.userId === user.userId);
            timeUser.stepTime = user.stepTime;
            timeUser.allTime = user.allTime;
            // 对方数据
            const timeEnemy = userList.find((item: any) => item.userId === enemy.userId);
            timeEnemy.stepTime = enemy.stepTime;
            timeEnemy.allTime = enemy.allTime;
            // 调整数据
            this.timeUserData.set(battleId, userList);
        }
    }
}


export default BattleTimeJob;