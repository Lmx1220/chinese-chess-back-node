import BasicDo from "../basic-do";

interface ShareDo extends BasicDo {
    battleId?: string;
    userId?: string;
    userName?: string;
    shareCode?: string;
    validityDay?: number | null,
    viewCount?: number,
    sharePassword?: string | null
}

export default ShareDo;