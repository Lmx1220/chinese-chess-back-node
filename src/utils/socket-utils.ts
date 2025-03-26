import ConstUtils from "./const-utils";

import md5  from "md5";
const constUtils = new ConstUtils();

class SocketUtils {

    /**
     * 获取客户端IP
     * @param socket
     */
    getClientIp = (socket: any) => {
        if (socket.handshake.headers['x-forwarded-for'] != null) {
            return socket.handshake.headers['x-forwarded-for'];
        } else {
            return socket.handshake.address;
        }
    }

    /**
     * 获取token
     * @param socket
     */
    getToken = (socket: any) => {
        return socket.handshake.query.token;
    }

    /**
     * 获取指纹
     * @param socket
     */
    getFinger = (socket: any) => {
        return socket.handshake.query.f;
    }

    /**
     * 生成一个凭证
     */
    generateTicket = () => {
        return md5(constUtils.getRandomId(8))
    }

    /**
     * 根据token获取socket
     * @param token
     */
    getSocketsBy(token: string): any[] {
        if (token) {
            const socketResults = [];
            const socketsMap = global.socketIO.sockets.sockets;
            for (let [key, socket] of socketsMap) {
                if (this.getToken(socket) === token) {
                    socketResults.push(socket);
                }
            }
            return socketResults;
        }
        return [];
    }

    getSocketBy(token: string) {
        const sockets = global.socketIO.sockets.sockets;
        if (token){
            for (let [key, socket] of sockets) {
                if (this.getToken(socket) === token) {
                    return socket;
                }
            }
        }
        return undefined;
    }
}

export default SocketUtils;
