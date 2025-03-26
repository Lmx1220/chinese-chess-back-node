import Redis from "ioredis";
import {BOOLEAN, REDIS_KEYS} from "../configs/enums";
import DateUtils from "./date-utils";

const dateUtils = new DateUtils();
/**
 * Redis工具
 */
class RedisUtils {

    /**
     * 将数据存入缓存
     * @param key
     * @param value
     * @param expireSeconds 过期时间(毫秒)
     */
    setStr = async (key: string, value: string, expireSeconds: number = -1) => {
        const log = global.logUtils.createContext('RedisUtils', 'setStr');
        const redisClient: Redis = global.redisClient
        const timestamp: number = Math.floor(Date.now()) + expireSeconds
        const data:Date =new Date(timestamp)
        log.debug(`将数据存入Redis，key: ${key}，过期时间：${dateUtils.formatDate(data)}，内容为：${value}`);
        return new Promise(((resolve, reject) => {
            redisClient.set(key, value, (resp) => {
                // 没有错误信息返回，证明存入成功
                if (!resp) {
                    log.debug(`key: ${key} 存入成功`);

                    (expireSeconds !== -1) && redisClient.pexpireat(key, timestamp);
                    resolve(BOOLEAN.YES);
                } else {
                    log.debug(`key: ${key} 存入失败，原因：`, resp);
                    reject(resp);
                }
            });
        }))
    }

    /**
     * 获取缓存中的数据
     * @param key
     */
    getStr = async (key: string): Promise<string | null> => {
        const log = global.logUtils.createContext('RedisUtils', 'getStr');

        const redisClient: Redis = global.redisClient
        const value = await redisClient.get(key);
        // log.debug(`获取key：${key} 对应的数据为：${value}`);
        return value;
    }
    getScanStr = async (key: string): Promise<(string|null)[]> => {
        // const log = global.logUtils.createContext('RedisUtils', 'getScanStr');

        const redisClient: Redis = global.redisClient
        let cursor = '0'; // 初始游标
        const matchingKeyValuePairs = []; // 存储键值对

        try {
            do {
                // 执行 SCAN 命令
                const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', key, 'COUNT', 100);
                cursor = newCursor; // 更新游标

                if (keys.length > 0) {
                    // 对于每一个键，获取其值
                    for (let key of keys) {
                        const value = await redisClient.get(key); // 根据实际需要更改此处的命令
                        matchingKeyValuePairs.push(value);
                    }
                }
            } while (cursor !== '0'); // 当游标回到 '0' 时，迭代结束
            // log.debug(`获取key：${key} 对应的数据为：${matchingKeyValuePairs}`);
            return matchingKeyValuePairs;
        } catch (error) {
            // log.debug(`获取key：${key} 对应的数据为：${matchingKeyValuePairs}`);
        }
        return matchingKeyValuePairs;
    }


    /**
     * 删除redis缓存
     * @param key
     */
    delete = (key: string) => {
        const log = global.logUtils.createContext('RedisUtils', 'delete');

        const redisClient: Redis = global.redisClient
        redisClient.del(key);
        log.debug(`删除缓存key：${key}`);
    }
}

export default RedisUtils;
