import BasicDo from "../basic-do";

interface UserStateDo extends BasicDo{
    /**
     * 账号
     */
    userId: string;
    /**
     * 会话token
     */
    token: string;
    /**
     * 玩家位置(某页面)
     */
    userPage: string;
    /**
     * 房间号(加入房间后)
     */
    roomId: string;
    /**
     * 加入类型，random-匹配对战, freedom-开房约战
     */
    joinType: string;
    /**
     * 房间状态(枚举值参考const.js)
     */
    roomStatus?: string;
    /**
     * 是否先手(true/false)
     */
    first?: string;
    /**
     * 是否房主(加入房间后)
     */
    isRoomAdmin?: string;
    /**
     * 房间锁密码
     */
    lockPass?: string;
    /**
     * 是否已准备(加入房间后)
     */
    isReady?: string;
    /**
     * 对战表Id(发生对战后)
     */
    battleId: string;
    /**
     * 玩家状态-对局/观战(枚举值参考const.js)
     */
    userStatus?: string;
    /**
     * 用户操作时间
     */
    actionTime?: Date;
    /**
     * 用户断开时间(与服务器断开)
     */
    disconnectTime?: string;
}
export default UserStateDo;
