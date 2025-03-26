import Redlock, {Lock, Settings} from "redlock";


class RedLockUtils {
    private static redLock: any = null;
    private static DEFAULT_LOCK_TIME = 5 * 1000;

    private constructor() {
        throw new Error('禁止实例化 RedLockUtils');
    }

    private static initRedLock() {
        RedLockUtils.redLock = new Redlock([global.redisClient], {
            driftFactor: 0.01,
            retryCount: 15,
            retryDelay: 200,
            retryJitter: 200,
            automaticExtensionThreshold: 500,
        });
    }

    static acquire = async (resources: string[], duration?: number, settings?: Partial<Settings>): Promise<Lock> => {
        if (!RedLockUtils.redLock) {
            RedLockUtils.initRedLock();
        }
        duration = duration || RedLockUtils.DEFAULT_LOCK_TIME;
        return RedLockUtils.redLock.acquire(resources, duration, settings);
    }
}

export default RedLockUtils;
