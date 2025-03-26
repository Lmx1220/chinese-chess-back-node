import BasicDo from "../basic-do";

interface EmailDo extends BasicDo{
    /**
     * 账号
     */
    userId?: string;
    /**
     * 邮件主题
     */
    subject?: string;
    /**
     * 收件人
     */
    to?: string;
    /**
     * 邮件内容(html)
     */
    html?: string;
    /**
     * 发送结果：Y/N
     */
    sendResult?: string;
}
export default EmailDo;
