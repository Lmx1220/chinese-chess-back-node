import BasicDao from "./basic-dao";
import BattleChatVo from "../model/vo/battle-chat-vo";
import BattleChatDo from "../model/do/battle-chat-do";

class BattleChatDao extends BasicDao<BattleChatVo, BattleChatDo> {

    private static instance: any = null;

    static builder(): BattleChatDao {
        if (!BattleChatDao.instance) {
            BattleChatDao.instance = new BattleChatDao();
        }

        return BattleChatDao.instance;
    }

    getColumns(): string[] {
        return ['id','battle_id','user_id','content', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_battle_chat";
    }
}
export default BattleChatDao;