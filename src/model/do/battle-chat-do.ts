import BasicDo from "../basic-do";

interface BattleChatDo extends BasicDo {
    battleId?: string;
    userId?: string;
    content?: string;
}

export default BattleChatDo;