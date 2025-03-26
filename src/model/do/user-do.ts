import BasicDo from "../basic-do";

interface UserDo extends BasicDo{
    /**
     * 账号
     */
    userId?: string;
    /**
     * 名称
     */
    userName?: string;
    /**
     * 密码
     */
    password?: string;

    /**
     * 邮箱(可选)
     */
    email?: string;
    /**
     * 用户类型(0001-普通用户, 0002-游客)
     */
    userType?: string;
    /**
     * 积分
     */
    score?: number;
    /**
     * 头像
     */
    iconUrl?: string;
    /**
     * IP地址
     */
    ip?: string;
    /**
     * 指纹采集数据
     */
    finger?: string;
    /**
     * 凭证信息(快速登录)
     */
    ticket?: string;
    /**
     * 对局次数
     */
    pkTotalCount?: number;
    /**
     * 对局胜利次数
     */
    pkWinCount?: number;
    /**
     * 对局失败次数
     */
    pkFailCount?: number;
    /**
     * 对局平局次数
     */
    pkPeaceCount?: number;
    /**
     * 对局离线次数
     */
    pkOfflineCount?: number;
    /**
     * 是否有效, Y-有效, N-无效
     */
    dataStatus?: string;

}
export default UserDo;
