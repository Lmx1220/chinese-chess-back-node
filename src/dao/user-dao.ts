import DatabaseUtils from "../utils/db-utils";
import {BOOLEAN} from "../configs/enums";
import BasicDao from "./basic-dao";
import UserVo from "../model/vo/user-vo";
import UserDo from "../model/do/user-do";

class UserDao extends BasicDao<UserVo, UserDo>{

    private static instance: any = null;

    static builder(): UserDao {
        if (!UserDao.instance) {
            UserDao.instance = new UserDao();
        }

        return UserDao.instance;
    }

    getColumns(): string[] {
        return ['user_id', 'user_name', 'password', 'icon_url', 'email', 'user_type', 'score', 'pk_total_count', 'pk_win_count',
            'pk_fail_count', 'pk_peace_count', 'pk_offline_count', 'ip', 'finger', 'ticket', 'data_status', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_user";
    }

    /**
     * 根据用户Id获取用户详情
     * @param userId
     */
    static getUserByPrimaryKey = async (userId: string) => {
        const sql = `select user_id as userId, user_name as userName, password, email, user_type as userType, icon_url as iconUrl,
                        score, pk_total_count as pkTotalCount, pk_win_count as pkWinCount, pk_fail_count as pkFailCount,
                        pk_peace_count as pkPeaceCount, pk_offline_count as pkOfflineCount, ip, finger, ticket, data_status
                      from t_user where user_id = ?`;
        const params = [userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        // 有且只有一条数据
        return rows.length === 0 ? null : rows[0];
    }

    /**
     * 创建用户
     * @param userId
     * @param password
     * @param userName
     * @param email
     * @param userType
     * @param ticket
     * @param finger
     * @param ipAddress
     */
    createUser = async (userId: string, password: string, userName: string, email: string | null,
                               userType: string, ticket: string | null, finger: string, ipAddress: string) => {
        // 注册用户信息
        const sql = `insert into t_user(user_id,password,email,user_type,score,pk_total_count,pk_win_count, 
                            pk_offline_count, pk_fail_count, pk_peace_count, finger, ip, ticket, user_name, data_status) 
                     values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        const params = [userId, password, email, userType, 1000, 0, 0, 0, 0, 0, finger, ipAddress, ticket, userName, BOOLEAN.SHORT_YES];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };

    /**
     * 根据userId查询排名
     * @param userId
     */
    static getScoreSortByUserId = async (userId: string) => {
        const sql = ` select s.scoreSort as total from t_user a
            left join (select @rowNum := @rowNum + 1 AS scoreSort, u.user_id as userId
                         FROM t_user u, (select @rowNum := 0) as r
                        where u.pk_total_count > 0 order by u.score desc, u.pk_win_count desc) s on a.user_id = s.userId
            where a.user_id = ?`;
        const params = [userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length > 0 ? rows[0].total : null;
    }

    /**
     * 更新用户数据
     * @param userId
     * @param score
     * @param pkTotalCount
     * @param pkWinCount
     * @param pkOfflineCount
     * @param pkFailCount
     * @param pkPeaceCount
     * @return {Promise<boolean>}
     */
    static updateUser = async (userId: string, score: number, pkTotalCount: number, pkWinCount: number,
                               pkOfflineCount: number, pkFailCount: number, pkPeaceCount: number) => {
        const sql = 'update t_user set score = ?, pk_total_count = ?, pk_win_count = ?, pk_offline_count = ?, pk_fail_count = ?, pk_peace_count = ? where user_id = ?';
        const params: any[] = [score, pkTotalCount, pkWinCount, pkOfflineCount, pkFailCount, pkPeaceCount, userId];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };
}
export default UserDao;
