import DatabaseUtils from "../utils/db-utils";
import BasicDao from "./basic-dao";
import BattleFlowVo from "../model/vo/battle-flow-vo";
import BattleFlowDo from "../model/do/battle-flow-do";

class BattleFlowDao extends BasicDao<BattleFlowVo, BattleFlowDo>{

    private static instance: any = null;

    static builder(): BattleFlowDao {
        if (!BattleFlowDao.instance) {
            BattleFlowDao.instance = new BattleFlowDao();
        }

        return BattleFlowDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'room_id', 'battle_id', 'result', 'type', 'user_id', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_battle_flow";
    }

    /**
     * 保存对战流水
     * @param userId
     * @param roomId
     * @param battleId
     * @param type
     * @param result
     */
    static saveBattleFlow = async (userId: string, roomId: string, battleId: string, type: string, result: string) => {
        const sql = `insert into t_battle_flow(room_id, battle_id, type, user_id, result) values(?, ?, ?, ?, ?)`;
        const params = [roomId, battleId, type, userId, result];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0;
    }

    /**
     * 获取最后一条流水记录（最新的）
     * @param battleId
     * @param userId
     * @param battleFlowType
     */
    static getLastBattleFlowBy = async (battleId: string, userId: string, battleFlowType: string) => {
        const sql = `select id, room_id as roomId, battle_id as battleId, result, type, user_id as userId,
                     create_time as createTime from t_battle_flow where battle_id = ? and user_id = ? and type = ?
                     order by create_time desc 
                     limit 1`;
        const params = [battleId, userId, battleFlowType];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        if(rows && rows.length > 0) {
            return rows[0];
        }
        return null;
    }
}

export default BattleFlowDao;
