import BasicVo from "../basic-vo";

interface VersionVo extends BasicVo{
    /**
     * 版本Id
     */
    versionId?: string;
    /**
     * 版本上线时间
     */
    onlineTime?: string;
}
export default VersionVo;
