import BasicDo from "../basic-do";

interface RoomFlowDo extends BasicDo{

    /**
     * 房间号
     */
    roomId?: string;
    /**
     * 创建人Id
     */
    userId?: string;
    /**
     * 对手Id
     */
    enemyId?: string;
    /**
     * 值
     */
    value?: string|null;
    /**
     * 0001-被踢, 0002-加锁
     */
    type?: string;

}
export default RoomFlowDo;
