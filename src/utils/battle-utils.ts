import UserDao from "../dao/user-dao";
import BattleDao from "../dao/battle-dao";
import BattleFlowDao from "../dao/battle-flow-dao";
import BattleHistoryDao from "../dao/battle-history-dao";
import BattleUserDao from "../dao/battle-user-dao";
import UserStateDao from "../dao/user-state-dao";
import DateUtils from "./date-utils";
import RedisUtils from "./redis-utils";
import BoardUtils from "./board-utils";

import {BATTLE, BATTLE_FLOW_TYPE, BOARD, BOOLEAN, GAME_OVER_TYPE, REDIS_KEYS, ROOM_STATUS} from "../configs/enums";
import FenUtils from "./fen-utils";
import {Log} from "../aop/log-aop";
import CryptorUtils from "./cryptor-utils";
import SocketUtils from "./socket-utils";
import ConstUtils from "./const-utils";

const socketUtils = new SocketUtils();
const dateUtils = new DateUtils();
const boardUtils = new BoardUtils();
const constUtils = new ConstUtils();
const redisUtils = new RedisUtils();

class BattleUtils {


    /**
     * 获取对战数据
     * @param userId
     * @param battleId
     * @param jobInstance
     * @returns {Promise<[]>}
     */
    getBattleData = async (userId: string, battleId: string) => {
        const log = global.logUtils.createContext('BattleUtils', 'getBattleData', {userId, battleId});
        log.info(`请求参数:${battleId}`);

        // 查询该房间的用户信息
        const userResults: any = await BattleUserDao.builder().select({battleId: battleId});
        if (userResults.length === 0) {
            log.info(`对战数据不存在, battleId:[${battleId}]`);
            return null;
        } else {
            log.info(`已获取到数据`, userResults);
            const battleData = [];
            const battleUserTime = await global.battleTimeJob.getBattleTimeList(battleId);
            if (!battleUserTime) {
                log.info(`无法获取到对局相关时间数据`, battleUserTime);
                return null;
            }

            for (let i = 0; i < userResults.length; ++i) {
                const battleUser = userResults[i];
                const user: any = await UserDao.getUserByPrimaryKey(battleUser.userId);
                const roomUser = await BattleHistoryDao.getLastBattleMapHistory(battleId, battleUser.userId);
                const timeUser:any = battleUserTime.find((user: any) => user.userId === battleUser.userId);
                // 查询历史记录
                const historyMoveStep: any[] = [];
                const dbHistoryStep: any = await BattleHistoryDao.getAllHistoryMoveStep(battleId, battleUser.userId);
                if (dbHistoryStep && dbHistoryStep.length > 0) {
                    dbHistoryStep.map((step: any) => {
                        historyMoveStep.push({
                            gameFen: step.gameFen,
                            fromChessBox: JSON.parse(step.fromChessBox),
                            toChessBox: JSON.parse(step.toChessBox),
                            lastFrom: step.lastFrom?JSON.parse(step.lastFrom):step.lastFrom,
                            lastTo: step.lastTo?JSON.parse(step.lastTo):step.lastTo,
                        });
                    });
                }
                battleData.push({
                    score: user.score,
                    userId: user.userId,
                    userName: user.userName,
                    iconUrl: user.iconUrl,
                    first: battleUser.first,
                    gameFen: roomUser.gameFen,
                    isRedMove: roomUser.isRedMove,
                    stepCount: roomUser.stepCount,
                    fromChessBox: JSON.parse(roomUser.srcBoxChess),
                    toChessBox: JSON.parse(roomUser.targetBoxChess),
                    lastFrom: roomUser.lastSrcChess?JSON.parse(roomUser.lastSrcChess): roomUser.lastSrcChess,
                    lastTo: roomUser.lastTargetChess?JSON.parse(roomUser.lastTargetChess): roomUser.lastTargetChess,
                    allTime: timeUser.allTime,
                    stepTime: timeUser.stepTime,
                    basicAllTime: BATTLE.TOTAL_TIME_SECONDS,
                    basicStepTime: BATTLE.STEP_TIME_SECONDS,
                    readSeconds: BATTLE.READ_SECONDS,
                    historyMoveStep: historyMoveStep,
                    offlineTime: battleUser.offlineTime,
                });
            }
            return battleData;
        }
    }

