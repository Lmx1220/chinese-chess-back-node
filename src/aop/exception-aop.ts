import CryptorUtils from "../utils/cryptor-utils";
import RoomException from "../exception/room-exception";
import {Socket} from "socket.io";

/**
 * 异常处理
 * @param target
 * @param name
 * @param descriptor
 * @constructor
 */
export function CatchException(target: any, name: string, descriptor: PropertyDescriptor) {
    const oldValue = descriptor.value;
    // 函数劫持
    descriptor.value = async function () {
        try {
            return await oldValue.apply(this, arguments);
        } catch (e: any) {
            const log = global.logUtils.createContext('CatchException', 'catch');

            let desc = '未知错误';
            if (typeof e.getMessage === 'function') desc = e.getMessage();
            if (e.message) desc = e.message;
            log.error('全局日志拦截器拦截到错误，原因：', desc);

            const socket: any = [...arguments].find((obj: any) => (obj instanceof Socket));
            // 检测是否为自定义异常
            if (socket) {
                const respData = CryptorUtils.encrypt({code: 'fail', msg: desc});
                if (e instanceof RoomException) {
                    // 发给房间内的其它客户端(不包括自己)
                    socket.to(e.getRoomId()).emit('roomExceptionRespApi', respData);
                }
                // 发给客户端自己
                socket.emit('exceptionRespApi', respData);
            }
            // 继续抛出异常以回滚事务
            throw e;
        }
    }
    return descriptor;
}