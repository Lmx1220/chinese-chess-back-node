import DatabaseUtils from "../utils/db-utils";

/**
 * 创建一个事务(注意事务不要嵌套)
 * @param target
 * @param name
 * @param descriptor
 * @constructor
 */
export function Transaction(target: any, name: string, descriptor: PropertyDescriptor) {
    const oldValue = descriptor.value;
    // 函数劫持
    descriptor.value = function () {
        // console.log(`调用方法 ${name} 参数：`, arguments);
        const $this = this;
        const $arguments = arguments;
        // return oldValue.apply($this, $arguments);

        // 创建事务管理器
        return DatabaseUtils.getPool().transaction(async (transaction: any) => {
            return await oldValue.apply($this, $arguments);
        });
    }
    return descriptor;
    // console.log('target', target);
    // console.log('key', key);
    // console.log('descriptor', descriptor.value);
}
