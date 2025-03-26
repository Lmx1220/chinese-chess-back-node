import BasicDao from "./basic-dao";
import ShareVo from "../model/vo/share-vo";
import ShareDo from "../model/do/share-do";

class ShareDao extends BasicDao<ShareVo, ShareDo> {

    private static instance: any = null;

    static builder(): ShareDao {
        if (!ShareDao.instance) {
            ShareDao.instance = new ShareDao();
        }

        return ShareDao.instance;
    }

    getColumns(): string[] {
        return ['battle_id', 'user_id', 'user_name', 'share_code', 'validity_day', 'view_count', 'share_password', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_share";
    }
}

export default ShareDao;