    /**
     * 胜利后计算双方得分 默认12分 一个卒1分 一个马6分 一个炮8分 一个车10 一个士 4 一个象 4
     * @param gameMap {x: number, y: number, id: string,prefix string,isBlackColor: boolean,isAttach: boolean:isBoss: boolean}[]
     * @param type 0001-绝杀，0002-认输，0003-逃跑, 0004-超时, 0005-双方议和, 0006-无进攻棋子
     * @param stepCount：对局步数
     * @constructor
     */
    calcScore = (gameMap: any, type: GAME_OVER_TYPE, stepCount: number) => {
        // 两步之内，双方得分为0
        if (stepCount <= 2) {
            return {
                winScore: 0,
                failScore: 0,
                // 是否要计分(两步之内不计分)
                isValidScore: false,
            };
        }
        let redScore = 69;
        let blackScore = 69;
        //
        gameMap.map((chess: any) => {
            let core = 0
            switch (chess.prefix) {
                case 'C':
                    core = 10;
                    break
                case 'M':
                    core = 6;
                    break;
                case 'X':
                case 'S':
                    core = 4;
                    break;
                case 'P':
                    core = 8;
                    break;
                case 'Z':
                    core = 1;
                    break;
            }
            if (chess.isBlackColor) {
                blackScore -= core;
            } else {
                redScore -= core;
            }
        });

        // 和棋情况下，只优势方得分（少量的分）
        if ([GAME_OVER_TYPE.USER_PEACE,GAME_OVER_TYPE.NO_ATTACH_PIECE].includes(type)) {
            // const score = Math.max(redScore, blackScore) - Math.min(redScore, blackScore);
            return {
                // 优势方得分
                winScore: 0,
                // 劣势方不扣分
                failScore: 0,
                isValidScore: false,
            };
        } else {
            console.log('@@@@@', redScore, blackScore);
            const lastScore = 12 +(Math.max(redScore, blackScore) - Math.min(redScore, blackScore));
            return {
                winScore: lastScore,
                failScore: -lastScore,
                isValidScore: true,
            };
        }
    }

    /**
     * 检查是否有待处理的请求
     * 如：悔棋、求和等
     * @param userId
     * @return false: 无, true：有
     */
    checkWaitingRequest = async (userId: string) => {
        const userState = await UserStateDao.getUserStateByUserId(userId);
        if (!userState) {
            return true;
        }
        const battleId = userState.battleId;
        const battleData: any = await BattleDao.builder().selectOne({'id': battleId});
        if (!battleData) {
            return false;
        } else {
            const { sendUserId } = battleData;
            return !!sendUserId;
        }
    }

