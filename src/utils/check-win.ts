import FenUtils from "./fen-utils";
import BattleUtils from "./battle-utils";
import {BOARD, GAME_OVER_TYPE} from "../configs/enums";
import BoardUtils from "./board-utils";
import {Log} from "../aop/log-aop";

const boardUtils = new BoardUtils();
const battleUtils = new BattleUtils();
class CheckWin{
    async judgeGameWin(userId: string, battleId: string, tryMoveGameMap: string, from: any, to: any) {
        const elements = FenUtils.fromFen(tryMoveGameMap);
        // log.debug('elements',elements)
        if (!elements.some(piece => piece.isAttach)){
            return {
                isOver: true,
                type: GAME_OVER_TYPE.NO_ATTACH_PIECE
            }
        }
        if (this.Qh(elements, from.isBlackColor)) {
            // log.debug('boss还有可走的位置')
            return {
                isOver: false,
                type: 0
            };
        }

        let type = GAME_OVER_TYPE.BATTLE
        const filteredElements = elements.filter((element) => element.isBlackColor !== from.isBlackColor);
        const condition = battleUtils.killBossCheck(elements, from.isBlackColor);
        if (filteredElements.length === 1) {
            condition ? type=GAME_OVER_TYPE.BATTLE : type=GAME_OVER_TYPE.BATTLE
        }

        // If condition is not met, iterate over the filtered elements
        if (!condition) {
            for (let i = 0; i < filteredElements.length; i++) {
                const result = this.getValidMoves(elements, filteredElements[i]);
                if (result && result.length > 0) {
                    return {
                        isOver: false,
                        type: 0
                    };
                }
            }
            type =GAME_OVER_TYPE.BATTLE
        }

        // If condition is met, iterate over the filtered elements and perform additional checks
        const nonBossElements = filteredElements.filter((element) => !element.isBoss);
        const bossElement = filteredElements.find((element) => element.isBoss);

        for (let i = 0; i < nonBossElements.length; i++) {
            const result = this.getValidMoves(elements, nonBossElements[i]);

            for (let j = 0; j < result.length; j++) {
                const newElements = battleUtils.updateArrayWithNewPosition(JSON.stringify(elements), nonBossElements[i], result[j]);
                const sameColorElements = newElements.filter((element:any) => element.isBlackColor === from.isBlackColor);
                let canMove = true;

                for (let k = 0; k < sameColorElements.length; k++) {
                    if ( battleUtils.basicRule(newElements, sameColorElements[k], bossElement) ||  battleUtils.isStalemateAtBoss(newElements)) {
                        canMove = false;
                        break;
                    }
                }

                if (canMove) {
                    return {
                        isOver: false,
                        type: 0
                    };
                }
            }
        }

        return {
            isOver: true,
            type
        }

    }
    private Qh(board:any[], isBlack:boolean)  {
        // 根据棋子颜色过滤棋子数组
        const filteredPieces = board.filter(piece => piece.isBlackColor !== isBlack);

        // 找到当前 boss 棋子
        const bossPiece = filteredPieces.find(piece => piece.isBoss);

        // 获取当前 boss 可以移动的位置
        const validMoves = this.getValidMoves(board, bossPiece);

        // 打印当前 boss 可走的位置
        // log.debug("当前boss可走的位置有:", validMoves);

        // 如果当前 boss 有可行的移动方式
        if (validMoves.length > 0) {
            // 遍历所有可移动的位置
            for (let i = 0; i < validMoves.length; ++i) {
                // 模拟移动棋子后的棋盘状态
                const simulatedBoard = battleUtils.updateArrayWithNewPosition(JSON.stringify(board), bossPiece, validMoves[i]);

                // 过滤出非 boss 棋子且颜色符合的棋子
                const opponentPieces = simulatedBoard.filter((piece: any) => !piece.isBoss && piece.isBlackColor === isBlack);

                let j = 0;
                // 遍历对手棋子
                for (; j < opponentPieces.length; ++j) {
                    // 如果当前对手棋子可以吃掉 boss 棋子
                    if (battleUtils.basicRule(simulatedBoard, opponentPieces[j], {...validMoves[i], id: bossPiece.id})) {
                        // 提前结束循环
                        break;
                    }
                    // 如果当前状态下已经达到胜利条件，则提前结束循环
                    if (battleUtils.isStalemateAtBoss(simulatedBoard)) {
                        break;
                    }
                }
                // 如果所有对手棋子都无法吃掉 boss 棋子，则返回 true
                if (j === opponentPieces.length) {
                    return true;
                }
            }
        }
        // 如果所有移动都无法达到胜利条件，则返回 false
        return false;
    }
    private getValidMoves (gameMap:any[], currentChess:any) {
        const validMoves = [];
        const grid =  boardUtils.listToArray(gameMap);

        for (let row = 0; row < BOARD.ROW_SIZE; row++) {
            for (let column = 0; column < BOARD.COL_SIZE; column++) {
                const chess = grid[row][column];

                if (!chess || chess.isBlackColor !== currentChess.isBlackColor) {
                    const newChess = {...chess, x: row, y: column};
                    if (battleUtils.basicRule(gameMap, currentChess, newChess) && battleUtils.isMovementValid(gameMap, currentChess, newChess)) {
                        validMoves.push(newChess);
                    }
                }
            }
        }

        return validMoves;
    };
}
export default CheckWin;