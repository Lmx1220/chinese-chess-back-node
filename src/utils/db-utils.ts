import {Sequelize} from "sequelize";
import {config} from "../configs/config";
import * as cls from 'cls-hooked';
import * as mysql from 'mysql2';
import RestException from "../exception/rest-exception";
import BasicVo from "../model/basic-vo";

/**
 * 数据库工具
 * @see https://github.com/demopark/sequelize-docs-Zh-CN/tree/v6
 */
class DatabaseUtils {

    private static pool: any;
    private static readonly INSERT_SUFFIX = 'insert';
    private static readonly UPDATE_SUFFIX = 'update';
    private static readonly DELETE_SUFFIX = 'delete';
    private static readonly SELECT_SUFFIX = 'select';

    static getPool() {
        if (!DatabaseUtils.pool) {
            DatabaseUtils.initPool();
        }
        return DatabaseUtils.pool;
    }

    /**
     * 初始化连接池
     */
    private static initPool = () => {
        const namespace = cls.createNamespace('mysql-cls');
        Sequelize.useCLS(namespace);

        DatabaseUtils.pool = new Sequelize(String(config.DB_NAME), String(config.DB_USER), String(config.DB_PASSWORD), {
            host: String(config.DB_HOST),
            port: Number(config.DB_PORT),
            dialect: 'mysql',
            pool: {
                // 最大连接数
                max: 10,
                // 最小连接数
                min: 1,
                // 连接空闲时间
                idle: 10 * 1000
            },
            // isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
            logging: false, // (msg) => {log.debug(msg)},
            dialectOptions: {
                dateStrings: true,
                typeCast: function (field: any, next: Function) {
                    if (field.type === 'TINY' && field.length === 1) {
                        // 1 = true, 0 = false
                        return (field.string() === '1');
                    }
                    return next();
                },
            },
            timezone: '+08:00' // for writing from database
        });
        // 测试是否能连接成功
        // setTimeout(async () => {
        //     try {
        //         await pool.authenticate();
        //         console.log('Connection has been established successfully.');
        //     } catch (error) {
        //         console.error('Unable to connect to the database:', error);
        //     }
        // }, 0)
    }

    /**
     * 执行SQL
     * @param sql
     * @param params 支持两种类型
     *    类型一：参数数组，sql示例：delete from t_user where user_id = ?，参数示例：['小天']
     *    类型二：参数对象，sql示例：delete from t_user where user_id = :userId，参数示例：{ userId: '小天' }
     */
    static execSql(sql: string, params: any[]): any {
        const execSql = Array.isArray(params) ? mysql.format(sql.trim(), params) : sql.trim();
        return new Promise(async (resolve, reject) => {
            try {
                const pool = DatabaseUtils.getPool();
                // ref: https://github.com/demopark/sequelize-docs-Zh-CN/blob/master/core-concepts/raw-queries.md
                const [result, value] = await pool.query(execSql, {raw: true});
                let response;
                if(execSql.startsWith(DatabaseUtils.INSERT_SUFFIX)) {
                    // 录入操作，result为自增主键，无自增主键时为影响的行数
                    response = result ? result : value;
                } else if(execSql.startsWith(DatabaseUtils.UPDATE_SUFFIX) || execSql.startsWith(DatabaseUtils.DELETE_SUFFIX)) {
                    // 影响的行数
                    response = result.affectedRows;
                } else if(execSql.startsWith(DatabaseUtils.SELECT_SUFFIX)) {
                    // 查询操作直接返回结果
                    response = result;
                }
                resolve(response);
            } catch (e) {
                const log = global.logUtils.createContext('DatabaseUtils', 'execSql');
                log.error(`SQL执行错误：${mysql.format(execSql, params)}`)
                log.error(`SQL执行错误的原因：`, e);
                reject(`SQL执行错误`);
            }
        })
    }

    /**
     * 参数
     * @param column 列表名称，如：user_id/userId
     */
    private static colTrans = (column: string) => {
        if (column.indexOf('_') !== -1) {
            // user_id => userId
            return column.split('_')
                .map((item, index) => {
                    return index === 0 ? item.toLowerCase() : item.slice(0, 1).toUpperCase() + item.slice(1).toLowerCase();
                }).join('');
        } else {
            // userId => user_id
            return column.split('').map(item => item >= 'A' && item <= 'Z' ? `_${item.toLowerCase()}` : item).join('');
        }
    }

    /**
     * 动态获取SQL(count查询)
     * @param tableName 表名
     * @param where 参数对象
     */
    static getDynamicCountObj = (tableName: string, where: BasicVo) => {
        const whereColumns: string[] = Object.keys(where);
        const whereParamArr = [];
        for(let whereColumn of whereColumns) {
            const value = eval(`where.${whereColumn}`);
            whereParamArr.push([whereColumn, value]);
        }
        const sqlParams: any[] = [];
        let whereSql = '';

        // where条件
        if (whereColumns.length > 0) {
            whereSql += ' where ';
            const AND_STR = 'and ';
            whereParamArr.map(([column, value]) => {
                whereSql += `${DatabaseUtils.colTrans(column)} = ? ${AND_STR}`;
                sqlParams.push(value);
            });
            whereSql = whereSql.substring(0, whereSql.length - AND_STR.length);
        }
        return {
            sql: `select count(*) as total from ${tableName} ${whereSql.trim()}`,
            params: sqlParams,
        };
    }

