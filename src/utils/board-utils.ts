import FenUtils from "./fen-utils";
import {BOARD} from "../configs/enums";

class BoardUtils {

    /**
     * 一维数组转二维
     * @param gameMap
     * @returns {[]}
     */
    listToArray = (gameMap: any) => {
        const result: any[] = [];
        // 坐标初始化
        for (let i = 0; i < BOARD.ROW_SIZE; ++i) {
            result[i] = [];
            for (let j = 0; j < BOARD.COL_SIZE; ++j) {
                result[i][j] = null;
            }
        }
        // 遍历所有可用节点
        gameMap.map((chess: any) => result[chess.x][chess.y] = chess);
        return result;
    }

    /**
     * 秒转成字符串分钟(如：60 -> 01:00)
     * @param seconds
     * @return {string}
     */
    secondsToMinuteStr = (seconds: number) => {
        if (!seconds || seconds <= 0) {
            return '00:00';
        } else {
            const minute = Math.floor(seconds / 60);
            const overSeconds = seconds % 60;
            const minuteStr = minute < 10 ? `0${minute}` : minute;
            const secondsStr = overSeconds < 10 ? `0${overSeconds}` : overSeconds;
            return `${minuteStr}:${secondsStr}`;
        }
    };

    /**
     * 模拟落子
     * @param requestGameMap
     * @param from
     * @param to
     */
    tryMoveChess(requestGameMap: any[], from: any, to: any) {
        for (let x = 0; x < requestGameMap.length; x++) {
            if (requestGameMap[x].x === from.x && requestGameMap[x].y === from.y) {
                requestGameMap[x].x = to.x;
                requestGameMap[x].y = to.y;


            }else if (requestGameMap[x].x === to.x && requestGameMap[x].y === to.y) {
                requestGameMap.splice(x, 1);
            }
        }
        return FenUtils.toFen(requestGameMap,from.isBlackColor);
    }

    transformPosition(from: any, to: any) {
        return {
            fromPos: {
                ...from,
                x: BOARD.ROW_SIZE - from.x -1,
                y: BOARD.COL_SIZE - from.y -1
            },
            toPos: {
                ...to,
                x: BOARD.ROW_SIZE - to.x -1,
                y: BOARD.COL_SIZE - to.y -1
            }
        }

    }
}

export default BoardUtils;