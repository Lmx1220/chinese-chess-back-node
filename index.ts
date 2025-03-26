import {REDIS} from "./src/configs/config";
import SocketListen from './src/socket/listen';
import HttpListen from './src/http/listen';
import {Server} from "socket.io";
import {createAdapter} from "@socket.io/redis-adapter";
import Redis from "ioredis";
import LogUtils from "./src/utils/log-utils";

import {APP} from "./src/configs/enums";
import BattleTimeJob from "./src/jobs/battle-time-job";
import BattleOfflineJob from "./src/jobs/battle-offline-job";
import ClearUserJob from "./src/jobs/clear-user-job";
import UserOfflineJob from "./src/jobs/user-offline-job";
import OnlineUtils from "./src/utils/online-utils";
import express from "express";
const app = express();
const router = express.Router();


declare global {
    namespace NodeJS {
        interface Global {
            logUtils: LogUtils,
            redisClient: Redis,
            socketIO: Server,
            battleTimeJob: BattleTimeJob,
            battleOfflineJob: BattleOfflineJob,
            clearUserJob: ClearUserJob,
            userOfflineJob: UserOfflineJob,
            serviceKey: SocketListen
        }
    }
}

/**
 * 监听http
 */
function listenHttp() {
    const log = global.logUtils.createContext('Main', 'listenHttp');
    log.info(`开始初始化Http服务...`);
    // 设置跨域访问
    app.all('*', (req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header("Access-Control-Allow-Methods", "PUT,POST,GET,OPTIONS");
        res.header("X-Powered-By", ' 3.2.1');
        res.header("Content-Type", "application/json;charset=utf-8");
        next();
    });

    // 将请求交给路由
    app.use("/", router);
    log.info("开始初始化http路由...");
    new HttpListen(router);

    // 监听
    app.listen(APP.HTTP_PORT, () => {
        log.info(`http服务监听端口[${APP.HTTP_PORT}]...`);
    });
}
/**
 * 监听socket
 */
function listenSocket() {
    const log = global.logUtils.createContext('Main', 'listenSocket');
    try {
        log.info(`开始初始化Socket服务...`);
        const io = new Server({
            path: '/',
            // 在此时间内客户端没有一个pong包回来，就认为连接已经关闭了
            pingTimeout: 5000,
            // 服务器发送心跳包的间隔时间
            // pingInterval: 60000,
            // 是否启用cookie
            cookie: false,
            maxHttpBufferSize: 2e6
        });
        // 设置请求路径
        io.path('chinese-chess');

        // 创建Redis实例
        const redisClient: Redis = new Redis(REDIS.PORT, REDIS.HOST, {
            db: Number(REDIS.DB_NAME),
            password: String(REDIS.PASSWORD)?.trim() || undefined
        });
        global.redisClient = redisClient;


        // socket适配器绑定
        const redisSubClient = redisClient.duplicate();
        io.adapter(createAdapter(redisClient, redisSubClient));

        io.listen(APP.SOCKET_PORT);
        global.socketIO = io;

        log.debug(`开始启动监听服务...`);
        global.serviceKey = new SocketListen(io);
        log.debug(`开始启动调度任务...`);


        global.battleTimeJob = new BattleTimeJob();
        global.battleTimeJob.exec();
        global.battleOfflineJob = new BattleOfflineJob();
        global.battleOfflineJob.exec();
        global.clearUserJob = new ClearUserJob();
        global.clearUserJob.exec();
        global.userOfflineJob = new UserOfflineJob();
        global.userOfflineJob.exec();
        // 初始化在线数据
        new OnlineUtils().loadAllOnlineCount().then(() => {
          log.debug("在线数据初始化成功")
        })
        log.info(`socket服务监听端口[${APP.SOCKET_PORT}]...`);
    } catch (e) {
        log.error('程序启动失败', e);
    }
}

/**
 * 日志初始化(全局日志)
 */
function initLogger() {
    const logUtils = new LogUtils();
    // 创建默认traceId
    logUtils.createTraceId();
    // 全局化
    global.logUtils = logUtils;
}

initLogger();
listenSocket();
listenHttp()