    /**
     * 检查短时间内重复发送
     * @param userId
     * @param limitSeconds
     * @param battleFlowType
     */
    checkShortTimeRepeatSend = async (userId: string, limitSeconds: number, battleFlowType: BATTLE_FLOW_TYPE) => {
        const userState = await UserStateDao.getUserStateByUserId(userId);
        if (!userState) {
            return true;
        }
        // 获取该用户最近发送的求和请求
        const battleId = userState.battleId;
        const lastBattleFlow: any = await BattleFlowDao.getLastBattleFlowBy(battleId, userId, battleFlowType);
        if(lastBattleFlow) {
            // 判断时间间隔
            const createTime: Date = dateUtils.strToDate(lastBattleFlow.createTime);
            const timeSeconds = dateUtils.dateDiffSeconds(createTime, new Date());
            if(timeSeconds <= limitSeconds) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查悔棋状态
     * @param userId
     * @param battleId
     * @param roomId
     * @return true: 可悔棋, false: 不能悔棋
     */
    checkBackMoveStatus = async (userId: any, battleId: any, roomId: any) => {
        const where = {
            userId: userId,
            battleId: battleId,
            roomId: roomId,
            type: BATTLE_FLOW_TYPE.BACK_MOVE,
            result: BOOLEAN.SHORT_YES
        };

        const battleFlowRows: any = await BattleFlowDao.builder().select(where);
        return battleFlowRows.length < BATTLE.BACK_MOVE_COUNT;
    }

    /**
     * 计算优势方
     * @param gameMap
     */
    calcBestUser = (gameMap: any) => {
        let redScore = 0;
        gameMap.map((chess: any) => {
            if (chess.isBlackColor) {
                redScore -= 1;
            } else {
                redScore += 1;
            }
        });
        // 判定优势方(先手或后手)
        return redScore >= 0;
    }

    /**
     * 计算时间差
     * @param startDate
     * @param endDate
     * @return 差值(ms)
     */
    calcTimeDiff = (startDate: Date, endDate: Date) => {
        if(startDate && endDate) {
            return endDate.getTime() - startDate.getTime();
        }
        return null;
    }

    /**
     * 清除对战缓存
     * @param battleId
     * @param userId
     */
    clearBattleCache = async (battleId: string, userId: string) => {
        // 快速检索的key
        const redisUserKey = `${REDIS_KEYS.USER_OFFLINE_BATTLE_CHANGE_KEY}:${userId}`;
        // 存储数据的key
        // const redisKey = `${REDIS_KEYS.BATTLE_OFFLINE_KEY}:${battleId}:${userId}`;

        // await redisUtils.delete(redisKey);
        await redisUtils.delete(redisUserKey);
    }

    /**
     * 保存移动棋子时的数据
     * @param user
     * @param enemy
     * @param to
     * @param chessBox from, to, fromChessBox, toChessBox, stepExplain
     */
    saveMoveChessData = async (user: any, enemy: any,from:any, to: any,fromChessBox:any, toChessBox: any, stepExplain: any) => {

        /** === 新增对战历史步骤表的数据 === */

        const battleUserTime =  await global.battleTimeJob.getBattleTimeList(user.battleId);
        const userTime:any = battleUserTime.find((item: any) => item.userId === user.userId);
        const enemyTime:any = battleUserTime.find((item: any) => item.userId === enemy.userId);
        // 我方的数据
        const userMapHistory = await BattleHistoryDao.getLastBattleMapHistory(user.battleId, user.userId);
        const userGameFen = boardUtils.tryMoveChess(FenUtils.fromFen(userMapHistory.gameFen),from, to);
        const userStepTime = userTime.allTime < 0 ? userTime.stepTime : BATTLE.STEP_TIME_SECONDS;
        const userStepCount = userMapHistory.stepCount + 1;
        const userIsRedMove = !userMapHistory.isRedMove;
        const userLastFromChess = JSON.stringify(from);
        const userLastChess = JSON.stringify(to);
        const userFromChessBox = JSON.stringify(fromChessBox);
        const userBoxChess = JSON.stringify(toChessBox);
        const userThinkTime = this.calcTimeDiff(dateUtils.strToDate(userMapHistory.createTime), new Date());
        await BattleHistoryDao.builder().insertSelective({
            battleId:user.battleId,
            userId: user.userId,
            stepExplain: stepExplain,
            gameFen: userGameFen,
            isRedMove: userIsRedMove,
            stepCount: userStepCount,
            thinkTime: userThinkTime,
            lastSrcChess: userLastFromChess,
            lastTargetChess: userLastChess,
            srcBoxChess: userFromChessBox,
            targetBoxChess: userBoxChess,
            allTime: userTime.allTime,
            stepTime: userStepTime
        })

        // 敌方的数据，棋子进行坐标转换
        const enemyFromChess = JSON.stringify({
            ...from,
            x:BOARD.ROW_SIZE -from.x-1,
            y:BOARD.COL_SIZE -from.y-1,
        });
        const enemyToChess = JSON.stringify({
            ...to,
            x:BOARD.ROW_SIZE -to.x-1,
            y:BOARD.COL_SIZE -to.y-1,
        });

        const enemyFromChessBox = JSON.stringify({
            ...fromChessBox,
            x:BOARD.ROW_SIZE -from.x-1,
            y:BOARD.COL_SIZE -from.y-1,
        });
        const enemyToChessBox = JSON.stringify({
            ...toChessBox,
            x:BOARD.ROW_SIZE -to.x-1,
            y:BOARD.COL_SIZE -to.y-1,
        });


        const enemyMapHistory = await BattleHistoryDao.getLastBattleMapHistory(enemy.battleId, enemy.userId);
        const enemyGameFen = boardUtils.tryMoveChess(FenUtils.fromFen(enemyMapHistory.gameFen),JSON.parse(enemyFromChess), JSON.parse(enemyToChess));
        const enemyStepTime = enemyTime.allTime < 0 ? enemyTime.stepTime : BATTLE.STEP_TIME_SECONDS;
        const enemyStepCount = enemyMapHistory.stepCount + 1;
        const enemyIsRedMove = !enemyMapHistory.isRedMove;
        const enemyThinkTime = this.calcTimeDiff(dateUtils.strToDate(enemyMapHistory.createTime), new Date());
        await BattleHistoryDao.builder().insertSelective({
            battleId:enemy.battleId,
            userId: enemy.userId,
            stepExplain: stepExplain,
            gameFen: enemyGameFen,
            isRedMove: enemyIsRedMove,
            stepCount: enemyStepCount,
            thinkTime: enemyThinkTime,
            lastSrcChess: enemyFromChess,
            lastTargetChess: enemyToChess,
            srcBoxChess: enemyFromChessBox,
            targetBoxChess: enemyToChessBox,
            allTime: enemyTime.allTime,
            stepTime: enemyStepTime
        })

        // 更新落子方
        await BattleDao.updateBattleCurrIsRedMove(user.battleId, userIsRedMove);

        //更新对手移动棋子最新时间
        await BattleUserDao.builder().updateSelective({
                moveChessTime: new Date(),
            },
            {battleId: user.battleId, userId: enemy.userId},
        );
    }

    @Log({ excludeNames: 'socket' })
    async sendBattleData(userId: string, battleId: string) {
        const log = global.logUtils.getArgsLogger(arguments, {userId, battleId});
        const userState = await UserStateDao.getUserStateByUserId(userId);
        if (!userState) {
            log.info(`用户状态不存在, userId:[${userId}]`);
            return false
        }
        const battleData = await this.getBattleData(userId, battleId);
        if (!battleData) {
            log.info(`对战数据不存在, battleId:[${battleId}]`);
            return false
        }

        log.info(`获取[${battleId}]的对战数据成功`);
        const sendSocket = socketUtils.getSocketBy(userState.token);
        await constUtils.sleep(100);
        sendSocket?.emit('syncBattleDataRespApi', CryptorUtils.encrypt({
            code: 'success',
            msg: '获取房间对战数据成功',
            data: {
                battleDataList: battleData,
                battleId
            }
        }));


        return true
    }
    basicRule = (pieces: any, current: any, target: any) => {
        if (target.x >= BOARD.ROW_SIZE || target.y >= BOARD.COL_SIZE || target.x < 0 || target.y < 0) {
            console.error(`坐标：${target.x} ,${target.y} 超出边界`)
            return false;
        }
        switch (current.prefix) {
            case "Z":
                return this.bingRule(pieces, current, target);
            case "P":
                return this.paoRule(pieces, current, target);
            case "C":
                return this.cheRule(pieces, current, target);
            case "M":
                return this.maRule(pieces, current, target);
            case "X":
                return this.xiangRule(pieces, current, target);
            case "S":
                return this.shiRule(pieces, current, target);
            case "J":
                return this.jiaRule(pieces, current, target);
            default:
                console.error('规则前缀匹配异常，值：', current.prefix);
                break
        }
    }
    async checkUserMove(userId: string, from: any, to: any) {
        if (to.x >= BOARD.ROW_SIZE || to.y >= BOARD.COL_SIZE || to.x < 0 || to.y < 0) {
            console.error(`坐标：${to.x} ,${to.y} 超出边界`)
            return false;
        }
        const lastBattleData = await BattleHistoryDao.builder().getUserLastBattleHistory(null,userId);
        const requestGameMap = FenUtils.fromFen(lastBattleData.gameFen)
        switch (from.prefix) {
            case "Z":
                return this.bingRule(requestGameMap, from, to);
            case "P":
                return this.paoRule(requestGameMap, from, to);
            case "C":
                return this.cheRule(requestGameMap, from, to);
            case "M":
                return this.maRule(requestGameMap, from, to);
            case "X":
                return this.xiangRule(requestGameMap, from, to);
            case "S":
                return this.shiRule(requestGameMap, from, to);
            case "J":
                return this.jiaRule(requestGameMap, from, to);
            default:
                console.error('规则前缀匹配异常，值：', from.prefix);
                break
        }
        return true;
    }
    updateArrayWithNewPosition = (e:any, t:any, n:any) => {
        const parsedArray = JSON.parse(e);
        const indexToRemove = parsedArray.findIndex((item:any) => item.x === n.x && item.y === n.y);

        if (indexToRemove !== -1) {
            parsedArray.splice(indexToRemove, 1);
        }

        const existingItem = parsedArray.find((item:any) => item.x === t.x && item.y === t.y);
        const indexToReplace = parsedArray.findIndex((item:any) => item.x === t.x && item.y === t.y);

        existingItem.x = n.x;
        existingItem.y = n.y;
        parsedArray.splice(indexToReplace, 1, existingItem);

        return parsedArray;
    };
    isStalemateAtBoss = (gameState:any) => {
        const grid = boardUtils.listToArray(gameState);
        const bossBlack = gameState.find((piece:any) => piece.isBoss && piece.isBlackColor);
        const bossWhite = gameState.find((piece:any) => piece.isBoss && !piece.isBlackColor);
        if (bossBlack.y !== bossWhite.y) {
            return false;
        }
        const startX = Math.min(bossBlack.x, bossWhite.x) + 1;
        const endX = Math.max(bossBlack.x, bossWhite.x);
        for (let x = startX; x < endX; ++x) {
            if (grid[x][bossBlack.y]) {
                return false;
            }
        }
        return true;
    };
    isMovementValid = (gameState:any, piece:any, newPosition:any) => {
        const updatedGameState = this.updateArrayWithNewPosition(JSON.stringify(gameState), piece, newPosition);
        const isStalemate = this.isStalemateAtBoss(updatedGameState);
        return !isStalemate && !this.killBossCheck(updatedGameState, !piece.isBlackColor);
    };
    killBossCheck = (pieces:any, isBlack:any) => {
        const nonBossPieces = pieces.filter((piece:any) => !piece.isBoss && piece.isBlackColor === isBlack);

        if (!nonBossPieces || nonBossPieces.length === 0) return false;

        const opponentBossPiece = pieces.find((piece:any) => piece.isBoss && piece.isBlackColor !== isBlack);

        for (let i = 0; i < nonBossPieces.length; ++i) {
            const piece = nonBossPieces[i];
            if (this.basicRule(pieces, piece, opponentBossPiece)) {
                return true;
            }
        }

        return false;
    };
    /**
     * 车的规则
     * @param pieces
     * @param start
     * @param end
     * @returns {boolean}
     */
    private cheRule(pieces:any, start:any, end:any){
        const grid = boardUtils.listToArray(pieces);

        if (start.x === end.x) {
            let path = [];
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            for (let y = minY + 1; y < maxY; y++) {
                if (start.y !== y && grid[start.x][y]) {
                    path.push({x: start.x, y});
                }
            }

            if (path.length === 0) return true;
            return path.length === 1 && path[0].x === end.x && path[0].y === end.y;


        }

        if (start.y === end.y) {
            let path = [];
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);

            for (let x = minX + 1; x < maxX; x++) {
                if (start.x !== x && grid[x][start.y]) {
                    path.push({x, y: start.y});
                }
            }

            if (path.length === 0) return true;
            if (path.length === 1 && path[0].x === end.x && path[0].y === end.y) return true;
        }

        return false;
    }

    /**
     * * 马的规则检查函数
     *  * @param {Array} pieces 棋子数组
     *  * @param {Object} start 起始位置的坐标 {x, y}
     *  * @param {Object} end 目标位置的坐标 {x, y}
     *  * @returns {boolean} 移动是否合法
     */
    private maRule(pieces:any, start:any, end:any){
        const grid = boardUtils.listToArray(pieces);
        const o = 2
        const a = 1
        if (Math.abs(start.x - end.x) === o && Math.abs(start.y - end.y) === a) {
            const s = start.x - end.x > 0 ? -1 : 1;
            return !grid[start.x + s][start.y]
        }
        if (Math.abs(start.y - end.y) === o && Math.abs(start.x - end.x) === a) {
            const l = start.y - end.y > 0 ? -1 : 1;
            return !grid[start.x][start.y + l]
        }
        return false
    }

    /**
     * 象的规则检查函数
     * @param {Array} pieces 棋子数组
     * @param {Object} start 起始位置的坐标 {x, y}
     * @param {Object} end 目标位置的坐标 {x, y}
     * @returns {boolean} 移动是否合法
     */
    private xiangRule(pieces:any, start:any, end:any){
        const grid = boardUtils.listToArray(pieces);
        const dx = Math.abs(start.x - end.x);
        const dy = Math.abs(start.y - end.y);
        const diagonalStep = 2; // 象的步长为2

        if (dx === diagonalStep && dy === diagonalStep) {
            const offsetX = start.x - end.x > 0 ? -1 : 1;
            const offsetY = start.y - end.y > 0 ? -1 : 1;

            if (grid[start.x + offsetX][start.y + offsetY]) {
                // 象眼位置被堵住，不能移动
                return false;
            }

            const halfBoardWidth = BOARD.ROW_SIZE / 2; // 棋盘的中心线
            if (start.x < halfBoardWidth) {
                // 左侧象
                return end.x < halfBoardWidth;
            } else {
                // 右侧象
                return end.x >= halfBoardWidth;
            }
        }

        return false;
    }

    /**
     * 士的规则检查函数
     * @param {Array} pieces 棋子数组
     * @param {Object} start 起始位置的坐标 {x, y}
     * @param {Object} end 目标位置的坐标 {x, y}
     * @returns {boolean} 移动是否合法
     */
    private shiRule(pieces:any, start:any, end:any){
        const grid = boardUtils.listToArray(pieces);
        const diagonalStep = 1; // 士的步长为1

        if (Math.abs(start.x - end.x) === diagonalStep && Math.abs(start.y - end.y) === diagonalStep) {
            const offsetX = start.x - end.x > 0 ? -1 : 1;
            const offsetY = start.y - end.y > 0 ? -1 : 1;
            const targetPiece = grid[start.x + offsetX][start.y + offsetY];

            if (!targetPiece || start.isBlackColor !== end.isBlackColor) {
                const halfBoardWidth = BOARD.ROW_SIZE / 2; // 棋盘的中心线
                const targetX = end.x;
                const targetY = end.y;

                if (start.x < halfBoardWidth) {
                    // 左侧士
                    const minX = 0;
                    const maxX = 2;
                    const minY = 3;
                    const maxY = 5;
                    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
                } else {
                    // 右侧士
                    const minX = 7;
                    const maxX = 9;
                    const minY = 3;
                    const maxY = 5;
                    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
                }
            }
        }

        return false;
    }

    /**
     * 将的规则检查函数
     * @param {Array} pieces 棋子数组
     * @param {Object} start 起始位置的坐标 {x, y}
     * @param {Object} end 目标位置的坐标 {x, y}
     * @returns {boolean} 移动是否合法
     */
    private jiaRule(pieces:any, start:any, end:any){
        const grid = boardUtils.listToArray(pieces);
        const diagonalStep = 1; // 士的步长为1

        if (start.x === end.x && Math.abs(start.y - end.y) === diagonalStep) {
            const offsetY = start.y - end.y > 0 ? -1 : 1;
            const targetPiece = grid[start.x][start.y + offsetY];

            if (!targetPiece || start.isBlackColor !== end.isBlackColor) {
                const halfBoardWidth = BOARD.ROW_SIZE / 2; // 棋盘的中心线
                const targetX = end.x;
                const targetY = end.y;

                if (start.x < halfBoardWidth) {
                    // 左侧士
                    const minX = 0;
                    const maxX = 2;
                    const minY = 3;
                    const maxY = 5;
                    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
                } else {
                    // 右侧士
                    const minX = 7;
                    const maxX = 9;
                    const minY = 3;
                    const maxY = 5;
                    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
                }
            }
        } else if (start.y === end.y && Math.abs(start.x - end.x) === diagonalStep) {
            const offsetX = start.x - end.x > 0 ? -1 : 1;
            const targetPiece = grid[start.x + offsetX][start.y];

            if (!targetPiece || start.isBlackColor !== end.isBlackColor) {
                const halfBoardWidth = BOARD.ROW_SIZE / 2; // 棋盘的中心线
                const targetX = end.x;
                const targetY = end.y;

                if (start.x < halfBoardWidth) {
                    // 左侧士
                    const minX = 0;
                    const maxX = 2;
                    const minY = 3;
                    const maxY = 5;
                    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
                } else {
                    // 右侧士
                    const minX = 7;
                    const maxX = 9;
                    const minY = 3;
                    const maxY = 5;
                    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
                }
            }
        }

        return false;
    }

    /**
     * 炮的规则检查函数
     * @param {Array} pieces 棋子数组
     * @param {Object} start 起始位置的坐标 {x, y}
     * @param {Object} end 目标位置的坐标 {x, y}
     * @returns {boolean} 移动是否合法
     */
    private paoRule(pieces:any, start:any, end:any){
        const grid = boardUtils.listToArray(pieces);

        if (start.x === end.x) {
            // 垂直移动
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);
            const path = [];
            for (let y = minY; y <= maxY; ++y) {
                if (start.y !== y && grid[start.x][y]) {
                    // 棋子阻挡了路径
                    path.push({x: start.x, y});
                }
            }
            if (path.length === 0) return true;
            if (path.length === 2) {
                // 终点处有两个棋子，只有其中一个是目标位置
                return path.some((pos) => pos.x === end.x && pos.y === end.y);
            }
        } else if (start.y === end.y) {
            // 水平移动
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const path = [];
            for (let x = minX; x <= maxX; ++x) {
                if (start.x !== x && grid[x][start.y]) {
                    // 棋子阻挡了路径
                    path.push({x, y: start.y});
                }
            }
            if (path.length === 0) return true;
            if (path.length === 2) {
                // 终点处有两个棋子，只有其中一个是目标位置
                return path.some((pos) => pos.x === end.x && pos.y === end.y);
            }
        }

        return false;
    }

