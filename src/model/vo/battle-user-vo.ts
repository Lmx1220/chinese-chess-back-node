import BasicVo from "../basic-vo";

interface BattleUserVo extends BasicVo{
    /**
     * 房间号
     */
    roomId?: string;
    /**
     * 对战表主键
     */
    battleId?: string;
    /**
     * 用户账号
     */
    userId?: string;
    /**
     * 用户昵称
     */
    userName?: string;
    /**
     * 敌方账号
     */
    enemyId?: string;
    /**
     * 敌方昵称
     */
    enemyName?: string;
    /**
     * 是否先手(true/false)
     */
    first?: string;
    /**
     * 本局结算的积分
     */
    changeScore?: number;
    /**
     * 离线时间(对局发生离线)
     */
    offlineTime?: string;
    /**
     * 移动棋子时间
     */
    moveChessTime?: Date;
}
export default BattleUserVo;
