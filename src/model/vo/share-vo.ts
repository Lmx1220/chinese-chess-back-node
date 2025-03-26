import BasicVo from "../basic-vo";

interface ShareVo extends BasicVo {
    battleId?: string;
    userId?: string;
    userName?: string;
    shareCode?: string;
    validityDay?: number | null,
    viewCount?: number,
    sharePassword?: string | null
}

export default ShareVo;