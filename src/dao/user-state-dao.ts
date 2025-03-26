import DatabaseUtils from "../utils/db-utils";
import BasicDao from "./basic-dao";
import UserStateVo from "../model/vo/user-state-vo";
import UserStateDo from "../model/do/user-state-do";
import {BATTLE, BOOLEAN, PAGE_STATUS, USER_STATUS} from "../configs/enums";

class UserStateDao extends BasicDao<UserStateVo, UserStateDo> {

    private static instance: any = null;

    static builder(): UserStateDao {
        if (!UserStateDao.instance) {
            UserStateDao.instance = new UserStateDao();
        }

        return UserStateDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'user_id', 'token', 'user_page', 'is_room_admin', 'room_id', 'first',
            'join_type', 'room_status', 'lock_pass', 'is_ready', 'battle_id', 'user_status', 'disconnect_time', 'action_time', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_user_state";
    }

    /**
     * 根据用户Id查询游离数据
     * @param userId
     */
    static getUserStateByUserId = async (userId: string) => {
        const sql = `select id,
                            user_id         as userId,
                            disconnect_time as disconnectTime,
                            user_page       as userPage,
                            room_id         as roomId,
                            join_type       as joinType,
                            token,
                            first,
                            room_status     as roomStatus,
                            is_ready        as isReady,
                            battle_id       as battleId,
                            user_status     as userStatus,
                            is_room_admin   as isRoomAdmin,
                            lock_pass       as lockPass
                     from t_user_state
                     where user_id = ?`;
        const params = [userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        // 有且只有一条数据
        return rows.length === 0 ? null : rows[0];
    }

    async checkTokenExists(token: string) {
        const sql = `select count(1) as count
                     from t_user_state
                     where token = ?`;
        const params = [token];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows[0].count > 0;
    }

    /**
     * 查询房间信息
     * @param roomId
     * @returns {Promise<void>}
     */
    getRoomData = async (roomId: string) => {
        const sql = `
            select a.id                                        as id,
                   a.user_id                                   as userId,
                   a.token                                     as token,
                   b.user_name                                 as userName,
                   a.user_page                                 as userPage,
                   a.room_id                                   as roomId,
                   a.room_status                               as roomStatus,
                   a.is_ready                                  as isReady,
                   a.battle_id                                 as battleId,
                   a.user_status                               as userStatus,
                   b.score                                     as score,
                   a.first                                     as first,
                   b.pk_total_count                            as pkTotalCount,
                   b.pk_offline_count                          as pkOfflineCount,
                   b.pk_win_count                              as pkWinCount,
                   b.user_type                                 as userType,
                   b.user_type                                 as userType,
--                  b.icon_type as iconType,
                   b.icon_url                                  as iconUrl,
                   a.lock_pass                                 as lockPass,
                   a.is_room_admin                             as isRoomAdmin,
                   IF(a.disconnect_time IS NOT NULL, 'Y', 'N') as isOffline
            from t_user_state a
                     left join t_user b on a.user_id = b.user_id
            where a.room_id = ?
              and (user_status is null or user_status <> ?)
        `;
        const params = [roomId, USER_STATUS.WATCH];
        const userRows: any = await DatabaseUtils.execSql(sql, params);
        // 处理下图片的地址
        userRows.forEach((user: any) => {
            user.isOffline = BOOLEAN.SHORT_YES === user.isOffline;
        });
        return userRows;
    };
    /**
     * 创建游离数据
     * @param userId
     * @param token
     */
    static createUserState = async (userId: string, token: string) => {
        const sql = `insert into t_user_state(user_id, user_page, user_status, token)
                     values (?, ?, ?, ?)`;
        const params = [userId, PAGE_STATUS.PLATFORM, USER_STATUS.PLATFORM, token];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };

    /**
     * 查询在线人数
     * 统计条件：在房间中等待的用户
     */
    static queryOnlineCount = async () => {
        const sql = `select count(*) as total
                     from t_user_state
                     where room_status is not null
                       and (user_status is null or user_status <> ?)`;
        const rows: any = await DatabaseUtils.execSql(sql, [USER_STATUS.WATCH]);
        return rows.length == 0 ? 0 : rows[0].total;
    }
    /**
     * 统计房间认输
     * @param roomId
     */
     queryRoomCount = async (roomId:string) => {
        const sql = `select count(*) as total
                     from t_user_state
                     where room_id = ? and room_status is not null
                       and (user_status is null or user_status <> ?)`;
        const rows: any = await DatabaseUtils.execSql(sql, [roomId,USER_STATUS.WATCH]);
        return rows.length == 0 ? 0 : rows[0].total;
    }
    /**
     * 查询观战列表
     * @param roomId
     */
    queryWatchCount = async (roomId:string) => {
        const sql = `select u.user_id AS userId, u.user_name AS userName
                     from t_user_state us
                              left join t_user u on us.user_id = u.user_id
                     where us.room_id = ? and  us.user_status= ?`;
        const rows: any = await DatabaseUtils.execSql(sql, [roomId,USER_STATUS.WATCH]);
        return rows.length == 0 ? [] : rows;
    }


    /**
     * 查询数据库的房间信息
     * @param userId
     * @param historyRoomIds 历史加入过的房间列表
     * @param roomStatus
     */
    queryValidRooms = async (userId: string, historyRoomIds: string[], roomStatus: string) => {
        const roomIdNotInValue = historyRoomIds.length ? historyRoomIds.join(',') : '0';
        const sql = `select b.room_id as roomId, b.lock_pass as lockPass, b.is_room_admin as isRoomAdmin
                     from t_user_state b
                              left join t_user a on a.user_id = b.user_id
                     where b.user_id <> ?
                       and b.room_status = ?
                       and b.room_id not in (${roomIdNotInValue})
                       and b.room_id is not null
                       and b.lock_pass is null
                       and
                         (select count(*) from t_user_state a where a.room_id = b.room_id and a.user_status <> ?) < 2`;
        const params = [userId, roomStatus, USER_STATUS.WATCH];
        return await DatabaseUtils.execSql(sql, params);
    };

    /**
     * 查询已断开服务器超过指定时长的数据
     * @param disconnectTimeSeconds
     * @returns {Promise<void>}
     */
    async getDisconnectTimeUser(disconnectTimeSeconds: number) {
        const sql = `select user_id as userId, room_id as roomId
                     from t_user_state
                     where TIMESTAMPDIFF(second, disconnect_time, now()) >= ?`;
        const params = [disconnectTimeSeconds];
        return await DatabaseUtils.execSql(sql, params);
    }

    /**
     * 查询桌子数据
     * @param userId
     * @param pageNum
     * @param pageSize
     */
    async getRoomListByPage(userId: string, pageNum: number, pageSize: number) {
        const dataTotal = BATTLE.MAX_ROOM;
        // 新房间数据
        const beginRoomId = (pageNum - 1) * pageSize + 1;
        const endRoomId = Math.min(pageNum * pageSize, dataTotal);
        const list: any = [];
        for (let roomId = beginRoomId; roomId <= endRoomId; ++roomId) {
            let user = null, enemy = null;
            const sql = `select a.first          as first,
                                b.pk_total_count as pkTotalCount,
                                b.pk_win_count   as pkWinCount,
                                b.score          as score,
                                a.is_ready       as isReady,
                                a.room_id        as roomId,
                                b.user_id        as userId,
                                b.user_name      as userName,
                                b.icon_url       as iconUrl,
                                a.room_status    as roomStatus,
                                a.is_room_admin  as isRoomAdmin
                         from t_user_state a
                                  left join t_user b on a.user_id = b.user_id
                         where a.room_id = ?
                           and a.room_status is not null
                           and (a.user_status is null or a.user_status <> ?)`;
            const userStateRows: any = await DatabaseUtils.execSql(sql, [roomId, USER_STATUS.WATCH]);
            if (userStateRows.length !== 0) {
                // 获取双方数据
                user = userStateRows.find((user: any) => user.first);
                enemy = userStateRows.find((user: any) => !user.first);
            }
            list.push({roomId: roomId, user: user, enemy: enemy});
        }
        return {dataTotal: dataTotal, list: list};
    }

    async getOnlineUserBy(userId: string) {
        const sql = `select u.user_id          AS userId,
                            u.user_name        AS userName,
                            us.room_id         as roomId,
                            us.battle_id       as battleId,
                            us.user_status     as userStatus,
                            us.room_status     as roomStatus,
                            us.action_time      AS actionTime,
                            u.email,
                            u.user_type        AS userType,
                            u.icon_url         AS iconUrl,
                            u.score,
                            u.pk_total_count   AS pkTotalCount,
                            u.pk_win_count     AS pkWinCount,
                            u.pk_fail_count    AS pkFailCount,
                            u.pk_peace_count   AS pkPeaceCount,
                            u.pk_offline_count AS pkOfflineCount,
                            u.ip,
                            u.finger,
                            u.ticket,
                            u.data_status      AS dataStatus
                     FROM t_user_state us
                              LEFT JOIN t_user u on u.user_id = us.user_id
                     WHERE u.user_id = ? and user_status is not null;`;
        const params = [userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        // 有且只有一条数据
        return !rows || rows.length === 0 ? null : rows[0];
    }

    async queryInRoomCount() {
        const sql = `select count(*) as total
                     from t_user_state
                     where room_status is not null
                       and (user_status is null or user_status <> ?)`;
        const rows: any = await DatabaseUtils.execSql(sql, [USER_STATUS.PLATFORM]);
        return rows.length == 0 ? 0 : rows[0].total;
    }

    async getOnlineUserList(userId: string) {
        const sql = `select u.user_id          AS userId,
                            u.user_name        AS userName,
                            us.room_id         as roomId,
                            us.battle_id       as battleId,
                            us.user_status     as userStatus,
                            us.room_status     as roomStatus,
                            us.action_time      AS actionTime,
                            u.email,
                            u.user_type        AS userType,
                            u.icon_url         AS iconUrl,
                            u.score,
                            u.pk_total_count   AS pkTotalCount,
                            u.pk_win_count     AS pkWinCount,
                            u.pk_fail_count    AS pkFailCount,
                            u.pk_peace_count   AS pkPeaceCount,
                            u.pk_offline_count AS pkOfflineCount,
                            u.ip,
                            u.finger,
                            u.ticket,
                            u.data_status      AS dataStatus
                     FROM t_user_state us 
                              LEFT JOIN t_user u on u.user_id = us.user_id
                     WHERE u.user_id <> ? and user_status is not null`;
        const params = [userId];
        const res = await DatabaseUtils.execSql(sql, params);
        return res && res.length > 0 ? res : [];
    }

    async getLongTimeNotOperate(TOURIST_USER: string, LONG_TIME_NOT_OPERATE_DAYS: number) {
        // 查询游客数据 且 登录时间超过指定天数
        const sql = `select user_id as userId
                     from t_user
                     where user_type = ?
                       and TIMESTAMPDIFF(day, update_time, now()) >= ?`;
        const params = [TOURIST_USER, LONG_TIME_NOT_OPERATE_DAYS];
        return await DatabaseUtils.execSql(sql, params);

    }
}

export default UserStateDao;
