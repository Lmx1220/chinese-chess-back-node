import BasicVo from "../basic-vo";

interface VersionVo extends BasicVo{
    /**
     * 版本Id
     */
    versionId?: string;
    /**
     * 变更类型, A-新增, M-修改, D-删除, B-修复问题
     */
    changeType?: string;
    /**
     * 内容体
     */
    content?: string;
    /**
     * 序号, 1-n, 越大越靠前
     */
    sort?: string;
    /**
     * 内容样式
     */
    style?: string;
}
export default VersionVo;
