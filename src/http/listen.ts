import {Router} from "express";
import HttpServiceImpl from "./core";
import CryptorUtils from "../utils/cryptor-utils";

const serviceImpl = new HttpServiceImpl();

class HttpListen {

    constructor(router: Router) {
        const log = global.logUtils.createContext('HttpListen', 'constructor');
        /**
         * 复盘列表分享
         */
        router.post("/share/:code", (req, resp) => {
            const {code} = req.params;
            if(!code) {
                resp.json(CryptorUtils.encrypt({
                    code: 'fail',
                    msg: '请求错误'
                }))
            } else {
                // 解析码，并查询数据库的数据
                serviceImpl.getShareReviewList(code, resp);
            }
        })
    }
}

export default HttpListen;