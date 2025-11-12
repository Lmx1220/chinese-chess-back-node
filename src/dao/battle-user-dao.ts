import DatabaseUtils from "../utils/db-utils";
import RedisUtils from "../utils/redis-utils";
import DateUtils from "../utils/date-utils";
import RestException from "../exception/rest-exception";
import {BATTLE, BOOLEAN, REDIS_KEYS, ROOM_STATUS} from "../configs/enums";
import BasicDao from "./basic-dao";
import BattleUserVo from "../model/vo/battle-user-vo";
import BattleUserDo from "../model/do/battle-user-do";

const redisUtils = new RedisUtils();
const dateUtils = new DateUtils();

class BattleUserDao extends BasicDao<BattleUserVo, BattleUserDo> {

    private static instance: any = null;

    static builder(): BattleUserDao {
        if (!BattleUserDao.instance) {
            BattleUserDao.instance = new BattleUserDao();
        }

        return BattleUserDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'room_id', 'battle_id', 'user_id', 'user_name', 'enemy_id', 'enemy_name', 'first', 'change_score', 'action_time',
            'user_page', 'user_status', 'move_chess_time', 'offline_time', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_battle_user";
    }

    /**
     * 更新对战用户表的数据
     * @param battleId
     * @param userId
     * @param score
     * @return {Promise<boolean>}
     */
    static updateBattleUserResult = async (battleId: string, userId: string, score: number) => {
        const sql = `update t_battle_user
                     set change_score = ?
                     where battle_id = ?
                       and user_id = ?`;
        const params = [score, battleId, userId];
        const results: any = await DatabaseUtils.execSql(sql, params);
        return results.length === 1;
    };

    /**
     * 更新对战用户的离线时间
     * @param battleId
     * @param userId
     * @param roomId
     * @param offlineTime
     */
    updateBattleUserOfflineTime = async (battleId: string, userId: string, roomId: string, offlineTime: Date | null) => {
        const sql = `update t_battle_user
                     set offline_time = ?
                     where battle_id = ?
                       and user_id = ?`;
        const params = [offlineTime, battleId, userId];
        await DatabaseUtils.execSql(sql, params);

        const redisUserKey = `${REDIS_KEYS.USER_OFFLINE_BATTLE_CHANGE_KEY}:${userId}`;

        // 快速检索的key
        // const battleOfflineKeys = await redisUtils.getStr(redisKey);
        // 存储数据的key
        // const redisKey = `${REDIS_KEYS.BATTLE_OFFLINE_KEY}:${battleId}:${userId}`;
        if (offlineTime) {
            const jsonValue = JSON.stringify({
                battleId: battleId,
                userId: userId,
                roomId: roomId,
                offlineTime: offlineTime.getTime()
            });
            // const result = await redisUtils.setStr(redisKey, jsonValue, BATTLE.OFFLINE_TIME_SECONDS * 2 * 1000);
            // if (BOOLEAN.YES === result) {
            // 将本key记录到一个列表中，用于快速检索
            // const battleOfflineKeyArray: string[] = battleOfflineKeys ? JSON.parse(battleOfflineKeys) : [];
            // battleOfflineKeyArray.push(redisKey);
            await redisUtils.setStr(redisUserKey, jsonValue, BATTLE.DISCONNECT_TIME_SECONDS * 1000);
            // } else {
            //     throw new RestException('对战离线时间写入缓存失败');
            // }
        } else {
            // 删除缓存(因为循环依赖的问题，此处不调用battleUtils.clearBattleCache方法)
            // await redisUtils.delete(redisKey);
            // await redisUtils.delete(redisUserKey);
            await redisUtils.setStr(redisUserKey, '', BATTLE.DISCONNECT_TIME_SECONDS * 1000);
        }
        return true;
    }

    /**
     * 查询已离线并超时的用户
     * @param timeoutSeconds 超时时间（单位：秒）
     */
    getOfflineTimeoutUser = async (timeoutSeconds: number): Promise<any[]> => {
        // 全权从缓存查数据，若缓存查询失败才降级从DB查
        try {
            const timeoutMilliseconds = timeoutSeconds * 1000;

            const redisUserKey = `${REDIS_KEYS.USER_OFFLINE_BATTLE_CHANGE_KEY}:*`;

            // 快速检索的key
            const battleOfflines = await redisUtils.getScanStr(redisUserKey);
            // // 缓存中无数据，直接返回
            if (!battleOfflines || battleOfflines.length === 0) {
                return [];
            }
            const resultList: any[] = [];
            // 遍历数据
            for (let battleOfflineKey of battleOfflines) {
                // 获取缓存数据并做判断
                if (battleOfflineKey) {
                    const cacheValue = JSON.parse(battleOfflineKey);
                    if (dateUtils.dateDiffMilliseconds(cacheValue.offlineTime, new Date().getTime()) >= timeoutMilliseconds) {
                        resultList.push(cacheValue);
                    }
                }
            }
            return resultList
        } catch (e) {
            console.error(e)
            const sql = `select battle_id as battleId, user_id as userId, room_id as roomId
                         from t_battle_user
                         where TIMESTAMPDIFF(second, offline_time, now()) >= ?`;
            const params = [timeoutSeconds];
            return await DatabaseUtils.execSql(sql, params);
        }
    };

