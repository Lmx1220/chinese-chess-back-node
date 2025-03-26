/**
 * 基层定时任务
 */
declare interface BasicJob {

    /**
     * 执行方法
     * @param params 参数
     */
    exec(params?: Map<string, object>): boolean;
}

export default BasicJob;