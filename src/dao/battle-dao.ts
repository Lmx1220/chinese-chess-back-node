import DatabaseUtils from "../utils/db-utils";
import {ROOM_STATUS} from "../configs/enums";
import BasicDao from "./basic-dao";
import BattleVo from "../model/vo/battle-vo";
import BattleDo from "../model/do/battle-do";

class BattleDao extends BasicDao<BattleVo, BattleDo>{

    private static instance: any = null;

    static builder(): BattleDao {
        if (!BattleDao.instance) {
            BattleDao.instance = new BattleDao();
        }

        return BattleDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'room_id', 'room_status', 'win_code', 'win_msg', 'win_user_id', 'curr_is_red_move',
            'send_peace', 'send_user_id', 'send_back_chess', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_battle";
    }

    /**
     * 根据battleId获取对战详情
     * @param battleId
     */
    static getBattleByPrimaryKey = async (battleId: string) => {
        const sql = `select id, room_id as roomId, room_status as roomStatus, win_code as winCode, win_msg as winMsg,
            win_user_id as winUserId, curr_is_red_move as currIsRedMove, send_peace as sendPeace, send_user_id as sendUserId,
            send_back_chess as sendBackChess from t_battle where id = ?`;
        const params = [battleId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        // 有且只有一条数据
        return rows.length === 0 ? null : rows[0];
    }

    /**
     * 统计该房间已创建的对局
     * @param roomId
     */
    countCreatedBattleByRoomId = async (roomId: string) => {
        const sql = 'select * from t_battle where room_id = ? and FIND_IN_SET(room_status, ?)';
        const roomStatusList = [ROOM_STATUS.BATTLE, ROOM_STATUS.TIMEOUT];
        const params = [roomId, roomStatusList.join(',')];
        return await DatabaseUtils.execSql(sql, params);
    };

    /**
     * 创建房间对战数据
     * @param battleId
     * @param roomId
     * @param roomStatus
     * @returns {Promise<boolean>}
     */
    static createBattleData = async (battleId: string, roomId: string, roomStatus: string) => {
        const sql = `insert into t_battle(id, room_id, room_status, curr_is_red_move) values(?, ?, ?, ?)`;
        const params: any[] = [battleId, roomId, roomStatus, true];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };

    /**
     * 更新对战的结果
     * @param battleId
     * @param winCode
     * @param winMsg
     * @param winUserId
     * @returns {Promise<boolean>}
     */
    static updateBattleResult = async (battleId: string, winCode: string, winMsg: string, winUserId: string) => {
        const sql = `update t_battle set win_code = ?, win_msg = ?, win_user_id = ? where id = ?`;
        const params = [winCode, winMsg, winUserId, battleId];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };

    /**
     * 更新对战表的落子方
     * @param battleId
     * @param currIsRedMove
     * @returns {Promise<boolean>}
     */
    static updateBattleCurrIsRedMove = async (battleId: string, currIsRedMove: boolean) => {
        const sql = `update t_battle set curr_is_red_move = ? where id = ? `;
        const params = [currIsRedMove, battleId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0;
    }

    /**
     * 更新悔棋状态
     * @param battleId
     * @param status
     * @param sendUserId
     */
    static updateBattleBackMove = async (battleId: string, status: string, sendUserId: string | null) => {
        const sql = `update t_battle set send_back_chess = ?, send_user_id = ? where id = ? `;
        const params = [status, sendUserId, battleId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0;
    }

    /**
     * 检查用户是否正在对战中
     * @param userId
     */
    checkUserInBattle = async (userId: string) => {
        const sql = `select count(*) as total from t_battle a left join t_battle_user b on a.id = b.battle_id where a.room_status = ? and b.user_id = ?`;
        const params = [ROOM_STATUS.BATTLE, userId];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0 ? false : rows[0].total > 0;
    }

    /**
     * 获取对战信息
     * @param userId
     * @param roomStatus
     */
    getBattleInfoList = async (userId: string, roomStatus: ROOM_STATUS) => {
        const sql = `select a.room_id as roomId, a.id as battleId
            from t_battle a left join t_battle_user b on a.id = b.battle_id 
            where a.room_status = ? and b.user_id = ?`;
        const params = [roomStatus, userId];
        return await DatabaseUtils.execSql(sql, params);
    }

    /**
     * 查询正在对战的场次
     */
    static queryBattleCount = async () => {
        const sql = `select count(*) as total from t_battle where room_status = ?`;
        const params = [ROOM_STATUS.BATTLE];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length == 0 ? 0 : rows[0].total;
    }

    /**
     * 更新对战房间的状态
     * @param battleId
     * @param status
     * @returns {Promise<boolean>}
     */
    static updateBattleStatus = async (battleId: string, status: string) => {
        const sql = `update t_battle set room_status = ? where id = ?`;
        const params = [status, battleId];
        await DatabaseUtils.execSql(sql, params);
        return true;
    };

}

export default BattleDao;
