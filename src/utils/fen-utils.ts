import BoardUtils from "./board-utils";
import {BOARD} from "../configs/enums";



const prefixList = [
    {
        prefix: "C",
        value: "r"
    },
    {
        prefix: "M",
        value: "n"
    },
    {
        prefix: "X",
        value: "b"
    },
    {
        prefix: "S",
        value: "a"
    },
    {
        prefix: "J",
        value: "k"
    },
    {
        prefix: "P",
        value: "c"
    },
    {
        prefix: "Z",
        value: "p"
    }
];
const attachList = ["C", "M", "P", "Z"]

function findPrefix(value: string) {
    const data = prefixList.find((item => item.value === value));
    return data?.prefix
}
const getValueByPrefix = (prefix:string, toUpperCase:boolean) => {
    const foundItem = prefixList.find(item => item.prefix === prefix);
    return toUpperCase ? foundItem?.value.toUpperCase() : foundItem?.value;
};

function isAttach(e: string) {
    return attachList.includes(e)
}

function isBoss(e: string) {
    return "J" === e
}
class FenUtils {

    static toFen(gameFen: any[],isBlackColor:boolean) {
        const boardUtils = new BoardUtils();
        const items = boardUtils.listToArray(gameFen);
        let result = "";
        let prefixStr = "";

        for (let itemGroup of items) {
            let groupCount = 0;

            for (let item of itemGroup) {
                if (item) {
                    if (groupCount > 0) {
                        result += `${groupCount}`;
                        groupCount = 0;
                    }
                    prefixStr += `${item.id}/`;
                    result += `${getValueByPrefix(item.prefix, item.isBlackColor)}`;
                } else {
                    groupCount++;
                }
            }

            if (groupCount > 0) {
                result += `${groupCount}`;
            }
            result += "/";
        }

        const colorCode = isBlackColor ? "w" : "b";
        return `${result.substring(0, result.length - 1)} ${colorCode} ${prefixStr.substring(0, prefixStr.length - 1)}`;

    }
    static fromFen(gameFen: string) {
        //10*9的二维数组
        const gameArray = new Array(BOARD.COL_SIZE);
        for (let i = 0; i < BOARD.ROW_SIZE; i++) {
            gameArray[i] = new Array(BOARD.ROW_SIZE);
        }

        let n = 0
        let r = 0
        let o = 0

        let a = gameFen.charAt(o);
        while (" " !== a) {
            if ("/" === a) {
                n++
                r = 0
                if (r >= BOARD.ROW_SIZE) {
                    break
                }
            } else {
                if (a >= "0" && a <= "9") {
                    r += parseInt(a);
                } else if (a >= "a" && a <= "z") {
                    gameArray[n][r] = {
                        prefix: findPrefix(a),
                        isBlackColor: false
                    };
                    ++r;
                } else if (a >= "A" && a <= "Z") {
                    gameArray[n][r] = {
                        prefix: findPrefix(a.toLowerCase()),
                        isBlackColor: true
                    };
                    ++r;
                }

            }
            a = gameFen.charAt(++o)
            if (!a) {
                break
            }
        }
        const l = gameFen.charAt(++o)
        const c = gameFen.substring(o + l.length + 1, gameFen.length);
        return u(
            gameArray, l, c
        )
    }
}

function u(e: any, t: string, n: string) {
    let i = [];
    let r = n.split("/");
    let o = 0;

    for (let a = 0; a < e.length; ++a)
        for (let s = 0; s < e[a].length; ++s) {
            const u = e[a][s];
            if (u) {
                const p = u.prefix
                    , h = u.isBlackColor;
                i.push({
                    x: a,
                    y: s,
                    id: r[o++],
                    prefix: p,
                    isBlackColor: h,
                    isAttach: isAttach(p),
                    isBoss: isBoss(p)
                })
            }
        }
    return i
}
// const fromFen = FenUtils.fromFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w RRC/RRM/RRX/RRS/RBJ/RLS/RLX/RLM/RLC/RRP/RLP/RZ5/RZ4/RZ3/RZ2/RZ1/BZ1/BZ2/BZ3/BZ4/BZ5/BLP/BRP/BLC/BLM/BLX/BLS/BBJ/BRS/BRX/BRM/BRC');
// console.log(fromFen);
// const map = initializeGrid(fromFen);
// console.log(map);
// const fen = FenUtils.toFen(fromFen,true);
// console.log(fen);
export default FenUtils;