    /**
     * 分页获取数据
     * @param userId
     * @param pageNum
     * @param pageSize
     * @returns {Promise<{dataTotal: (number|*), list: []}|{dataTotal: (number|*), list: []}>}
     */
    static getBattleReviewListByPage = async (userId: string, pageNum: number, pageSize: number) => {
        // 对局在两步之内不计输赢，但历史表每局会包含一条开局的棋盘信息
        const maxHistoryCount = 3;
        const totalSql = `select count(*) as total
                          from t_battle_user a
                          where a.user_id = ?
                            and (select count(*)
                                 from t_battle_map_history b
                                 where b.battle_id = a.battle_id
                                   and b.user_id = a.user_id) > ?`;
        const params = [userId, maxHistoryCount];
        const rows: any = await DatabaseUtils.execSql(totalSql, params);
        const dataTotal = rows && rows.length === 0 ? 0 : rows[0].total;
        if (dataTotal === 0) {
            return {dataTotal: dataTotal, list: []};
        } else {
            const sql = `
                select a.id                                         as battleId,
                       b.change_score                               as changeScore,
                       IF(b.first = 1, b.user_id, b.enemy_id)       as firstUserId,
                       IF(b.first = 1, b.user_name, b.enemy_name)   as firstUserName,
                       IF(b.first = 0, b.user_id, b.enemy_id)       as lastUserId,
                       IF(b.first = 0, b.user_name, b.enemy_name)   as lastUserName,
                       a.win_code                                   as winCode,
                       a.win_user_id                                as winUserId,
                       date_format(a.create_time, '%Y-%m-%d %H:%i') as createTime,
                       (case win_code
                            when '0000' then '困毙'
                            when '0001' then '绝杀'
                            when '0002' then '认输'
                            when '0003' then '逃跑'
                            when '0004' then '超时'
                            when '0005' then '双方议和'
                            else '无进攻棋子(判和)' end)            as winCodeName,
                       (case
                            when win_user_id = b.user_id then '胜利'
                            when win_user_id != b.user_id then '失败'
                            else '和棋' end)                        as resultMsg,
                       b.first                                      as first
                from t_battle a
                         left join t_battle_user b on a.id = b.battle_id
                where b.user_id = ?
                  and
                    (select count(*) from t_battle_map_history c where c.battle_id = a.id and b.user_id = c.user_id) > ?
                order by a.create_time desc
                limit ?, ?`;
            const params = [userId, maxHistoryCount, ((pageNum - 1) * pageSize), pageSize];
            return {dataTotal: dataTotal, list: await DatabaseUtils.execSql(sql, params)};
        }
    };

