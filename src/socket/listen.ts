import SocketUtils from "../utils/socket-utils";
import BattleUtils from "../utils/battle-utils";
import {BATTLE, BATTLE_FLOW_TYPE, GAME_OVER_TYPE, LOGIN_TYPE} from "../configs/enums";
import CryptorUtils from "../utils/cryptor-utils";
import CaptchaUtils from "../utils/captcha-utils";
import UserStateDao from "../dao/user-state-dao";
import BoardUtils from "../utils/board-utils";
import BattleHistoryDao from "../dao/battle-history-dao";
import BattleUserDao from "../dao/battle-user-dao";
import RedLockUtils from "../utils/red-lock-utils";
import DataResp from "../model/data-resp";
import BattleServiceImpl from "./battle-core";
import FileServiceImpl from "./file-core";
import RoomServiceImpl from "./room-core";
import UserServiceImpl from "./user-core";
import SystemServiceImpl from "./system-core";
import SessionUtils from "../utils/session-utils";
import {Log} from "../aop/log-aop";

const socketUtils = new SocketUtils();
const battleUtils = new BattleUtils();
const boardUtils = new BoardUtils();
const sessionUtils = new SessionUtils();
const battleService = new BattleServiceImpl();
const fileService = new FileServiceImpl();
const roomService = new RoomServiceImpl();
const systemService = new SystemServiceImpl();
const userService = new UserServiceImpl();

// Api认证白名单(默认会对所有接口进行token认证)
const API_AUTH_WHITE_NAME_LIST = ['loginApi', 'generateTouristApi', 'registerApi', 'sendValidCodeApi',
    'forgetPasswordApi', 'forgetSendValidCodeApi', 'loginOutApi', 'versionDetailApi', 'getCaptchaApi']
const ROOM_UNIQUE_KEY = 'roomLock';

class SocketListen {

