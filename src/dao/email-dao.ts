import BasicDao from "./basic-dao";
import EmailVo from "../model/vo/email-vo";
import EmailDo from "../model/do/email-do";


class EmailDao extends BasicDao<EmailVo, EmailDo>{

    private static instance: any = null;

    static builder(): EmailDao {
        if (!EmailDao.instance) {
            EmailDao.instance = new EmailDao();
        }

        return EmailDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'user_id', 'subject', 'to', 'html', 'send_result', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_email";
    }
}

export default EmailDao;
