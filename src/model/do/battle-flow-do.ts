import BasicDo from "../basic-do";

interface BattleFlowDo extends BasicDo{
    /**
     * 房间号
     */
    roomId?: string;
    /**
     * 对战表主键
     */
    battleId?: string;
    /**
     * 创建人
     */
    userId?: string;
    /**
     * 类型 0001-求和, 0002-认输, 0003-悔棋
     */
    type?: string;
    /**
     * 结果 Y-成功/同意, N-失败/拒绝
     */
    result?: string;
}
export default BattleFlowDo;
