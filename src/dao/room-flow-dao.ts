import DatabaseUtils from "../utils/db-utils";
import BasicDao from "./basic-dao";
import RoomFlowVo from "../model/vo/room-flow-vo";
import RoomFlowDo from "../model/do/room-flow-do";

class RoomFlowDao extends BasicDao<RoomFlowVo, RoomFlowDo> {

    private static instance: any = null;

    static builder(): RoomFlowDao {
        if (!RoomFlowDao.instance) {
            RoomFlowDao.instance = new RoomFlowDao();
        }

        return RoomFlowDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'room_id', 'user_id', 'enemy_id', 'type', 'value', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_room_flow";
    }

    /**
     * 保存房间流水
     * @param userId
     * @param roomId
     * @param enemyId
     * @param type
     * @param value
     */
    static saveRoomFlow = async (userId: string, roomId: string, enemyId: string, type: string, value: string | null) => {
        const sql = `insert into t_room_flow(user_id, room_id, enemy_id, type, value) values(?, ?, ?, ?, ?)`;
        const params = [userId, roomId, enemyId, type, value];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.length === 0;
    }

    /**
     *
     * 查询用户在一定时间内被哪些房间踢过
     * 此列表的房间不让用户再加入
     * @param userId
     * @param limitSeconds 间隔时间，单位：秒
     * @return string[]
     */
    getKickRoomIdsBy = async (userId: string, limitSeconds: number) => {
        const sql = `select room_id as roomId from t_room_flow 
              where enemy_id = ? and TIMESTAMPDIFF(second, create_time, now()) <= ?`;
        const params = [userId, limitSeconds];
        const rows: any = await DatabaseUtils.execSql(sql, params);
        return rows.map((item: any) => item.roomId);
    }


}

export default RoomFlowDao;
