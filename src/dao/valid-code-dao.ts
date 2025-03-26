import BasicDao from "./basic-dao";
import ValidCodeVo from "../model/vo/valid-code-vo";
import ValidCodeDo from "../model/do/valid-code-do";
import DatabaseUtils from "../utils/db-utils";
import {BOOLEAN} from "../configs/enums";


class ValidCodeDao extends BasicDao<ValidCodeVo, ValidCodeDo>{

    private static instance: any = null;

    static builder(): ValidCodeDao {
        if (!ValidCodeDao.instance) {
            ValidCodeDao.instance = new ValidCodeDao();
        }

        return ValidCodeDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'user_id', 'email', 'valid_code', 'suffix', 'data_status', 'code_type', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_code";
    }

    /**
     * 获取当天已经发送过的邮件次数
     * @param userId
     * @param to
     * @returns {Promise<null|*>}
     */
    async getTodaySendEmailCount(userId: string, to: string) {
        const sql = `select count(*) as total from t_code where user_id = ? and email = ? 
            and date_format(create_time, '%Y-%m-%d') = date_format(now(), '%Y-%m-%d')`;
        const params = [userId, to];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0 ? null : rows[0].total;
    }

    /**
     * 校验验证码是否合法
     * @param userId
     * @param email
     * @param validCode
     * @param validTimeMinutes
     * @returns {Promise<boolean>}
     */
    async validateEmailAndCode(userId: string, email: string, validCode: string, validTimeMinutes: number): Promise<boolean> {
        const sql = `select valid_code as validCode, data_status as dataStatus from t_code where user_id = ? and email = ?
                                                                                             and timestampdiff(minute, create_time, now()) <= ? order by create_time desc limit 1`;
        const params = [userId, email, validTimeMinutes];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        if (rows.length === 0) {
            return false;
        } else {
            const [data] = rows;
            return data.validCode.toLowerCase() === validCode.toLowerCase() && data.dataStatus === BOOLEAN.SHORT_YES;
        }
    }
    /**
     * 更新验证码的状态
     * @param userId
     * @param email
     * @param validCode
     * @param dataStatus
     * @returns {Promise<boolean>}
     */
    updateValidCodeStatus = async (userId: string, email: string, validCode: string, dataStatus: string): Promise<boolean> => {
        const sql = `update t_code set data_status = ? where user_id = ? and email = ? and valid_code = ?`;
        const params = [dataStatus, userId, email, validCode];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 1;
    }
}

export default ValidCodeDao;
