import fs from "fs";
import ConstUtils from "../utils/const-utils";
import FileDao from "../dao/file-dao";
import {APP} from "../configs/enums";

const constUtils = new ConstUtils();

/**
 * 文件工具类
 */
class FileUtils {

    /**
     * 将base64数据写入文件
     * @param userId
     * @param fileName
     * @param base64
     * @param fileSize
     * @param contentType
     */
    writeBase64 = async (userId: string, fileName: string, base64: string, fileSize: number, contentType: string) => {
        return new Promise(((resolve, reject) => {
            const log = global.logUtils.createContext('FileUtils', 'writeBase64', {userId});


            const suffix = fileName.substring(fileName.lastIndexOf("."));
            const fileId = constUtils.getRandomId(32 )+'.'+fileName;

            const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
            const dataBuffer = new Buffer(base64Data, 'base64');

            log.info("开始写入文件，fileId: ", fileId);
            fs.writeFile(`${this.getLocalPath()}/${fileId}`, dataBuffer, async err => {
                if (err) {
                    log.info("文件上传失败");
                    reject(err);
                } else {
                    // 创建文件流水
                    await FileDao.saveFile(userId, `${fileId}`, fileName, fileSize, contentType, suffix);
                    log.info(`文件${fileName}上传成功，其对应的Id为：${fileId}`);
                    resolve( fileId);
                }
            });
        }))
    }

    /**
     * 根据文件Id获取base64串
     * @param fileId
     * @param userId
     */
    readBase64ById = async (fileId: string, userId: string) => {
        if(fileId) {
            const log = global.logUtils.createContext('FileUtils', 'readBase64ById', {userId});

            // 查询文件是否存在
            const fileRows: any = await FileDao.builder().select({fileId:fileId});
            log.info('文件信息为：', fileRows);
            if(fileRows.length > 0) {
                try {
                    const [file] = fileRows;
                    const readData: Buffer = fs.readFileSync(`${this.getLocalPath()}/${fileId}`);
                    if(readData) {
                        // 转成base64
                        const prefix = `data:${file.contentType};base64,`;
                        let base64Str = readData.toString('base64');
                        log.info("文件读取成功");
                        return `${prefix}${base64Str}`;
                    }
                } catch (e) {
                    log.error("文件读取失败", e);
                }
            }
        }
        return null;
    }

    /**
     * 获取文件内容, Buffer形式返回
     * @param fileId
     * @param userId
     */
    readFileById = async (fileId: string, userId: string) => {
        if(fileId) {
            const log = global.logUtils.createContext('FileUtils', 'readFileById', {userId});

            // 查询文件是否存在
            const fileRows: any = await FileDao.builder().select({fileId:fileId});
            log.info('文件信息为：', fileRows);
            if(fileRows.length > 0) {
                try {
                    return fs.readFileSync(`${this.getLocalPath()}/${fileId}`);
                } catch (e) {
                    log.error("文件读取失败", e);
                }
            }
        }
        return null;
    }

    /**
     * 获取图片显示的路径
     * 注：如果入参为空则直接返回空
     * @param fileId
     */
    getShowPath = (fileId: string) => {
        return fileId ? `${APP.FILE_SHOW_DOMAIN}/${fileId}` : undefined;
    }

    /**
     * 获取文件上传的路径
     */
    getLocalPath = () => {
        // 如果没有则创建
        if (!fs.existsSync(APP.FILE_LOCAL_PATH)) {
            fs.mkdirSync(APP.FILE_LOCAL_PATH, { recursive: true });
        }
        return APP.FILE_LOCAL_PATH;
    }
}

export default FileUtils;
