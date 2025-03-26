import BasicDo from "../basic-do";

interface ValidCodeDo extends BasicDo{
    /**
     * 账号
     */
    userId?: string;
    /**
     * 收件人
     */
    email?: string;
    /**
     * 验证码
     */
    validCode?: string;
    /**
     * 是否有效, Y-有, N-无
     */
    dataStatus?: string;
    /**
     * 验证码类型
     */
    codeType?: string;
}
export default ValidCodeDo;
