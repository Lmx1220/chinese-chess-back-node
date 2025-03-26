/**
 * 长捉的棋子类型
 */
export const enum KEEP_FIGHT_TYPE {
    // 多个子长捉
    MULTIPLE_CHESS = '0001',
    // 单个子长捉
    ONE_CHESS = '0002',
}

/**
 * Redis配置
 */
export const enum REDIS {
    HOST = '******',
    PORT = 6379,
    // PORT = 16379,
    // HOST = '192.168.1.60',

    DB_NAME = 5,
    PASSWORD = '******',
}

/**
 * 数据库配置
 */
export const enum config {
    DB_USER = 'd_chess',
    DB_PASSWORD = '******',
    DB_HOST = '******',
    // DB_USER = 'root',
    // DB_PASSWORD = '******',
    // DB_HOST = '192.168.1.60',

    DB_PORT = 3306,
    DB_NAME = 'd_chess',
}

/**
 * 邮箱配置
 */
export const enum EMAIL_CONFIG {
    HOST = 'smtp.qq.com',
    PORT = 587,
    // 你的QQ账号
    USER = '****@qq.com',
    // 非你的QQ密码，为邮箱授权码
    PASSWORD = '******',
}


/**
 * 实例key
 */
export const enum INS_KEY {
    SERVICE_KEY = 'serviceKey',
    JOB_KEY = "jobKey",
    // BATTLE_JOB_KEY = 'battleJobKey',
    // DISCONNECT_JOB_KEY = 'disconnectJobKey',
    // USER_OFFLINE_JOB_KEY = 'userOfflineJobKey',
    IO_KEY = 'ioKey',
    REDIS_KEY = 'redisKey',
}