    /**
     * 动态删除数据
     * @param tableName
     * @param entity
     */
    static getDynamicDeleteObj = (tableName: string, entity: BasicVo) => {
        const whereColumns: string[] = Object.keys(entity);
        const sqlParams: any[] = [];

        const AND_STR = 'and ';
        let whereSql = '';

        for(let whereColumn of whereColumns) {
            const value = eval(`entity.${whereColumn}`);
            whereSql += `${DatabaseUtils.colTrans(whereColumn)} = ? ${AND_STR}`;
            sqlParams.push(value);
        }
        // 判断是否有条件
        if(whereSql.length > 0) {
            // 有值时，拼接一下where条件
            whereSql = 'where ' + whereSql.substring(0, whereSql.length - AND_STR.length);
        }
        return {
            sql: `delete from ${tableName} ${whereSql}`,
            params: sqlParams,
        };
    }

    /**
     * 动态录入数据
     * @param tableName
     * @param entity
     */
    static getDynamicInsertObj = (tableName: string, entity: BasicVo) => {
        const whereColumns: string[] = Object.keys(entity);
        const sqlParams: any[] = [];
        const valuesArr = [];
        // 录入条件校验
        if(!whereColumns.length) {
            throw new RestException(`对表[${tableName}]录入数据时，无任何参数`);
        }

        for(let whereColumn of whereColumns) {
            // SQL的参数和 values 中的占位符
            sqlParams.push(eval(`entity.${whereColumn}`));
            valuesArr.push("?");
        }
        let columnSql = '';
        // SQL主体
        whereColumns.map(column => columnSql += `\`${DatabaseUtils.colTrans(column)}\`,`);
        // 去除末尾的逗号
        columnSql = columnSql.substring(0, columnSql.length - 1);

        return {
            sql: `insert into ${tableName}(${columnSql.trim()}) values (${valuesArr.join(', ')})`,
            params: sqlParams,
        };
    }

    /**
     * 动态获取SQL(仅查询)
     * @param tableName 表名
     * @param columns 查询返回的列
     * @param where 参数对象
     */
    static getDynamicSelectObj = (tableName: string, columns: string[], where: BasicVo) => {
        const whereColumns: string[] = Object.keys(where);
        const whereParamArr = [];
        for(let whereColumn of whereColumns) {
            const value = eval(`where.${whereColumn}`);
            whereParamArr.push([whereColumn, value]);
        }
        const sqlParams: any[] = [];
        let columnSql = '';
        let whereSql = '';

        // SQL主体
        columns.map(column => columnSql += ` ${column} as ${DatabaseUtils.colTrans(column)},`);
        // 去除末尾的逗号
        columnSql = columnSql.substring(0, columnSql.length - 1);

        // where条件
        if (columns.length > 0) {
            whereSql += ' where ';
            const AND_STR = 'and ';
            whereParamArr.map(([column, value]) => {
                whereSql += `${DatabaseUtils.colTrans(column)} = ? ${AND_STR}`;
                sqlParams.push(value);
            });
            whereSql = whereSql.substring(0, whereSql.length - AND_STR.length);
        }
        return {
            sql: `select ${columnSql.trim()} from ${tableName} ${whereSql.trim()}`,
            params: sqlParams,
        };
    }

    /**
     * 动态修改
     * @param tableName
     * @param params
     * @param where
     */
    static getDynamicUpdateObj = (tableName: string, params: BasicVo, where: BasicVo) => {
        const columns: string[] = Object.keys(params);
        const paramArr = [];
        for(let column of columns) {
            const value = eval(`params.${column}`);
            paramArr.push([column, value]);
        }

        const whereColumns: string[] = Object.keys(where);
        const whereParamArr = [];
        for(let whereColumn of whereColumns) {
            const value = eval(`where.${whereColumn}`);
            whereParamArr.push([whereColumn, value]);
        }

        const sqlParams: any[] = [];
        let setSql = '';
        let whereSql = '';

        // SQL主体
        paramArr.map(([column, value]) => {
            setSql += ` ${DatabaseUtils.colTrans(column)} = ?,`;
            sqlParams.push(value);
        });
        // 去除末尾的逗号
        setSql = setSql.substring(0, setSql.length - 1);

        // where条件
        if (whereColumns.length > 0) {
            whereSql += ' where ';
            const AND_STR = 'and ';
            whereParamArr.map(([column, value]) => {
                whereSql += `${DatabaseUtils.colTrans(column)} = ? ${AND_STR}`;
                sqlParams.push(value);
            });
            whereSql = whereSql.substring(0, whereSql.length - AND_STR.length);
        }
        return {
            sql: `update ${tableName} set ${setSql.trim()} ${whereSql.trim()}`,
            params: sqlParams,
        };
    }
}

export default DatabaseUtils;