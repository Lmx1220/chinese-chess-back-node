import DatabaseUtils from "../utils/db-utils";
import RestException from "../exception/rest-exception";
import BasicVo from "../model/basic-vo";
import BasicDo from "../model/basic-do";

/**
 * 基层抽象方法
 */
abstract class BasicDao<T extends BasicVo, D extends BasicDo> {

    /**
     * 获取表名
     */
    abstract getTableName(): string;

    /**
     * 获取所有列
     */
    abstract getColumns(): string[];

    /**
     * 计数操作
     * @param where 查询条件
     * @return 返回的数据类型
     */
    async selectCount(where: T): Promise<number> {
        const sqlObj = DatabaseUtils.getDynamicCountObj(this.getTableName(), where);
        const [ result ] = await DatabaseUtils.execSql(sqlObj.sql, sqlObj.params);
        return result ? result.total : 0;
    }

    /**
     * 删除操作
     * @param where
     * @return 返回影响的行数
     */
    async deleteSelective(where: T): Promise<number> {
        const sqlObj = DatabaseUtils.getDynamicDeleteObj(this.getTableName(), where);
        return await DatabaseUtils.execSql(sqlObj.sql, sqlObj.params);
    }

    /**
     * 录入操作
     * @param entity
     * @return 如果有自增主键返回自增id，否则返回影响的行数
     */
    async insertSelective(entity: T): Promise<any> {
        const sqlObj = DatabaseUtils.getDynamicInsertObj(this.getTableName(), entity);
        return await DatabaseUtils.execSql(sqlObj.sql, sqlObj.params);
    }

    /**
     * 查询操作
     * @param where 查询条件
     * @return 返回的数据类型
     */
    async select(where: T): Promise<D[]> {
        const sqlObj = DatabaseUtils.getDynamicSelectObj(this.getTableName(), this.getColumns(), where);
        return await DatabaseUtils.execSql(sqlObj.sql, sqlObj.params);
    }

    /**
     * 查询返回单条
     * @param where
     * @return 单条操作
     * @exception 查询出多条时抛出异常
     */
    async selectOne(where: T): Promise<D> {
        const sqlObj = DatabaseUtils.getDynamicSelectObj(this.getTableName(), this.getColumns(), where);
        const rows: any = await DatabaseUtils.execSql(sqlObj.sql, sqlObj.params);
        if (rows.length > 1) {
            throw new RestException("selectOne查询结果返回多条");
        }
        return rows.length ? rows[0] : null;
    }

    /**
     * 动态更新操作
     * @param columns 更新字段
     * @param where 条件
     * @return 返回影响的行数
     */
    async updateSelective(columns: T, where: T): Promise<number> {
        const sqlObj = DatabaseUtils.getDynamicUpdateObj(this.getTableName(), columns, where);
        return await DatabaseUtils.execSql(sqlObj.sql, sqlObj.params);
    }
}

export default BasicDao;