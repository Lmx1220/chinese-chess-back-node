import DatabaseUtils from "../utils/db-utils";
import BasicDao from "./basic-dao";
import VersionVo from "../model/do/version-vo";
import VersionDo from "../model/do/version-vo";

class VersionDao extends BasicDao<VersionVo, VersionDo> {

    private static instance: any = null;

    static builder(): VersionDao {
        if (!VersionDao.instance) {
            VersionDao.instance = new VersionDao();
        }

        return VersionDao.instance;
    }

    getColumns(): string[] {
        // 'id',
        return ['version_id', 'online_time', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_version";
    }

    /**
     * 获取当前发行的版本号
     */
    static getClientVersion = async () => {
        const sql = `select version_id as versionId
                     from t_version
                     order by online_time desc
                     limit 1`;
        const params: any[] = [];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows && rows.length === 0 ? null : rows[0].versionId;
    };

    /**
     * 获取当前版本详情
     */
    static getVersionIdDetailList = async (versionId?: string) => {
        // 获取当前所有的版本内容
        const versionDetailSql = `select version_id as versionId, change_type as changeType, content, sort, style
                                  from t_version_detail
                                  where version_id = ?`;
        const versionDetailRows: any = await DatabaseUtils.execSql(versionDetailSql, [versionId]);


        return versionDetailRows;
    }
    /**
     * 获取版本详情
     */
    static getVersionDetailList = async () => {

        // 获取当前所有的版本
        const versionSql = `select version_id as versionId, DATE_FORMAT(online_time, '%Y-%m-%d') as onlineTime
                            from t_version
                            order by online_time desc`;
        const versionRows: any = await DatabaseUtils.execSql(versionSql, []);
        // 获取当前所有的版本内容
        const versionDetailSql = `select version_id as versionId, change_type as changeType, content, sort, style
                                  from t_version_detail`;
        const versionDetailRows: any = await DatabaseUtils.execSql(versionDetailSql, []);

        const result: any = [];
        for (let row of versionRows) {
            const {versionId, onlineTime} = row;
            const eventList = versionDetailRows.filter((detail: any) => detail.versionId === versionId).sort();
            result.push({
                version: versionId,
                date: onlineTime,
                event: eventList
            })
        }

        return result;
    }

}

export default VersionDao;
