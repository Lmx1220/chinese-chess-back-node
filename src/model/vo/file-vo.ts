import BasicVo from "../basic-vo";

interface FileVo extends BasicVo{
    /**
     * 创建人
     */
    userId?: string;
    /**
     * 文件Id
     */
    fileId?: string;
    /**
     * 文件名称
     */
    fileName?: string;
    /**
     * 文件后缀(示例：.png/.zip)
     */
    suffix?: string;
    /**
     * 文件大小
     */
    fileSize?: string;
    /**
     * 文件类型，例: image/png
     */
    contentType?: string;
}
export default FileVo;
