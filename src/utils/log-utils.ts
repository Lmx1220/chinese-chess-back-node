import * as log4js from "log4js";
import {Logger} from "log4js";
import ConstUtils from "./const-utils";
import {AsyncLocalStorage} from "async_hooks";
import DateUtils from "./date-utils";
import {REDIS} from "../configs/config";
import CircularJSON from 'circular-json'
import RestException from "../exception/rest-exception";


const asyncLocalStorage = new AsyncLocalStorage();
const constUtils = new ConstUtils();
const dateUtils = new DateUtils();

// 上下文携带参数
declare interface ContextParams {
    userId?: string;
    battleId?: string;
    roomId?: string;
    token?: string,
}

/**
 * 日志工具类
 * @see https://log4js-node.github.io/log4js-node/
 */
class LogUtils {
    private DEFAULT_CATEGORY_NAME = '中国象棋';
    // 日志参数管理对象，key: traceId, value: ContextParams
    private loggerOptsMap = new Map();

    constructor() {
        this.loadProperties();
    }

    /**
     * 加载日志的配置文件
     */
    private loadProperties = () => {
        // 自定义格式化日志
        log4js.addLayout('json', function (config) {
            return function (logEvent) {
                const logDesc = {
                    ...logEvent,
                    // 覆盖以下属性
                    startTime: dateUtils.formatDate(logEvent.startTime),
                    level: logEvent.level.levelStr,
                    callStack: null,
                    functionName: null,
                }
                return CircularJSON.stringify(logDesc) + config.separator;
            }
        });

        // 配置初始化
        log4js.configure({
            appenders: {
                // 记录到redis
                // @see https://github.com/log4js-node/redis
                redis: {
                    type: '@log4js-node/redis',
                    host: REDIS.HOST,
                    port: REDIS.PORT,
                    pass: REDIS.PASSWORD,
                    // 发布的redis渠道
                    channel: 'chess-log-channel',
                    layout: {
                        type: 'json',
                        separator: ',',
                    },
                },
                // 输出到文件
                file: {
                    type: "file",
                    filename: "./logs/chinese-chess-server.log",
                    pattern: "yyyy-MM-dd",
                    layout: {
                        type: 'pattern',
                        pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS}|%p|%X{traceId}|%X{class}|%X{func}|%m'
                    },
                    // 日志保留天数
                    backups: 60,
                },
                // 输出到控制台
                console: {
                    type: "console",
                    // layout: {
                    //     type: 'pattern',
                    //     pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS}|%p|%X{traceId}|%X{class}|%X{func}|%f{1}:%l|%m'
                    // },
                },
            },
            categories: {
                default: {appenders: ["console", 'file', 'redis'], level: "debug", enableCallStack: true},
            }
        });
    }

    /**
     * 创建trace追踪编号
     * @param token 会话token
     */
    createTraceId = (token?: string) => {
        // 创建追踪Id
        const traceId = constUtils.getUUId();
        // 追踪id记录到上下文
        asyncLocalStorage.enterWith({traceId, token, category: this.DEFAULT_CATEGORY_NAME});
    }

    /**
     * 创建上下文信息
     * @param clsName
     * @param func
     * @param opts
     */
    createContext = (clsName: string, func: string, opts?: ContextParams): Logger => {
        const store: any = asyncLocalStorage.getStore();
        const traceId: string = store.traceId;
        const token: string = store.token;
        const category: string = store.category;
        // 获取上下文日志对象
        const logger: Logger = log4js.getLogger(category);
        // 公共参数
        logger.addContext('traceId', traceId);
        logger.addContext('token', token);
        logger.addContext('class', clsName);
        logger.addContext('func', func);
        // 可选参数
        this.addContext(logger, opts);
        return logger;
    }

    /**
     * 追加Context
     * @param logger
     * @param opts
     */
    addContext = (logger: Logger, opts?: ContextParams): void => {
        const store: any = asyncLocalStorage.getStore();
        const traceId: string = store.traceId;
        const historyOpts: ContextParams = this.loggerOptsMap.get(traceId);
        const newOpts: ContextParams = {};
        // 优先取新的，新的取不到，获取上下文中的
        const userId = opts?.userId || historyOpts?.userId;
        const battleId = opts?.battleId || historyOpts?.battleId;
        const roomId = opts?.roomId || historyOpts?.roomId;
        const token = opts?.token || historyOpts?.token;
        if(userId) {
            logger.addContext('userId', userId);
            newOpts.userId = userId;
        }
        if(battleId) {
            logger.addContext('battleId', battleId);
            newOpts.battleId = battleId;
        }
        if(roomId) {
            logger.addContext('roomId', roomId);
            newOpts.roomId = roomId;
        }
        if(token) {
            logger.addContext('token', token);
            newOpts.token = token;
        }
        this.loggerOptsMap.set(traceId, newOpts);
    }

    /**
     * 销毁上下文
     */
    destroyContext = () => {
        const store: any = asyncLocalStorage.getStore();
        const traceId: string = store.traceId;
        this.loggerOptsMap.delete(traceId);
        // asyncLocalStorage.disable();
    }

    /**
     * 从入参中获取日志对象
     * @param args
     * @param opts
     */
    getArgsLogger(args: IArguments, opts?: ContextParams): Logger {
        // 约定倒数第一个参数为日志对象(使用@Log注解时产生)
        const logArr = [...args].slice(-1);
        const log: Logger = logArr[0];
        // 判断对象是否相等
        if(log?.constructor.name === 'Logger') {
            this.addContext(log, opts);
            return log;
        }
        throw new RestException('从Arguments中获取约定的日志对象失败')
    }
}

export default LogUtils;