    constructor(io: any) {
        io.use((socket: any, next: Function) => {
            const {token, f, h, v} = socket.handshake.query;
            try {
                const validJson = CryptorUtils.decrypt(v, h, token)
                const {token: vToken, hex: vHex, time: vTime} = validJson;
                if (vToken === token && vHex === h) {
                    return next();
                }
                return next(new Error("凭证或指纹采集失败"));
            } catch (e) {
                // 非法的入参，直接关闭socket
                socket.disconnect(true);
            }
        }).on('connection', async (socket: any) => {
            const token = socketUtils.getToken(socket);
            const ip = socketUtils.getClientIp(socket);
            global.logUtils.createTraceId(token)
            const log = global.logUtils.createContext('SocketListen', 'connection');
            log.info(`token[${token}]已经连接`);

            // ip城市信息
            // const ipCityInfo = await socketUtils.getIpCity(ip);
            // log.debug(`ip信息为：${ipCityInfo}`);
            global.logUtils.createTraceId(token)
            socket.prependAny(async (api: any, ...args: any[]) => {
                // 数据解密
                const request = args ? CryptorUtils.decrypt(args[0]) : {};
                const userId = request?.userId;
                const roomId = request?.roomId;
                const battleId = request?.battleId;
                global.logUtils.createTraceId(token)
                const log = global.logUtils.createContext('SocketListen', `pre.${api}`, {userId, roomId, battleId});
                log.info(`请求参数：`, request);

                if (!API_AUTH_WHITE_NAME_LIST.some(whitApi => api === whitApi)) {
                    // 会话过期检查
                    const tokenIsExpire = await systemService.checkSessionExpired(userId, token, ip);
                    if (tokenIsExpire) {
                        socket.emit('sessionRecoverRespApi', CryptorUtils.encrypt({
                            code: 'S000003',
                            msg: '您的会话已经过期，请重新登录',
                        }));
                        log.warn(`[${userId}]关联的token[${token}]会话已过期`);
                        // 主动断开
                        socket.disconnect(true);
                    }

                }
                global.logUtils.destroyContext();
            })

            // 连接服务器时，进行会话检测及恢复（适用于用户未离线，但切后台导致断线的信息）
            this.connectSessionRecover(socket);
            // 用户登录
            this.loginListen(socket);
            // 获取图片验证码
            this.getCaptchaListen(socket);
            // 用户详情查询
            this.userDetailListen(socket);
            // 修改用户详情
            this.modifyUserDetail(socket);
            // 自动生成游客账号
            this.autoGenerateTouristListen(socket);
            // 版本检测
            this.getVersionListen(socket);
            // 获取版本详情检查
            this.getVersionDetailListen(socket);
            // 用户注册
            this.registerListen(socket);
            // 发送验证码（注册验证）
            this.sendValidCodeListen(socket);
            // 找回密码
            this.forgetPasswordListen(socket);
            // 发送验证码（找回密码验证）
            this.forgetPasswordValidCodeListen(socket);
            // 退出登录
            this.loginOutListen(socket);
            // 获取可以观战的房间列表
            this.watchListListen(socket);
            // 用户消息
            this.userChatListen(socket);
            // 加入观战
            this.joinWatchListen(socket);
            // 离开观战
            this.leaveWatchListen(socket);
            // 用户加入房间
            this.joinRoomListen(socket);
            // 加入受邀请的房间
            this.joinInviteRoomListen(socket);
            // 用户换桌监听
            this.swapDeskListen(socket);
            // 邀请用户
            this.inviteUserListen(socket);
            // 被邀请用户是否应邀应声
            this.inviteUserResultListen(socket);
            // 用户已准备监听
            this.userReadyListen(socket);
            // 用户离开房间
            this.leaveRoomListen(socket);
            // 用户发起「求和」申请
            this.sendPeaceListen(socket);
            // 对手对「求和」愿意进行处理
            this.sendPeaceResultListen(socket);
            // 校验两端的对战数据是否一致（客户端断网重连后发起）
            this.userBattleDataCheckListen(socket);
            // 检查用户离线后，对局是否结束了（状态同步）
            this.userOfflineBattleOverListen(socket);
            // 用户发起「悔棋」申请
            this.backMoveListen(socket);
            // 对手对对「悔棋」愿意进行了回应
            this.backMoveResultListen(socket);
            // 对局-棋子移动
            this.moveChessListen(socket);
            // 同步房间信息
            this.syncRoomListen(socket);
            // 同步对战信息
            this.syncBattleDataListen(socket);
            // 认输监听
            this.userAdmitDefeatListen(socket);
            // 客户端超时发起结束算
            this.gameWinListen(socket);
            // 用户断开连接监听
            this.disconnectListen(socket);
            // 可复盘的对局列表监听
            this.battleReviewListListen(socket);
            // 离开复盘列表
            this.leaveReviewListListen(socket);
            // 复盘棋局的数据加载监听
            this.battleReviewDetailListen(socket);
            // 获取分享链接
            this.getShareLinkListen(socket);
            // 在线用户数据统计
            this.onlineCountListen(socket);
            // 房间内观战用户数据统计
            this.watchCountListen(socket);
            // 桌子列表监听
            this.roomListListen(socket);
            // 上传base64图片
            this.uploadBase64(socket);
            // 将用户踢出房间
            this.kickUserListen(socket);
        })

    }

