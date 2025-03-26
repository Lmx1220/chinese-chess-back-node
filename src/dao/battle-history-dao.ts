import DatabaseUtils from "../utils/db-utils";
import BasicDao from "./basic-dao";
import BattleHistoryVo from "../model/vo/battle-history-vo";
import BattleHistoryDo from "../model/do/battle-history-do";

class BattleHistoryDao extends BasicDao<BattleHistoryVo, BattleHistoryDo> {

    private static instance: any = null;

    static builder(): BattleHistoryDao {
        if (!BattleHistoryDao.instance) {
            BattleHistoryDao.instance = new BattleHistoryDao();
        }

        return BattleHistoryDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'battle_id', 'user_id', 'game_fen', 'is_red_move', 'step_count', 'step_explain', 'think_time',
            'last_src_chess', 'last_target_chess', 'src_box_chess', 'target_box_chess', 'all_time', 'step_time', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_battle_map_history";
    }

    /**
     * 查询要复盘的对局详情
     * @param userId
     * @param battleId
     * @param pageSize
     */
    getBattleReviewDetail = async (userId: string, battleId: string, pageSize: number) => {
        const countSql = `select count(*) as total
                          from t_battle_map_history
                          where battle_id = ?
                            and user_id = ? `;
        const countRows: any = await DatabaseUtils.execSql(countSql, [battleId, userId]);
        const total = countRows.length === 0 ? 0 : countRows[0].total;
        if (total === 0) {
            return {total: 0, list: []};
        } else {
            const sql = `
                select game_fen          as gameFen,
                       step_count        as stepCount,
                       step_explain      as stepExplain,
                       is_red_move       as isRedMove,
                       last_src_chess    as lastFrom,
                       last_target_chess as lastTo,
                       target_box_chess  as fromChessBox,
                       src_box_chess     as toChessBox,
                       think_time        as thinkTime
                from t_battle_map_history
                where battle_id = ?
                  and user_id = ?
                order by step_count asc limit ?`;
            const params = [battleId, userId, pageSize];
            const dataRows: any = await DatabaseUtils.execSql(sql, params);
            return {
                total: total,
                list: dataRows
            }
        }
    };

    /**
     * 删除最后两步历史记录
     * @param battleId
     * @returns {Promise<boolean>}
     */
    static deleteLastMapHistory = async (battleId: string) => {
        const sql = `delete
                     from t_battle_map_history
                     where battle_id = ? order by create_time desc limit 2`;
        const params = [battleId];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };

    /**
     * 查询该用户所在房间的历史移动步骤
     * @param battleId
     * @param userId
     * @returns {Promise<unknown>}
     */
    static getAllHistoryMoveStep = async (battleId: string, userId: string) => {

        const sql = `select game_fen          as gameFen,
                            last_src_chess    as lastFrom,
                            last_target_chess as lastTo,
                            src_box_chess     as fromChessBox,
                            target_box_chess  as toChessBox
                     from t_battle_map_history
                     where battle_id = ?
                       and user_id = ?
                     order by create_time asc`;
        const params = [battleId, userId];
        return await DatabaseUtils.execSql(sql, params);
    };

