import BasicDo from "../basic-do";

interface BattleHistoryDo extends BasicDo{
    /**
     * 对战表主键
     */
    battleId?: string;
    /**
     * 账号
     */
    userId?: string;
    /**
     * 游戏棋盘
     */
    gameFen?: string;
    /**
     * 是否红棋落子(true/false)
     */
    isRedMove?: string;
    /**
     * 对局计步
     */
    stepCount?: number;
    /**
     * 思考时间
     */
    thinkTime?: number;
    /**
     * 最后落子的位置
     */
    lastChess?: string;
    /**
     * 特效盒子的位置
     */
    lastChessBox?: string;
    /**
     * 局时(单位：秒)
     */
    allTime?: number;
    /**
     * 步时(单位：秒)
     */
    stepTime?: number;
}
export default BattleHistoryDo;
