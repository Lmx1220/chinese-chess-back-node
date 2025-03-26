import BasicDo from "../basic-do";

interface BattleDo extends BasicDo{
    /**
     * 房间号
     */
    roomId?: string;
    /**
     * 房间状态(枚举值参考const.js)
     */
    roomStatus?: string;
    /**
     * 对战结果(参考const.js)
     */
    winCode?: string;
    /**
     * 对战结果描述：红棋/黑棋/和棋
     */
    winMsg?: string;
    /**
     * 胜利方userId
     */
    winUserId?: string;
    /**
     * 当前是否红棋落子(true/false)
     */
    currIsRedMove?: string;
    /**
     * 对局发起求和(Y/N)
     */
    sendPeace?: string;
    /**
     * 对局发起悔棋(Y/N)
     */
    sendBackChess?: string;
    /**
     * 请求发起方userId
     */
    sendUserId?: string|null;

}
export default BattleDo;