    /**
     * 创建对战历史步骤数据
     * @param battleId
     * @param userId
     * @param gameMap
     * @param isRedMove
     * @param stepCount
     * @param thinkTime
     * @param lastChess
     * @param chessBox
     * @param allTime
     * @param stepTime
     */
    static createBattleMapHistory = async (battleId: string, userId: string, gameMap: string,
                                           isRedMove: boolean, stepCount: number, thinkTime: number | null,
                                           lastChess: string | null, chessBox: string, allTime: number, stepTime: number) => {
        const sql = `insert into t_battle_map_history(battle_id, user_id, game_map, is_red_move, step_count,
                                                      think_time, last_chess, last_chess_box, all_time, step_time)
                     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [battleId, userId, gameMap, isRedMove, stepCount, thinkTime, lastChess, chessBox, allTime, stepTime];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };

    /**
     * 查询最后一条历史对战数据
     * @param battleId
     * @param userId
     * @returns {Promise<void>}
     */
    static getLastBattleMapHistory = async (battleId: string, userId: string) => {
        // 此条SQL不能根据创建时间倒序，如果创建时间不够精确，则会造成取值错误
        const sql = `
            select b.battle_id         as battleId,
                   b.user_id           as userId,
                   b.game_fen          as gameFen,
                   b.is_red_move       as isRedMove,
                   b.step_count        as stepCount,
                   b.step_explain      as stepExplain,
                   b.think_time        as thinkTime,
                   b.last_src_chess    as lastSrcChess,
                   b.last_target_chess as lastTargetChess,
                   b.src_box_chess     as srcBoxChess,
                   b.target_box_chess  as targetBoxChess,
                   b.all_time          as allTime,
                   b.step_time         as stepTime,
                   b.create_time       as createTime
            from t_battle_map_history b
            where battle_id = ?
              and user_id = ?
            order by step_count desc limit 1
        `;
        const params = [battleId, userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0 ? null : rows[0];
    };

    async getUserLastBattleHistory(battleId: string | null, userId: string) {
        let sql;
        let params;
        if (battleId) {
            sql = `
                select b.battle_id         as battleId,
                       b.user_id           as userId,
                       b.game_fen          as gameFen,
                       b.is_red_move       as isRedMove,
                       b.step_count        as stepCount,
                       b.step_explain      as stepExplain,
                       b.think_time        as thinkTime,
                       b.last_src_chess    as lastSrcChess,
                       b.last_target_chess as lastTargetChess,
                       b.src_box_chess     as srcBoxChess,
                       b.target_box_chess  as targetBoxChess,
                       b.all_time          as allTime,
                       b.step_time         as stepTime,
                       b.create_time       as createTime
                from t_battle_map_history b
                where battle_id = ?
                  and user_id = ?
                order by step_count desc limit 1
            `;
            params = [battleId, userId];
        } else {
            sql = `
                select b.battle_id         as battleId,
                       b.user_id           as userId,
                       b.game_fen          as gameFen,
                       b.is_red_move       as isRedMove,
                       b.step_count        as stepCount,
                       b.step_explain      as stepExplain,
                       b.think_time        as thinkTime,
                       b.last_src_chess    as lastSrcChess,
                       b.last_target_chess as lastTargetChess,
                       b.src_box_chess     as srcBoxChess,
                       b.target_box_chess  as targetBoxChess,
                       b.all_time          as allTime,
                       b.step_time         as stepTime,
                       b.create_time       as createTime
                from t_battle_map_history b
                where user_id = ?
                order by create_time desc, step_count desc limit 1
            `;
            params = [userId];
        }

        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0 ? null : rows[0];

    }

    async getLastBattleHistory(battleId: string, number?: number) {

        const sql = `
            select b.battle_id         as battleId,
                   b.user_id           as userId,
                   b.game_fen          as gameFen,
                   b.is_red_move       as isRedMove,
                   b.step_count        as stepCount,
                   b.step_explain      as stepExplain,
                   b.think_time        as thinkTime,
                   b.last_src_chess    as lastSrcChess,
                   b.last_target_chess as lastTargetChess,
                   b.src_box_chess     as srcBoxChess,
                   b.target_box_chess  as targetBoxChess,
                   b.all_time          as allTime,
                   b.step_time         as stepTime,
                   b.create_time       as createTime
            from t_battle_map_history b
            where battle_id = ?
            order by step_count desc
        `;
        const params = [battleId];


        const rows: any = await DatabaseUtils.execSql(sql, params);
        if (rows.length === 0) {
            return [];
        }
        if (number && number>0) {
            return rows.slice(0, number);
        }
        return rows;
    }

    async deleteLastMapHistory(battleId:string) {
        if (!battleId) {
            return false;
        }
        const sql = `delete
                     from t_battle_map_history
                     where battle_id = ? order by step_count desc limit 2`;
        const params = [battleId];
        await DatabaseUtils.execSql(sql, params);

        return true;
    }
}

export default BattleHistoryDao;
