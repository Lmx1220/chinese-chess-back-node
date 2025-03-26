import * as svgCaptcha from 'svg-captcha';

/**
 * 验证码工具
 * @see https://github.com/produck/svg-captcha/blob/HEAD/README_CN.md
 */
class CaptchaUtils {

    /**
     * 获取验证码
     */
    static getCaptcha = () => {
        const captcha = svgCaptcha.create({
            // 验证码长度
            size: 4,
            // 要忽略的字符
            ignoreChars: '',
            // 干扰线条的数量
            noise: 4,
            // 高度
            height: 42,
            // 默认是否有颜色
            color: true,
        });
        const code: string = captcha.text.toLowerCase();
        const svg: string = captcha.data;
        return {code, svg};
    }
}
export default CaptchaUtils;
