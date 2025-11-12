/**
 * 用户角色
 */
export const enum USER_ROLE{
    // 对战角色
    BATTLE = 'ROLE_BATTLE',
    // 观战角色
    WATCH = 'ROLE_WATCH'
}
/**
 * 加入房间的类型
 */
export const enum ROOM_JOIN_TYPE{
    RANDOM= 'random',
    FREEDOM ='freedom',
}


/**
 * 应用程序配置
 */
export const enum APP {
    // 应用程序占用端口
    SOCKET_PORT = 9099,
    HTTP_PORT = 7005,

    /** -- 邀请设置 -- */
    INVITE_LIMIT_SECONDS = 10,
    /** -- 验证码设置 -- */
        // 验证码有效时间（单位：分钟）
    CODE_VALID_TIME_MINUTES = 5,
    // 当天最大发送次数
    CODE_TODAY_MAX_SEND_COUNT = 5,

    // 文件上传的本地路径
    FILE_LOCAL_PATH = '/data/projects/uploadfile/',
    // FILE_LOCAL_PATH = '/Users/lmx/data/projects/uploadfile/socket-chess-file/uploadfile/',
    // 文件上传时的域名
    FILE_SHOW_DOMAIN = 'https://chess.kpui.top/images',
    // 分享时的域名
    SHARE_DOMAIN = 'https://chess.kpui.top',
    // 长时间未操作的天数
    LONG_TIME_NOT_OPERATE_DAYS = 30,
}
/**
 * 用户状态
 */
export const enum USER_STATUS {
    PLATFORM = '0001',
    IN_ROOM = '0002',
    WATCH = '0003',
    BATTLE = '0004',
}
/**
 * 房间状态
 */
export const enum ROOM_STATUS {
    // 空房间
    EMPTY = 'EMPTY',
    // 有人在房间中等待(仅1个人)
    WAIT = 'WAIT',
    // 多个人在房间中等待
    MULTIPLE_WAIT = 'MULTIPLE_WAIT',
    // 匹配成功
    MATCH_SUCCESS = 'MATCH_SUCCESS',
    // 对战中
    BATTLE = 'BATTLE',
    // 对战有一方超时了
    TIMEOUT = 'TIMEOUT',
    // 对战结束，等待结算
    BATTLE_OVER = 'BATTLE_OVER',
}
/**
 * 房间流水表类型
 */
export const enum ROOM_FLOW_TYPE {
    // 0001-被踢,
    KICK = '0001',
    // 0002-加锁
    LOCK = '0002',
}
/**
 * redis所有的key管理
 */
export const enum REDIS_KEYS {
    // 用户踢房间
    ONLINE_DATA_CACHE_KEY = 'ONLINE:DATA:CACHE:KEY',
    USER_KICK_ROOM_KEY = 'USER:KICK:ROOM:KEY',
    // 邀请用户的key
    INVITE_USER_KEY = 'INVITE:USER:KEY',
    // 对战用户离线
    BATTLE_OFFLINE_KEY = 'BATTLE:OFFLINE:TIME',
    // 存储对战用户离线后，会将`BATTLE_OFFLINE_KEY`所产生的key
    BATTLE_OFFLINE_KEYS = "BATTLE:OFFLINE:KEYS",
    // 用户对战中的key
    USER_OFFLINE_BATTLE_CHANGE_KEY= 'USER:OFFLINE:BATTLE:CHANGE:KEY',

}
/**
 * 客户端平台枚举(与客户端保持一致)
 */
export const enum PAGE_STATUS {
    LOGIN = 'login',
    PLATFORM = 'platform',
    PLAYER_RANDOM = 'playerRandom',
    PLAYER_FREEDOM = 'playerFreedom',
    BOARD = 'board',
    WATCH = 'watch',
    REVIEW = 'review',
}
/**
 * 布尔值
 */
export const enum BOOLEAN {
    YES = 'YES',
    NO = 'NO',

    AGREE = 'agree',
    REJECT = 'reject',

    SHORT_YES = 'Y',
    SHORT_NO = 'N',
}
/**
 * 对战相关配置
 */
export const enum BATTLE {
    // 房间被踢后，多长时间可以再次加入 (单位：秒)
    KICK_LIMIT_SECONDS = 120,
    // 房间中最多可容纳的对战人数(不算观战)
    ROOM_MAX_BATTLE_USER_COUNT = 2,
    // 匹配时最大分配的房间数量(单位：间)
    MAX_ROOM = 20,
    // 局时 (单位：秒)
    TOTAL_TIME_SECONDS = 20 * 60,
    // 步时 (单位：秒)
    STEP_TIME_SECONDS = 2 * 60,
    // 局时用尽后读秒 (单位：秒)
    READ_SECONDS = 60,
    // 用户断线后超过此时将不再恢复会话 (单位：秒)
    OFFLINE_TIME_SECONDS = 90,
    // 断开服务器超过此时间后清除用户游戏数据 (单位：秒)
    DISCONNECT_TIME_SECONDS = 15 * 60,
    // 多个棋子持续长将限定次数
    MULTIPLE_LONG_FIGHTING_COUNT = 10,
    // 单个棋子持续长将限定次数
    ONE_LONG_FIGHTING_COUNT = 6,
    // 对局可悔棋的次数
    BACK_MOVE_COUNT = 3,
    // 部分操作发送请求的间隔时间，如：求和 (单位：秒)
    REQUEST_INTERVAL_SECONDS = 60,
}


/**
 * 数据变更类型
 */
export const enum DATA_CHANGE_TYPE {
    ADDED= 'add',
    DEFAULT= 'default',
    SUBTRACTION = 'sub',
    SET= 'set',

}

/**
 * 在线数据类型
 */
export const enum ONLINE_DATA_TYPE {
    BATTLE = 'battle',
    IN_ROOM = 'roomCount',
}

/**
 * 棋盘
 */
export const enum BOARD {
    ROW_SIZE = 10,
    COL_SIZE = 9,
}

/**
 * 登录类型
 */
export const enum LOGIN_TYPE {
    // 账号密码登录(或邮箱)
    USER_PASS = '0001',
    // 凭证登录
    TICKET = '0002',
}
/**
 * 用户类型
 */
export const enum USER_TYPE {
    // 注册用户
    REGISTER_USER = '0001',
    // 游客
    TOURIST_USER = '0002',
}

/**
 * 对战流水的类型
 */
export const enum BATTLE_FLOW_TYPE {
    PEACE = "0001",
    BACK_MOVE = "0002",
    ADMIT_DEFEAT = "0003",
}

/**
 * 游戏结束的类型
 */
export const enum GAME_OVER_TYPE {
    // 0001-绝杀，0002-认输，0003-逃跑,
    // 0004-超时, 0005-双方议和,0006-无进攻棋子
    BATTLE = '0001',
    ADMIT_DEFEAT = '0002',
    USER_LEAVE = '0003',
    USER_TIMEOUT = '0004',
    USER_PEACE = '0005',
    NO_ATTACH_PIECE = '0006',
}

/**
 * 验证码类型
 */
export const enum CODE_TYPE {
    // 忘记密码
    FORGET_PASSWORD = 'FORGET_PASSWORD',
    // 账号注册
    USER_REGISTER = 'USER_REGISTER',
}