    /**
     *兵的规则检查函数
     *@param {Array} pieces 棋子数组
     *@param {Object} start 起始位置的坐标 {x, y}
     *@param {Object} end 目标位置的坐标 {x, y}
     *@returns {boolean} 移动是否合法
     */
    private bingRule(pieces:any, start:any, end:any){
        const step = 1 // 兵的步长为1
        // 棋盘的中心线
        const bossX = BOARD.ROW_SIZE / 2 // 将的 x 坐标
        const bossSide = pieces.find((piece:any) => piece.isBoss && piece.isBlackColor === start.isBlackColor);

        if (bossSide.x >= bossX) {
            // 将在右侧
            if (start.y === end.y && start.x - end.x === step) return true; // 前进一步
            if (end.x < bossX && start.x === end.x && Math.abs(start.y - end.y) === step) return true; // 在原位时，向左或向右移动一步
        } else {
            // 将在左侧
            if (start.y === end.y && end.x - start.x === step) {
                return true // 前进一步
            }
            // 在原位时，向左或向右移动一步
            if (end.x >= bossX && start.x === end.x && Math.abs(start.y - end.y) === step) {
                return true
            }
        }

        return false;
    };

    /**
     * 处理用户离线
     * @param socket
     * @param userId
     * @param roomId
     * @param battleId
     */

