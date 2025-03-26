import BasicVo from "../basic-vo";

interface BattleHistoryVo extends BasicVo{
    /**
     * 对战表主键
     */
    battleId?: string;
    /**
     * 账号
     */
    userId?: string;
    // /**
    //  * 游戏棋盘
    //  */
    // gameFen?: string;
    /**
     * 是否红棋落子(true/false)
     */
    isRedMove?: boolean;
    /**
     * 对局计步
     */
    stepCount?: number;
    /**
     * 思考时间
     */
    thinkTime?: number|null;
    /**
     * 最后落子的位置
     */
    lastChess?: string;
    /**
     * 特效盒子的位置
     */
    lastChessBox?: string;
    /**
     * 最后路径的棋子
     */
    lastSrcChess?: string|null;
    /**
     * 最后敌人的棋子
     */
    lastTargetChess?: string|null;
    /**
     * 路径的棋子
     */
    srcBoxChess?: string;
    /**
     * 敌人的棋子
     */
    targetBoxChess?: string;
    /**
     * 局时(单位：秒)
     */
    allTime?: number;
    /**
     * 步时(单位：秒)
     */
    stepTime?: number;
    /**
     * 步骤说明
     */
    stepExplain?: string;
    /**
     * 游戏分享
     */
    gameFen?: string;
}
export default BattleHistoryVo;
