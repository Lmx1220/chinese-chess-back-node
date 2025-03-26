import BasicDo from "../basic-do";

interface BattleUserDo extends BasicDo{
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
    userId: string;
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
    first?: boolean|null;
    /**
     * 本局结算的积分
     */
    changeScore?: number;
    /**
     * 离线时间(对局发生离线)
     */
    offlineTime?: string;
}
export default BattleUserDo;