    async handleUserOfflineBattleOver(socket: any, userId: string, roomId: string, battleId: string) {
        const log = global.logUtils.createContext('BattleUtils', 'handleUserOfflineBattleOver', {userId,roomId, battleId});

        const battleUserRows: any = await BattleUserDao.builder().select({battleId, userId});
        const battleHistory: any = await BattleHistoryDao.builder().getUserLastBattleHistory(battleId, userId);


        if (battleHistory) {
            const battleRoom: any = await BattleDao.builder().select({id: battleId, roomId});
            log.info(`对战房间[${battleId}]对应的数据为:`, battleRoom);
            if (battleRoom.length === 0) {
                log.info(`对战房间[${battleId}]无法被获取，结算中止(未结算)`);
            } else {
                const [battle] = battleRoom;
                const [battleUser] = battleUserRows
                const {roomStatus} = battle;

                if (roomStatus === ROOM_STATUS.BATTLE_OVER) {
                    const userRedisKey = `${REDIS_KEYS.USER_OFFLINE_BATTLE_CHANGE_KEY}:${userId}`;
                    await redisUtils.delete(userRedisKey);
                    log.info(`用户[${userId}]已重新上线且对局未结算，清除记录的缓存标记`)
                    const { winUserId, winCode:type} = battle;
                    const isRedColorWin =  battleUser.userId === winUserId && battleUser.first
                    const gameMap = FenUtils.fromFen(battleHistory.gameFen);
                    // 对棋盘进行结算
                    const winResult = this.calcScore(gameMap, type, battleHistory.stepCount);
                    log.debug("得分结果：", winResult);
                    socket.emit('gameWinRespApi', CryptorUtils.encrypt({
                        code: 'success',
                        msg: '对局结算完成',
                        data: {
                            // 相关扣分数据
                            winScore: winResult.winScore,
                            failScore: winResult.failScore,
                            // 是否为红棋胜
                            isRedColorWin: isRedColorWin,
                            // 游戏结算类型
                            type: type,
                            // 对局步数
                            stepCount: battleHistory.stepCount,
                        },
                    }));
                }
            }

        }
    }
}

// 导出组件
export default BattleUtils;
