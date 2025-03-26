import {Transaction} from "../aop/transaction-aop";
import {CatchException} from "../aop/exception-aop";
import UserDao from "../dao/user-dao";
import DataResp from "../model/data-resp";
import FileUtils from "../utils/file-utils";

const fileUtils = new FileUtils();

class FileServiceImpl {
    /**
     * 上传图片
     * @param socket
     * @param userId
     * @param fileName
     * @param fileSize
     * @param base64
     * @param contentType
     */
    @Transaction
    @CatchException
    async uploadBase64Impl(socket: any, userId: string, fileName: string, fileSize: number, base64: string, contentType: string) {
        const log = global.logUtils.createContext('SocketServiceImpl', 'uploadBase64Impl', {userId});
        const user: any = await UserDao.getUserByPrimaryKey(userId);
        if (!user) {
            return DataResp.fail('查询不到用户信息');
        }

        // else if (USER_TYPE.TOURIST_USER === user.userType) {
        //     return DataResp.fail('游客无法上传图片');
        // }
        else {
            log.info(`开始上传图片：${fileName}`);
            try {
                const fileUid = await fileUtils.writeBase64(userId, fileName, base64, fileSize, contentType);
                log.info(`文件[${fileName}]上传成功`);
                return DataResp.success('文件上传成功').setData({fileUid});
            } catch (err) {
                log.info(`文件[${fileName}]上传失败，原因：`, err);
                return DataResp.fail('文件上传失败');
            }
        }
    }
}

export default FileServiceImpl;
