import crypto from 'crypto'

/**
 * 加密工具类
 */
class CryptorUtils {

    static defaultKey = '98af65aeg4col6de';

    static defaultIV = '1098574621234098';

    /**
     * 加密
     * @param data
     * @param iv
     * @param key
     */
    static encrypt = (data: object | string,iv= CryptorUtils.defaultIV, key=CryptorUtils.defaultKey) => {
        if (data) {
            const cipher = crypto.createCipheriv('aes-128-cbc', key , iv );
            let crypted = cipher.update(typeof data === 'string' ? data : JSON.stringify(data), 'utf8', 'binary');
            crypted += cipher.final('binary');
            crypted = new Buffer(crypted, 'binary').toString('base64');
            return crypted;
        }
        return data;
    }

    /**
     * 解密
     * @param key
     * @param iv
     * @param cipher
     */
    static decrypt = (cipher: string, iv= CryptorUtils.defaultIV, key=CryptorUtils.defaultKey) => {
        if (cipher) {
            cipher = new Buffer(cipher, 'base64').toString('binary');
            const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
            let decoded = decipher.update(cipher, 'binary', 'utf8');
            decoded += decipher.final('utf8');
            return JSON.parse(decoded);
        }


        return cipher;
    }
}

export default CryptorUtils;