    /**
     * 获取分享的对战详情
     * @param battleId
     * @param userId
     */
    static getShareBattleDetail = async (battleId: string, userId: string) => {
        const sql = `
            select a.id                                         as battleId,
                   b.change_score                               as changeScore,
                   IF(b.first = 1, b.user_id, b.enemy_id)       as firstUserId,
                   IF(b.first = 1, b.user_name, b.enemy_name)   as firstUserName,
                   IF(b.first = 0, b.user_id, b.enemy_id)       as lastUserId,
                   IF(b.first = 0, b.user_name, b.enemy_name)   as lastUserName,
                   a.win_code                                   as winCode,
                   a.win_user_id                                as winUserId,
                   date_format(a.create_time, '%Y-%m-%d %H:%i') as createTime,
                   (case win_code
                        when '0000' then '困毙'
                        when '0001' then '绝杀'
                        when '0002' then '认输'
                        when '0003' then '逃跑'
                        when '0004' then '超时'
                        when '0005' then '双方议和'
                        else '无进攻棋子(判和)' end)            as winCodeName,
                   (case
                        when win_user_id = b.user_id then '胜利'
                        when win_user_id != b.user_id then '失败'
                        else '和棋' end)                        as resultMsg,
                   b.first                                      as first
            from t_battle a
                     left join t_battle_user b on a.id = b.battle_id
            where a.id = ?
              and b.user_id = ?`;
        const params = [battleId, userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length == 0 ? null : rows[0];
    }

    /**
     * 检查落子方是否正确
     * @param userId
     * @param battleId
     * @returns {Promise<boolean>}
     */
    static checkMoveUser = async (userId: string, battleId: string) => {
        const sql = `select (select count(*)
                             from t_battle
                             where id = a.battle_id
                               and curr_is_red_move = a.first) as total
                     from t_battle_user a
                     where battle_id = ?
                       and user_id = ?`;
        const params = [battleId, userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0 ? false : rows[0].total === 1;
    }

    /**
     * 分页查询观战数据
     * @param pageNum
     * @param pageSize
     */
    allWatchListByPage = async (pageNum: number, pageSize: number) => {
        const sql = `select count(*) as total
                     from t_battle
                     where room_status = ?`;
        const params = [ROOM_STATUS.BATTLE];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        const dataTotal = rows.length === 0 ? 0 : rows[0].total;
        if (dataTotal === 0) {
            return {dataTotal: 0, list: []};
        } else {
            // 分页查询数据
            const pageSql = `select id
                             from t_battle
                             where room_status = ?
                             limit ?, ?`;
            const pageParams = [ROOM_STATUS.BATTLE, ((pageNum - 1) * pageSize), pageSize];
            const pageRows: any = await DatabaseUtils.execSql(pageSql, pageParams);
            if (pageRows.length === 0) {
                return {dataTotal: 0, list: []};
            } else {
                // 查询详情
                const battleIds: any = [];
                pageRows.map((item: any) => battleIds.push(item.id));
                const sql = `select a.battle_id as battleId,
                                    a.room_id   as roomId,
                                    a.user_id   as userId,
                                    b.user_name as userName,
                                    b.icon_url  as iconUrl,
                                    b.score,
                                    a.first
                             from t_battle_user a
                                      left join t_user b on a.user_id = b.user_id
                             where FIND_IN_SET(a.battle_id, ?)
                             order by a.battle_id desc`;
                const rows: any = await DatabaseUtils.execSql(sql, [battleIds.join(',')]);
                const list: any[] = [];
                battleIds.map((battleId: string) => {
                    const battleUsers = rows.filter((item: any) => item.battleId === battleId);
                    if (battleUsers.length !== 2) {
                        // await  logUtils.log('allWatchList', `观战列表数据错误, ${battleId}`, battleUsers);
                    } else {
                        const [playOne, playTwo] = battleUsers;
                        // 区分先后手
                        list.push({
                            roomId: playOne.roomId,
                            userId: playOne.first ? playOne.userId : playTwo.userId,
                            userName: playOne.first ? playOne.userName : playTwo.userName,
                            userFirst: playOne.first,
                            userScore: playOne.first ? playOne.score : playTwo.score,
                            userIcon: playOne.first ? playOne.iconUrl : playTwo.iconUrl,
                            enemyId: playOne.first ? playTwo.userId : playOne.userId,
                            enemyName: playOne.first ? playTwo.userName : playOne.userName,
                            enemyFirst: !playOne.first,
                            enemyScore: playOne.first ? playTwo.score : playOne.score,
                            enemyIcon: playOne.first ? playTwo.iconUrl : playOne.iconUrl,
                        });
                    }
                });
                // await  logUtils.log('allWatchList', `当前观战列表的数据为：`, list);
                return {dataTotal: dataTotal, list: list};
            }
        }
    };

    async getBattleReviewListByPage(userId: string, pageNum: number, pageSize: number) {
        // 对局在两步之内不计输赢，但历史表每局会包含一条开局的棋盘信息
        const maxHistoryCount = 3;
        const totalSql = `select count(*) as total
                          from t_battle_user a
                          where a.user_id = ?
                            and (select count(*)
                                 from t_battle_map_history b
                                 where b.battle_id = a.battle_id
                                   and b.user_id = a.user_id) > ?`;
        const params = [userId, maxHistoryCount];
        const rows: any = await DatabaseUtils.execSql(totalSql, params);
        const dataTotal = rows && rows.length === 0 ? 0 : rows[0].total;
        if (dataTotal === 0) {
            return {dataTotal: dataTotal, list: []};
        } else {
            const sql = `
                select a.id                                         as battleId,
                       b.change_score                               as changeScore,
                       IF(b.first = 1, b.user_id, b.enemy_id)       as firstUserId,
                       IF(b.first = 1, b.user_name, b.enemy_name)   as firstUserName,
                       IF(b.first = 0, b.user_id, b.enemy_id)       as lastUserId,
                       IF(b.first = 0, b.user_name, b.enemy_name)   as lastUserName,
                       a.win_code                                   as winCode,
                       a.win_user_id                                as winUserId,
                       date_format(a.create_time, '%Y-%m-%d %H:%i') as createTime,
                       (case win_code
                            when '0000' then '困毙'
                            when '0001' then '绝杀'
                            when '0002' then '认输'
                            when '0003' then '逃跑'
                            when '0004' then '超时'
                            when '0005' then '双方议和'
                            else '无进攻棋子(判和)' end)            as winCodeName,
                       (case
                            when win_user_id = b.user_id then '胜利'
                            when win_user_id != b.user_id then '失败'
                            else '和棋' end)                        as resultMsg,
                       b.first                                      as first
                from t_battle a
                         left join t_battle_user b on a.id = b.battle_id
                where b.user_id = ?
                  and
                    (select count(*) from t_battle_map_history c where c.battle_id = a.id and b.user_id = c.user_id) > ?
                order by a.create_time desc
                limit ?, ?`;
            const params = [userId, maxHistoryCount, ((pageNum - 1) * pageSize), pageSize];
            return {dataTotal: dataTotal, list: await DatabaseUtils.execSql(sql, params)};
        }
    }
}

export default BattleUserDao;
