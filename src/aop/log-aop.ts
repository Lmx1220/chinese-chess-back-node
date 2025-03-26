import DateUtils from "../utils/date-utils";
const dateUtils = new DateUtils();

declare interface LogParams {
    // 是否需要打入参
    request?: boolean,
    // 是否需要打出参
    response?: boolean,
    // 描述信息
    desc?: string,
    // 忽略的参数名称
    excludeNames?: string | string[],
    // 格式(暂定)
    format?: 'json' | 'object'
}

/**
 * 获取方法定义的参数名称
 * @param func
 */
const getArgs = (func: any): [] => {
    // 匹配函数括号里的参数
    // /function\s.*?\(([^)]*)\)/
    const argsArr: any = func.toString().match(/\(([^)]*)\)/);
    if (!argsArr || argsArr.length < 1) {
        return [];
    }
    const args = argsArr[1];
    // 分解参数成数组
    return args.split(",").map((params: any) => {
        // 去空格和内联注释
        return params.replace(/\/\*.*\*\//, "").trim();
    }).filter((params: any) => {
        // 确保没有undefined
        return params;
    });
}

/**
 * 格式化参数
 * @param fieldNames
 * @param argsValues
 * @param ignoreParamNames
 */
const formatParams = (fieldNames: any[], argsValues: any[], ignoreParamNames?: string | string[]): any => {
    // 拼接成对象
    let paramsArr = fieldNames.map((field: any, index: number) => {
        return {key: `${[field]}`, value: argsValues[index]};
    })
    // 过滤掉不显示的key
    if(ignoreParamNames) {
        paramsArr = paramsArr.filter(param => {
            if(Array.isArray(ignoreParamNames)) {
                return !ignoreParamNames.some((itemKey: string) => itemKey === param.key);
            }
            return ignoreParamNames !== param.key;
        });
    }
    // 处理成纯对象模式
    const resultParamsObj: any = {};
    paramsArr.map(item => resultParamsObj[item.key] = item.value);

    return resultParamsObj;
}

/**
 * 切面日志
 * 注意：因为js关系，此注解必须放在其它装饰器之下(执行方法之上)
 * @param ops
 * @constructor
 */
export function Log(ops?: LogParams) {
    return function (target: any, name: string, descriptor: PropertyDescriptor) {
        const oldValue = descriptor.value;
        const printReq = (typeof ops?.request === 'boolean') ? ops.request : false;
        const printResp = (typeof ops?.response === 'boolean') ? ops.request : false;

        // 函数劫持
        descriptor.value = function () {
            const clsName = target.constructor.name;
            const desc = ops?.desc ? `[${ops.desc}]` : `[${clsName}.${name}]`;
            const log = global.logUtils.createContext(clsName, name);
            try {
                // 是否打印入参
                if(printReq) {
                    const fieldNames = getArgs(oldValue);
                    const argsValues = [...arguments];
                    // 处理参数
                    const paramsArr = formatParams(fieldNames, argsValues, ops?.excludeNames);
                    log.debug(`调用${desc}，入参:`, paramsArr);
                }

                const startTime = new Date;
                // 调用方法
                const result = oldValue.apply(this, [...arguments, log]);

                // 判断方法的返回类型
                if(result instanceof Promise) {
                    result.then(resp => {
                        const diffTime = dateUtils.diffMilliseconds(startTime, new Date());
                        printResp && log.debug(`调用${desc}，用时[${diffTime}]ms，出参:`, resp);
                    })
                } else {
                    const diffTime = dateUtils.diffMilliseconds(startTime, new Date());
                    printResp && log.debug(`调用${desc}，用时[${diffTime}]ms，出参:`, result);
                }
                return result;
            } catch (e: any) {
                log.error(`调用${desc}发生错误，堆栈信息：`, e);
                // 继续抛出异常
                throw e;
            }
        }
        return descriptor;
    }
}