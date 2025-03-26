import BasicVo from "../basic-vo";

interface BattleChatVo extends BasicVo {
    battleId?: string;
    userId?: string;
    content?: string;
}

export default BattleChatVo;