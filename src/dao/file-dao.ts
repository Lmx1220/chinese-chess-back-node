import DatabaseUtils from "../utils/db-utils";
import BasicDao from "./basic-dao";
import FileVo from "../model/vo/file-vo";
import FileDo from "../model/do/file-do";


class FileDao extends BasicDao<FileVo, FileDo>{

    private static instance: any = null;

    static builder(): FileDao {
        if (!FileDao.instance) {
            FileDao.instance = new FileDao();
        }

        return FileDao.instance;
    }

    getColumns(): string[] {
        return ['id', 'user_id', 'file_id', 'file_name', 'suffix', 'file_size', 'content_type', 'create_time', 'update_time'];
    }

    getTableName(): string {
        return "t_file";
    }
    /**
     * 保存文件
     * @param userId
     * @param fileId
     * @param fileName
     * @param fileSize
     * @param contentType
     * @param suffix
     */
    static saveFile = async (userId: string, fileId: string, fileName: string, fileSize: number, contentType: string, suffix: string) => {
        const sql = `insert into t_file(user_id, file_id, file_name, file_size, content_type, suffix) values (?, ?, ?, ?, ?, ?)`;
        const params = [userId, fileId, fileName, fileSize, contentType, suffix];
        return await DatabaseUtils.execSql(sql, params);
    }
}

export default FileDao;
