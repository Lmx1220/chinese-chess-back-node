import BasicDo from "../basic-do";

interface VersionDo extends BasicDo{
    /**
     * 版本Id
     */
    versionId?: string;
    /**
     * 版本上线时间
     */
    onlineTime?: string;
}
export default VersionDo;