    /**
     * 可复盘的对局列表监听
     * @param socket
     */
    battleReviewListListen = (socket: any) => {
        socket.on('battleReviewApi', async (request: any, fn: Function) => {
            const {userId, pageNum, pageSize} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!pageSize || !pageNum) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '分页参数为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.battleReviewImpl(socket, userId, pageNum, pageSize);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 离开复盘列表
     * @param socket
     */
    leaveReviewListListen = (socket: any) => {
        socket.on('leaveReviewListApi', async (request: any, fn: Function) => {
            const {userId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.leaveReviewListImpl(socket, userId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 加载某局要复盘的数据信听
     * @param socket
     */
    battleReviewDetailListen = (socket: any) => {
        socket.on('battleReviewDetailApi', async (request: any, fn: Function) => {
            const {userId, battleId, pageSize} = CryptorUtils.decrypt(request);
            if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!pageSize) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '分页参数为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.battleReviewDetailImpl(socket, userId, battleId, pageSize);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 获取分享链接
     * @param socket
     */
    getShareLinkListen = (socket: any) => {
        socket.on('getShareLinkApi', async (request: any, fn: Function) => {
            const {userId, battleId} = CryptorUtils.decrypt(request);
            if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.getShareLinkImpl(socket, userId, battleId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 恢复会话数据（客户端一连接就会检测）
     * @param socket
     */
    @Log({excludeNames: 'socket'})
    connectSessionRecover(socket: any) {
        const log = global.logUtils.getArgsLogger(arguments);
        setTimeout(async () => {
            const token = socketUtils.getToken(socket);

            // 这个方法，新老用户都会触发，所以校验这个token有没有游离数据，再决定是否继续会话恢复
            const userState = await UserStateDao.builder().selectOne({token});
            if (userState) {
                console.log(`开始为[${token}]进行会话恢复处理`);
                await sessionUtils.sessionRecoverDetail(socket);
            }
        }, 0)
    }

    /**
     * 用户断开连接监听
     * @param socket
     */
    disconnectListen = (socket: any) => {
        socket.conn.on('close', (reason: string) => {
            // called when the underlying connection is closed
            // 移除所有事件
            socket.removeAllListeners();
            // 断开的逻辑
            global.logUtils.createTraceId(socketUtils.getToken(socket));
            systemService.disconnectImpl(socket, reason);
        });
    }

    /**
     * 消息转发
     * @param socket
     */
    userChatListen = (socket: any) => {
        socket.on('chatApi', async (request: any, fn: Function) => {
            const {userId, roomId, battleId, content} = CryptorUtils.decrypt(request);
            if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!content || content.length > 30) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '内容限制在30个字内'}));
            } else {
                const dataResp: DataResp<any> = await battleService.userChatImpl(socket, userId, roomId, battleId, content);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 客户端超时发起回调
     * @param socket
     */
    gameWinListen = (socket: any) => {
        socket.on('gameWinApi', async (request: any, fn: Function) => {
            const {userId, roomId, battleId, overUserId} = CryptorUtils.decrypt(request);
            // 检查解密后的数据是否完整
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!overUserId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '结束账号为空'}));
            } else {
                // 对于客户端的请求结算，是不可信的，在入口做可达条件判断
                const log = global.logUtils.createContext('SocketListen', 'gameWinListen', {userId, roomId, battleId});
                const battleUserRows: any = await BattleUserDao.builder().select({battleId, userId: overUserId});
                const battleHistory: any = await BattleHistoryDao.builder().getUserLastBattleHistory(battleId, overUserId);
                if (battleHistory == null || battleUserRows.length == 0) {
                    log.info('对局数据异常，battleUserRows：', battleUserRows, '，battleHistory：', battleHistory);
                    fn(CryptorUtils.encrypt({code: 'fail', msg: '对局数据异常'}));
                } else {
                    const [battleUser] = battleUserRows;
                    const {allTime, stepTime} = global.battleTimeJob.battleTimeCalc(battleUser, battleHistory);
                    log.info(`对局时间数据, 局时: ${allTime}， 步时: ${stepTime}`);
                    // 判断是否可以结算
                    if (stepTime <= 0) {
                        log.info('开始发起结束');
                        let lock = await RedLockUtils.acquire([battleId]);
                        try {
                            await battleService.gameWinImpl(socket, overUserId, battleId, roomId, GAME_OVER_TYPE.USER_TIMEOUT);
                        } finally {
                            await lock.release();
                        }
                    } else if (stepTime > 5) {
                        // 此处如果步时相关较大时(5秒)，才下发对战数据
                        log.warn('步时未达到结束条件, 判定房间异常数据, 主动下发对战数据');
                        await battleUtils.sendBattleData(userId, battleId);
                    }
                }
            }
        });
    };

    /**
     * 对方认输处理
     * @param socket
     */
    userAdmitDefeatListen = (socket: any) => {
        socket.on('userAdmitDefeatApi', async (request: any, fn: Function) => {
            const {userId, roomId, battleId} = CryptorUtils.decrypt(request);
            if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                const lock = await RedLockUtils.acquire([battleId]);
                try {
                    const dataResp: DataResp<any> = await battleService.userAdmitDefeatImpl(socket, userId, roomId, battleId);
                    fn(CryptorUtils.encrypt(dataResp));
                } finally {
                    await lock.release();
                }
            }
        });
    };

    /**
     * 同步对战数据监听
     * @param socket
     */
    syncBattleDataListen = (socket: any) => {
        socket.on('syncBattleDataApi', async (request: any, fn: Function) => {
            const {battleId, roomId, userId} = CryptorUtils.decrypt(request);
            const log = global.logUtils.createContext('SocketListen', 'syncBattleDataListen', {
                userId,
                battleId,
                roomId
            });
            if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.syncBattleDataImpl(socket, battleId, userId, roomId);
                fn(CryptorUtils.encrypt(dataResp));

            }
        })
    }

    /**
     * 同步房间数据监听（非对战数据）
     * @param socket
     */
    syncRoomListen = (socket: any) => {
        socket.on('syncRoomDataApi', async (request: any, fn: Function) => {
            const {roomId, userId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.syncRoomDataImpl(socket, userId, roomId);
                fn(CryptorUtils.encrypt(dataResp));

            }
        })
    }

    /**
     * 棋子传递
     * @param socket
     */
    moveChessListen = (socket: any) => {
        socket.on('moveChessApi', async (request: any, fn: Function) => {
            const {
                from,
                to,
                fromChessBox,
                toChessBox,
                battleId,
                roomId,
                userId,
                stepExplain,
            } = CryptorUtils.decrypt(request);
            if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!stepExplain) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '棋谱为空'}));
            } else if (!from || !to || !fromChessBox || !toChessBox) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '棋子信息为空'}));
            } else {
                let lock = await RedLockUtils.acquire([battleId])
                try {
                    const dataResp: DataResp<any> = await battleService.moveChessImpl(socket, battleId, userId, roomId, from, to,
                        fromChessBox, toChessBox, stepExplain);
                    // 内部错误等情况时，此response不会返回值
                    if (dataResp.isSuccess()) {
                        const {isOver, type, nextIsRedMove} = dataResp.getData();
                        // 棋子操作事件传递
                        const transformPos = boardUtils.transformPosition(from, to)
                        socket.to(roomId).emit('moveChessRespApi', CryptorUtils.encrypt({
                            code: 'success',
                            msg: '棋子传递',
                            data: {
                                from: transformPos.fromPos,
                                to: transformPos.toPos,
                                // 棋子来源于哪个用户
                                chessFromUserId: userId,
                            }
                        }));
                        // 更新对战的落子方
                        global.battleTimeJob.updateBattleData(battleId, {isRedMove: nextIsRedMove})

                        //我方需要重置超时时间（放在事务提交后）
                        global.battleTimeJob.resetBattleStepTime(battleId, userId)

                        //倒计时数据传递
                        socket.emit('userTimeRespApi', CryptorUtils.encrypt({
                            code: 'success',
                            data: {
                                userList: await global.battleTimeJob.getBattleTimeList(battleId)
                            }
                        }));
                        // 结果通知回调
                        fn(CryptorUtils.encrypt({code: 'success', msg: '传送成功'}));

                        // 结算游戏
                        if (isOver) {
                            await battleService.gameWinImpl(socket, userId, battleId, roomId, type)
                        }
                    } else {
                        fn(CryptorUtils.encrypt(dataResp));
                    }

                } finally {
                    await lock.release();
                }


            }
        })
    }

    /**
     * 对方对「请求悔棋」愿意进行了处理
     * @param socket
     */
    backMoveResultListen = (socket: any) => {
        socket.on('backMoveResultApi', async (request: any, fn: Function) => {
            const {userId, roomId, result, battleId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!result) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '悔棋结果为空'}));
            } else if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.backMoveResultImpl(socket, userId, roomId, result, battleId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 对局过程中，校验客户端的数据和服务端的是否一致
     * @param socket
     */
    userBattleDataCheckListen = (socket: any) => {
        socket.on('userBattleDataCheckApi', async (request: any, fn: Function) => {
            const {userId, roomId, battleId, step} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!step) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '悔棋结果为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.userBattleDataCheckImpl(socket, userId, roomId, battleId, step);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 检查用户离线后，对局是否结束了（状态同步）
     * @param socket
     */
    userOfflineBattleOverListen = (socket: any) => {
        socket.on('userOfflineBattleOverApi', async (request: any, fn: Function) => {
            const {userId, roomId, battleId, step} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.userOfflineBattleOver(socket, userId, roomId, battleId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 请求悔棋
     * @param socket
     */
    backMoveListen = (socket: any) => {
        socket.on('backMoveApi', async (request: any, fn: Function) => {
            const {userId, roomId, battleId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if ((await battleUtils.checkWaitingRequest(userId))) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '请求等待对方响应'}));
            } else if (!(await battleUtils.checkBackMoveStatus(userId, battleId, roomId))) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '达到最大悔棋次数'}));
            } else {

                const dataResp: DataResp<any> = await battleService.backMoveImpl(socket, userId, roomId, battleId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 「求和」对手方处理了求和意愿
     * @param socket
     */
    sendPeaceResultListen = (socket: any) => {
        socket.on('sendPeaceResultApi', async (request: any, fn: Function) => {
            const {userId, roomId, result, battleId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (!result) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '求和结果为空'}));
            } else {
                let lock = await RedLockUtils.acquire([battleId]);
                try {
                    const dataResp: DataResp<any> = await battleService.sendPeaceResultImpl(socket, userId, roomId, result, battleId);
                    fn(CryptorUtils.encrypt(dataResp));
                } finally {
                    await lock.release();
                }
            }
        });
    };

    /**
     * 发起「求和」
     * @param socket
     */
    sendPeaceListen = (socket: any) => {
        socket.on('sendPeaceApi', async (request: any, fn: Function) => {
            const {userId, roomId, battleId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else if (!battleId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '对战号为空'}));
            } else if (await battleUtils.checkWaitingRequest(userId)) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '请等待对方响应'}));
            } else if (await battleUtils.checkShortTimeRepeatSend(userId, BATTLE.REQUEST_INTERVAL_SECONDS, BATTLE_FLOW_TYPE.PEACE)) {
                fn(CryptorUtils.encrypt({
                    code: 'fail',
                    msg: `还距上次${BATTLE.REQUEST_INTERVAL_SECONDS / 60}分钟后再试`
                }));
            } else {
                const dataResp: DataResp<any> = await battleService.sendPeaceImpl(socket, userId, roomId, battleId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 离开房间
     * @param socket
     */
    leaveRoomListen = (socket: any) => {
        socket.on('leaveRoomApi', async (request: any, fn: Function) => {
            const {userId, roomId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                let lock = await RedLockUtils.acquire([ROOM_UNIQUE_KEY])
                try {
                    const dataResp: DataResp<any> = await roomService.leaveRoomImpl(socket, userId, roomId);
                    fn(CryptorUtils.encrypt(dataResp));
                } finally {
                    await lock.release();
                }

            }
        });
    };

    /**
     * 玩家准备
     * @param socket
     */
    userReadyListen = (socket: any) => {
        socket.on('userReadyApi', async (request: any, fn: Function) => {
            const {userId, roomId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                let lock = await RedLockUtils.acquire([ROOM_UNIQUE_KEY])
                try {
                    const dataResp: DataResp<any> = await roomService.userReadyImpl(socket, userId, roomId);
                    fn(CryptorUtils.encrypt(dataResp));
                } finally {
                    await lock.release();

                }
            }
        });
    };

    /**
     * 用户发起换桌
     * @param socket
     */
    swapDeskListen = (socket: any) => {
        socket.on('swapDeskApi', async (request: any, fn: Function) => {
            const {userId, roomId, joinType, oldRoomIds} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '旧房间号为空'}));
            } else if (!joinType) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间类型为空'}));
            } else {
                let lock = await RedLockUtils.acquire([ROOM_UNIQUE_KEY]);
                try {
                    const dataResp: DataResp<any> = await roomService.swapDeskImpl(socket, userId, roomId, joinType, oldRoomIds);
                    fn(CryptorUtils.encrypt(dataResp));
                } finally {
                    await lock.release();
                }
            }
        });
    };

    /**
     * 邀请用户
     * @param {socket} socket
     */
    inviteUserListen = (socket: any) => {
        socket.on('inviteUserApi', async (request: any, fn: Function) => {
            const {userId, roomId, inviteUserId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({'code': 'fail', 'msg': '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({'code': 'fail', 'msg': '房间号为空'}));
            } else if (!inviteUserId) {
                fn(CryptorUtils.encrypt({'code': 'fail', 'msg': '被邀请人为空'}));
            } else {
                let lock = await RedLockUtils.acquire([roomId]);
                try {
                    const dataResp: DataResp<any> = await roomService.inviteUserImpl(socket, userId, roomId, inviteUserId);
                    fn(CryptorUtils.encrypt(dataResp));
                } finally {
                    await lock.release();
                }
            }
        });
    };

    /**
     * 被邀请用户结果响应
     * @param socket
     */
    inviteUserResultListen = (socket: any) => {
        socket.on('inviteUserResultApi', async (request: any, fn: Function) => {
            const {userId, inviteId, result, rejectDesc} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!inviteId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邀请码为空'}));
            } else if (!result) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邀请响应结果为空'}));
            } else {
                const dataResp: DataResp<any> = await roomService.inviteUserResultImpl(socket, userId, inviteId, result, rejectDesc);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 加入房间监听
     * @param socket
     */
    joinRoomListen = (socket: any) => {
        socket.on('joinRoomApi', async (request: any, fn: Function) => {
            const {userId, joinType, oldRoomIds} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!joinType) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间类型为空'}));
            } else {
                const distributionResp: DataResp<any> = await roomService.distributionRoomImpl(userId, oldRoomIds);
                if (distributionResp.isSuccess()) {
                    const roomId = distributionResp.getData();
                    let lock = await RedLockUtils.acquire([ROOM_UNIQUE_KEY])
                    try {
                        const dataResp: DataResp<any> = await roomService.joinRoomImpl(socket, userId, joinType, roomId, oldRoomIds);
                        fn(CryptorUtils.encrypt(dataResp));
                    } finally {
                        await lock.release();
                    }

                } else {
                    fn(CryptorUtils.encrypt(distributionResp));
                }


            }
        });
    };

    /**
     * 加入受邀请的房间
     * @param socket
     */
    joinInviteRoomListen = (socket: any) => {
        socket.on('joinInviteRoomApi', async (request: any, fn: Function) => {
            const {userId, joinType, inviteId, roomId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!joinType) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间类型为空'}));
            } else if (!inviteId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邀请ID为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '受邀房间号为空'}));
            } else {
                let lock = await RedLockUtils.acquire([roomId]);
                try {
                    const dataResp: DataResp<any> = await roomService.joinInviteRoomImpl(socket, userId, joinType, inviteId);
                    fn(CryptorUtils.encrypt(dataResp));
                } finally {
                    await lock.release();
                }
            }
        });
    };

    /**
     * 离开观战房间监听
     * @param socket
     */
    leaveWatchListen = (socket: any) => {
        socket.on('leaveWatchRoomApi', async (request: any, fn: Function) => {
            const {userId, roomId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.leaveWatchImpl(socket, userId, roomId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 加入观战
     * @param socket
     */
    joinWatchListen = (socket: any) => {
        socket.on('joinWatchApi', async (request: any, fn: Function) => {
            const {userId, roomId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.joinWatchImpl(socket, userId, roomId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 获取可以观战的房间列表
     * @param socket
     */
    watchListListen = (socket: any) => {
        socket.on('watchListApi', async (request: any, fn: Function) => {
            const {userId, pageNum, pageSize} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!pageNum || !pageSize) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: 'pageNum/pageSize为空'}));
            } else {
                const dataResp: DataResp<any> = await battleService.watchListImpl(socket, userId, pageNum, pageSize);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 退出登录
     * @param socket
     */
    loginOutListen = (socket: any) => {
        socket.on('loginOutApi', async (request: any, fn: Function) => {
            const {userId} = CryptorUtils.decrypt(request);
            if (userId) {
                const dataResp: DataResp<any> = await userService.loginOutImpl(socket, userId);
                fn(CryptorUtils.encrypt(dataResp));
            } else {
                fn(CryptorUtils.encrypt({code: 'success', msg: '退出成功'}));
            }
        });
    };

    /**
     * 发送验证码监听
     * @param socket
     */
    sendValidCodeListen = (socket: any) => {
        socket.on('sendValidCodeApi', async (request: any, fn: Function) => {
            const {userId, email, userName} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!email) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邮箱为空'}));
            } else {
                const dataResp: DataResp<any> = await userService.sendValidCodeImpl(socket, userId, userName, email);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 找回密码
     * @param socket
     */
    forgetPasswordListen = (socket: any) => {
        socket.on('forgetPasswordApi', async (request: any, fn: Function) => {
            const {userId, email, password, validCode} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账户为空'}));
            } else if (!email) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邮箱为空'}));
            } else if (!password) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '密码为空'}));
            } else if (!(/[A-Za-z]/).test(password)) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '密码至少包含一位字母'}));
            } else if (!(/[A-Za-z0-9_]+$/.test(password))) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '密码只支持字母、数字、下划线'}));
            } else {
                const dataResp: DataResp<any> = await userService.forgetPasswordImpl(socket, userId, email, password, validCode);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 发送验证码（找回密码验证）
     * @param socket
     */
    forgetPasswordValidCodeListen = (socket: any) => {
        socket.on('forgetSendValidCodeApi', async (request: any, fn: Function) => {
            const {userId, email} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!email) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邮箱为空'}));
            } else {
                const dataResp: DataResp<any> = await userService.forgetPasswordSendValidCodeImpl(socket, userId, email);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 注册账号监听
     * @param socket
     */
    registerListen = (socket: any) => {
        socket.on('registerApi', async (request: any, fn: Function) => {
            const {userId, password, userName, email, validCode, captcha} = CryptorUtils.decrypt(request);
            const token = socketUtils.getToken(socket);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!(/^[0-9A-Za-z_]+$/ig.test(userId))) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号仅支持字母数字下划线'}));
            } else if (!userName) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '昵称为空'}));
            } else if (!password) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '密码为空'}));
            } else if (!(/[A-Za-z]/).test(password)) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '密码至少包含一位字母'}));
            } else if (!(/[A-Za-z]+[0-9_]*$/).test(password)) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '密码仅支持字母、数字、下划线'}));
            } else if (email && !validCode) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邮箱验证码为空'}));
            } else if (validCode && !email) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '邮箱为空'}));
            } else if (!email && !captcha) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '验证码为空'}));
            } else if (!email && captcha.toString().toLowerCase() !== socket.captcha) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '验证码错误'}));
            } else if (await UserStateDao.builder().checkTokenExists(token)) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '身份验证存疑，请稍候重试~'}));
            } else {
                const dataResp: DataResp<any> = await userService.registerImpl(socket, userId, userName, password, email, validCode);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 登录请求监听
     * @param socket
     */
    loginListen = (socket: any) => {
        socket.on('loginApi', async (request: any, fn: Function) => {
            const {userId, password, type, ticket, openId, accessToken} = CryptorUtils.decrypt(request);
            const log = global.logUtils.createContext('SocketListen', 'loginListen', {userId});

            if (!type) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '登录类型错误'}));
                return;
            } else if (type === LOGIN_TYPE.TICKET && !ticket) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '凭证验证失败'}));
                return;
            } else if (type === LOGIN_TYPE.USER_PASS) {
                if (!userId) {
                    fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
                    return;
                } else if (!password) {
                    fn(CryptorUtils.encrypt({code: 'fail', msg: '密码为空'}));
                    return;
                }
            }
            const oprUserId = userId || ticket || openId;
            let lock = await RedLockUtils.acquire([oprUserId]);
            try {
                const kickUserBy = (token: string) => {
                    const allSockets: any = socketUtils.getSocketsBy(token);
                    const newToken = socketUtils.getToken(socket);
                    //两次token不一致是才踢
                    if (allSockets.length && token !== newToken) {
                        const [closeSocket] = allSockets;
                        closeSocket?.emit('userConflictRespApi', CryptorUtils.encrypt({
                            code: 'success',
                            msg: '账号登录冲突',
                        }));
                        closeSocket?.disconnect(true);
                        log.info(`[${oprUserId}]使用的旧token[${token}]已被踢下线，新token为：${newToken}`);
                    }
                }

                // 未登录前，查询该用户的游离数据，将通过旧的token，将其余用户踢出去
                const dataResp: DataResp<any> = await userService.loginImpl(socket, userId, password, ticket, type, openId, accessToken);
                const {kickToken, loginTicket, userId: loginUserId, recoveryUserId} = dataResp.getData() || {}
                // 登录成功后
                if (dataResp.isSuccess()) {
                    fn(CryptorUtils.encrypt({
                        code: 'success',
                        msg: '登录成功',
                        data: {
                            ticket: loginTicket,
                            userId: loginUserId,
                        }
                    }));
                    // 踢出其它账户信息
                    kickToken && kickUserBy(kickToken);
                    // 会话数据恢复
                    recoveryUserId && await sessionUtils.loginAfterSessionRecover(socket, recoveryUserId);
                } else {
                    fn(CryptorUtils.encrypt(dataResp));
                }

            } catch (e) {
                log.error("登录发生错误：", e);
            } finally {
                await lock.release();
            }
        });
    };

    /**
     * 获取验证码监听
     * @param socket
     */
    getCaptchaListen = (socket: any) => {
        socket.on('getCaptchaApi', async (request: any, fn: Function) => {
            const {svg, code} = CaptchaUtils.getCaptcha();
            fn(CryptorUtils.encrypt({
                code: 'success',
                msg: '获取验证码成功',
                data: {
                    svg: svg
                }
            }));
            // 将验证码挂在socket上面
            socket.captcha = code;
        });
    }

    /**
     * 获取用户详情
     * @param socket
     */
    userDetailListen = (socket: any) => {
        socket.on('userDetailApi', async (request: any, fn: Function) => {
            const {userId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else {
                const dataResp: DataResp<any> = await userService.userDetailImpl(socket, userId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 修改用户详情
     * @param socket
     */
    modifyUserDetail = (socket: any) => {
        socket.on('modifyUserDetailApi', async (request: any, fn: Function) => {
            // modifyDetail为对象，包含字段和值，{age: 10, name: '小天'}
            const {userId, modifyDetail} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!modifyDetail) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '修改内容为空'}));
            } else {
                const dataResp: DataResp<any> = await userService.modifyUserDetailImpl(socket, userId, modifyDetail);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 生成游客账号
     * @param socket
     */
    autoGenerateTouristListen = (socket: any) => {
        socket.on('generateTouristApi', async (request: any, fn: Function) => {
            const {captcha} = CryptorUtils.decrypt(request);
            const token = socketUtils.getToken(socket);
            const ipAddress = socketUtils.getClientIp(socket);
            const finger = socketUtils.getFinger(socket);
            if (!token) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '无法获取验证令牌'}));
            } else if (!captcha) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '验证码为空'}));
            } else if (captcha.toString().toLowerCase() !== socket.captcha) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '验证码错误'}));
            } else if (await UserStateDao.builder().checkTokenExists(token)) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '身份验证存疑，请稍后再试~'}));
            } else {
                const dataResp: DataResp<any> = await userService.autoGenerateTouristImpl(socket, token, finger);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 客户端版本检查
     * @param socket
     */
    getVersionListen = (socket: any) => {
        systemService.getVersionImpl(socket)
    };

    /**
     * 获取版本详情
     * @param socket
     */
    getVersionDetailListen = (socket: any) => {
        const log = global.logUtils.createContext('SocketListen', 'getVersionDetailListen');
        socket.on('versionDetailApi', async (request: any, fn: Function) => {
            // log.debug('查询版本详细信息');
            const dataResp: DataResp<any> = await systemService.getVersionDetailImpl(socket);
            fn(CryptorUtils.encrypt(dataResp));
        });
    };

    /**
     * 在线用户数据统计
     * @param socket
     */
    onlineCountListen = (socket: any) => {
        socket.on('onlineCountApi', async (request: any, fn: Function) => {
            const {userId} = CryptorUtils.decrypt(request);
            const log = global.logUtils.createContext('SocketListen', 'onlineCountListen', {userId});
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else {
                const dataResp: DataResp<any> = await systemService.onlineCountImpl(socket, userId)
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 房间的观战人数信息统计
     * @param socket
     */
    watchCountListen = (socket: any) => {
        socket.on('watchCountApi', async (request: any, fn: Function) => {
            const {userId, roomId} = CryptorUtils.decrypt(request);
            const log = global.logUtils.createContext('SocketListen', 'watchCountListen', {userId});
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                const dataResp: DataResp<any> = await systemService.watchCountImpl(socket, userId, roomId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 桌子列表监听
     * @param socket
     */
    roomListListen = (socket: any) => {
        socket.on('roomListApi', async (request: any, fn: Function) => {
            const {userId, bindRoomLocation, pageNum, pageSize} = CryptorUtils.decrypt(request);
            const log = global.logUtils.createContext('SocketListen', 'roomListListen', {userId});
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!pageNum) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '页码为空'}));
            } else if (!pageSize) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '每页条数据为空'}));
            } else if (typeof bindRoomLocation === 'undefined') {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '是否绑定房间为空'}));
            } else {
                const dataResp: DataResp<any> = await roomService.roomListImpl(socket, userId, bindRoomLocation, pageNum, pageSize);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

    /**
     * 上传base64
     * @param socket
     */
    uploadBase64 = (socket: any) => {
        socket.on('uploadPictureApi', async (request: any, fn: Function) => {
            const {userId, fileName, fileSize, base64, contentType} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!fileName) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '文件名为空'}));
            } else if (!fileSize) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '文件大小为空'}));
            } else if (!base64) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: 'base64为空'}));
            } else if (!contentType) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '文件类型为空'}));
            } else {
                const dataResp: DataResp<any> = await fileService.uploadBase64Impl(socket, userId, fileName, fileSize, base64, contentType);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    }

    /**
     * 请求踢人
     * @param socket
     */
    kickUserListen = (socket: any) => {
        socket.on('kickUserApi', async (request: any, fn: Function) => {
            const {userId, kickUserId, roomId} = CryptorUtils.decrypt(request);
            if (!userId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '账号为空'}));
            } else if (!kickUserId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '被踢人账号为空'}));
            } else if (!roomId) {
                fn(CryptorUtils.encrypt({code: 'fail', msg: '房间号为空'}));
            } else {
                const dataResp: DataResp<any> = await roomService.kickUserImpl(socket, userId, kickUserId, roomId);
                fn(CryptorUtils.encrypt(dataResp));
            }
        });
    };

}

export default SocketListen;
