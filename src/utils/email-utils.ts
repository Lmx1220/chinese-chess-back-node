import { EMAIL_CONFIG} from "../configs/config";
import EmailDao from "../dao/email-dao";
import ValidCodeDao from "../dao/valid-code-dao";
import {BOOLEAN} from "../configs/enums";

const nodemailer = require('nodemailer');

class EmailUtils {
    private transporter: any = null;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: EMAIL_CONFIG.HOST,
            port: EMAIL_CONFIG.PORT,
            // true for 465, false for other ports
            secure: false,
            auth: {
                user: EMAIL_CONFIG.USER,
                pass: EMAIL_CONFIG.PASSWORD
            }
        });
    }

    /**
     * 检查发送状态
     * @param userId
     * @param to
     * @param maxCount
     * @returns {Promise<boolean>}
     */
    checkEmail = async (userId: string, to: string, maxCount: number): Promise<boolean> => {
        const log = global.logUtils.createContext('EmailUtils', 'checkSendStatus', {userId});

        // 获取当天该账号发送的次数
        const emailCount: number = await ValidCodeDao.builder().getTodaySendEmailCount(userId, to);
        log.info(`账号[${userId}]向邮箱[${to}]已发送过[${emailCount}]次邮件`)
        return emailCount === 0 || emailCount < maxCount;
    }


    /**
     * 发送邮件
     * @param userId 操作人
     * @param subject 主题
     * @param to 收件人，多个：'2@qq.com, 3@qq.com'
     * @param html
     * @returns {Promise<Boolean>}
     */
    sendEmail = async (userId: string, subject: string, to: string, html: string): Promise<boolean> => {
        const log = global.logUtils.createContext('EmailUtils', 'sendEmail', {userId});

        let mailOptions = {
            // 发件人
            from: EMAIL_CONFIG.USER,
            // 收件人(抄送人)，多个逗号隔开
            to: to,
            subject: subject,
            // text: '文字内容',
            html: html
        };
        log.info('即将发送邮件', mailOptions);

        const sendResult: string = await new Promise((resolve) => {
            this.transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    log.error('发送邮件失败', error);
                    resolve(BOOLEAN.SHORT_NO);
                } else {
                    // console.log('Message sent: %s', info.messageId);
                    // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
                    log.info(`发送邮件成功, messageId: [${info.messageId}]`);
                    resolve(BOOLEAN.SHORT_YES);
                }
            });
        });

        // 记录内容
        await EmailDao.builder().insertSelective({userId, to, subject, html, sendResult});

        // 结果
        return sendResult === BOOLEAN.SHORT_YES;
    };

}

export default EmailUtils;