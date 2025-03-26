import {Transaction} from "../aop/transaction-aop";
import {CatchException} from "../aop/exception-aop";
import ConstUtils from "../utils/const-utils";
import md5 from "md5";
import SocketUtils from "../utils/socket-utils";
import UserDao from "../dao/user-dao";
import DataResp from "../model/data-resp";
import UserStateDao from "../dao/user-state-dao";
import {APP, BOOLEAN, CODE_TYPE, LOGIN_TYPE, PAGE_STATUS, USER_STATUS, USER_TYPE} from "../configs/enums";
import UserVo from "../model/vo/user-vo";
import {Log} from "../aop/log-aop";
import ValidCodeDao from "../dao/valid-code-dao";
import EmailUtils from "../utils/email-utils";
import FileUtils from "../utils/file-utils";

const constUtils = new ConstUtils();
const socketUtils = new SocketUtils();
const emailUtils = new EmailUtils();
const fileUtils = new FileUtils()
class UserCore {


    /**
     * 自动生成并注册游客账号
     * @param socket
     * @param token
     * @param finger
     */
    @Transaction
    @CatchException
    async autoGenerateTouristImpl(socket: any, token: string, finger: string): Promise<DataResp<any>> {
        const maxCount = 10;
        let count = 0;
        // 账户密码
        const password = md5(constUtils.getRandomId(8));
        // 登录凭证
        const ticket = socketUtils.generateTicket();
        let userName = `棋手 ${constUtils.getRandomId(6, 10)}`;
        do {
            const userId = `tour_${constUtils.getRandomId(8, 10)}`;
            // 检测数据库中是否有相同的账号
            const user: any = await UserDao.getUserByPrimaryKey(userId);
            if (!user) {
                // 未找到相同账号，直接注册
                const ip = socketUtils.getClientIp(socket);
                await UserDao.builder().createUser(userId, password, userName, null, USER_TYPE.TOURIST_USER, ticket, finger, ip);


                socket.captcha = null;
                // 返回注册信息
                return DataResp.success('账号生成成功').setData({ticket, userId});
            }
        } while ((++count) < maxCount);
        // 超过指定次数
        if (count >= maxCount) {
            return DataResp.fail('账号生成失败，请重试')
        }
        return DataResp.fail('账号生成失败，请重试')
    }

    /**
     * 登录核心逻辑处理
     * @param socket
     * @param userId
     * @param password
     * @param ticket
     * @param type
     * @param openId
     * @param accessToken
     */
    @Transaction
    @CatchException
    async loginImpl(socket: any, userId: string, password: string, ticket: string, type: string, openId: string, accessToken: string): Promise<DataResp<any>> {
        const log = global.logUtils.createContext('SocketServiceImpl', 'loginImpl', {userId});
        const token = socketUtils.getToken(socket);
        const ip = socketUtils.getClientIp(socket);
        const finger = socketUtils.getFinger(socket);
        log.info(`当前登录的token：[${token}]，指纹：[${finger}]`);
        const where: UserVo = {};
        if (type === LOGIN_TYPE.USER_PASS) {
            // 兼容使用邮箱登录
            if (/^[A-Za-z0-9]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(userId)) {
                where.email = userId;
            } else {
                where.userId = userId;
            }
            where.password = password;
        } else if (type === LOGIN_TYPE.TICKET) {
            where.userId = userId;
            where.ticket = ticket;

            // 凭证登录不安全，加上以前登录过的指纹进行验证
            // where.push(['finger', finger])
            // where.push(['ip', ip]);
        }
        // 调用数据库进行登录
        const userRows: any = await UserDao.builder().select(where);
        log.info(`登录数据为：`, userRows);
        // 校验数据
        if (userRows.length === 1) {
            // 优先检查账号有没有被禁用
            const [user] = userRows;
            const {dataStatus} = user;
            if (!dataStatus || dataStatus === BOOLEAN.SHORT_NO) {
                return DataResp.fail('账号已被禁用');
            }
            const updUserColumns: UserVo = {};
            updUserColumns.ip = ip;
            updUserColumns.finger = finger;

            // 更新用户端数据
            await UserDao.builder().updateSelective(updUserColumns, {userId: user.userId});

            // 判断是否已有用户在登录了
            const userState = await UserStateDao.getUserStateByUserId(user.userId);
            log.info(`查询账号是否冲突时，检测到[${user.userId}]游离数据为:`, userState);

            if (!userState) {
                log.info(`查询账号是否冲突时，[${user.userId}]无游离数据，准备创建`);
                // 记录初始数据
                await UserStateDao.createUserState(user.userId, token);
                log.info(`已创建初始状态数据`);
            } else {
                // 清除断线时间
                await UserStateDao.builder().updateSelective({
                    userPage: userState.userPage === PAGE_STATUS.LOGIN ? PAGE_STATUS.PLATFORM : userState.userPage,
                    userStatus: userState.userStatus || USER_STATUS.PLATFORM,
                    disconnectTime: null,
                    token: token,
                }, {userId: user.userId});
            }

            // 通知客户端（回调客户端提供的function）
            log.info(`[${user.userId}]已登录`);
            return DataResp.success('登录成功(账号密码)')
                .setData({
                    kickToken: userState?.ticket,
                    loginTicket: user.ticket,
                    userId: user.userId,
                    recoveryUserId: userState?.userId
                })
        } else {
            const msg = (type === LOGIN_TYPE.USER_PASS ? '账号或密码错误' : '登录凭证已过期');

            log.info(msg);
            return DataResp.fail(msg);
        }
    }

    /**
     * 获取用户详情
     * @param socket
     * @param userId
     * @return {Promise<void>}
     */
    userDetailImpl = async (socket: any, userId: string): Promise<DataResp<any>> => {
        const user: any = await UserDao.getUserByPrimaryKey(userId);
        if (!user) {
            return DataResp.fail('查询不到用户信息');
        } else {
            return DataResp.success('查询用户信息成功').setData({
                user: {
                    pkFailCount: user.pkFailCount,
                    pkOfflineCount: user.pkOfflineCount,
                    pkPeaceCount: user.pkPeaceCount,
                    pkTotalCount: user.pkTotalCount,
                    pkWinCount: user.pkWinCount,
                    score: user.score,
                    userId: user.userId,
                    userType: user.userType,
                    userName: user.userName,
                    iconUrl: user.iconUrl,
                    scoreSort: await UserDao.getScoreSortByUserId(userId)
                }
            });

        }
    }

    /**
     * 修改用户信息
     * @param socket
     * @param userId
     * @param modifyDetail
     */
    @Transaction
    async modifyUserDetailImpl(socket: any, userId: string, modifyDetail: any): Promise<DataResp<any>> {
        const user: any = await UserDao.getUserByPrimaryKey(userId);
        if (!user) {
            return DataResp.fail('查询不到用户信息');
        }
            // else if (USER_TYPE.TOURIST_USER === user.userType) {
            //     fn(CryptorUtils.encrypt({code: 'fail', msg: '游客无法修改信息'}));
        // }
        else {
            const {userName, iconUrl} = modifyDetail;
            const updColumn: UserVo = {};
            userName && (updColumn.userName = userName)
            if(iconUrl){
                updColumn.iconUrl = fileUtils.getShowPath(iconUrl)
            }
            if (Object.keys(updColumn).length > 0) {
                await UserDao.builder().updateSelective(updColumn, {userId: userId});
            }
            return DataResp.success('修改用户信息成功');
        }
    }

    @Log({excludeNames: 'socket'})
    async loginOutImpl(socket: any, userId: any): Promise<DataResp<any>> {
        const log = global.logUtils.getArgsLogger(arguments, {userId});
        //删除游离表中的用户
        await UserStateDao.builder().deleteSelective({
            userId: userId
        });
        log.info(`用户[${userId}]退出登录`);

        return DataResp.success();
    }

    /**
     * 找回密码
     * @param socket
     * @param userId
     * @param email
     * @param password
     * @param validCode
     */
    @Transaction
    @CatchException
    async forgetPasswordImpl(socket: any, userId: string, email: string, password: string, validCode: string): Promise<DataResp<any>> {
        const log = global.logUtils.createContext('SocketServiceImpl', 'forgetPasswordImpl', {userId});
        // 查询用户是否存在
        const user: any = await UserDao.getUserByPrimaryKey(userId);
        if (!user) {
            // 防止恶意嗅探，提示非本意信息
            return DataResp.fail('账号或邮箱错误');
        } else if (email !== user.email) {
            return DataResp.fail('账号与邮箱不匹配');
        } else {
            if (!await ValidCodeDao.builder().validateEmailAndCode(userId, user.email, validCode, APP.CODE_VALID_TIME_MINUTES)) {
                log.info(`账号[${userId}]使用的验证码[${validCode}]已过期`);
                return DataResp.fail('验证码错误或已过期');
            } else {
                // 将验证码失效
                await ValidCodeDao.builder().updateValidCodeStatus(userId, user.email, validCode, BOOLEAN.SHORT_NO);
                // 修改密码
                await UserDao.builder().updateSelective({password}, {userId});
                log.info(`账号[${userId}]密码已修改`);
                return DataResp.success('修改成功');
            }
        }
    }

    /**
     * 发送验证码核心逻辑处理
     * @param socket
     * @param userId
     * @param userName
     * @param email
     */
    @Transaction
    @CatchException
    async sendValidCodeImpl(socket: any, userId: any, userName: any, email: any): Promise<DataResp<any>> {
        const user: any = await UserDao.getUserByPrimaryKey(userId);
        if (user) {
            return DataResp.fail('账号已被使用');
        }
        const emailRows = await UserDao.builder().select({email: email});
        if (emailRows.length > 0) {
            return DataResp.fail('邮箱已被使用');
        } else if (!await emailUtils.checkEmail(userId, email, APP.CODE_TODAY_MAX_SEND_COUNT)) {
            return DataResp.fail('该邮箱已超过当日限发次数');
        } else {
            const validCode = constUtils.getRandomId(6);
            const subject = '[中国象棋]注册验证码';
            const html = `尊敬的${userName}，本次验证码为：<span style="color: blue">${validCode}</span>，${APP.CODE_VALID_TIME_MINUTES}分钟内有效。`;
            const sendResult = await emailUtils.sendEmail(userId, subject, email, html);
            if (sendResult) {
                await ValidCodeDao.builder().insertSelective({
                    userId: userId,
                    email: email,
                    validCode: validCode,
                    codeType: CODE_TYPE.USER_REGISTER,
                    dataStatus: BOOLEAN.SHORT_YES
                });
                return DataResp.success('验证码发送成功');
            } else {
                return DataResp.fail('发送失败，邮箱错误');
            }
        }

    }

    /**
     * 注册核心逻辑处理
     * @param socket
     * @param userId
     * @param userName
     * @param password
     * @param email
     * @param validCode
     */
    @Transaction
    @CatchException
    async registerImpl(socket: any, userId: string, userName: string, password: string, email: string, validCode: string) {
        const log = global.logUtils.createContext('SocketServiceImpl', 'registerImpl', {userId});

        // 查询用户是否存在
        const user: any = await UserDao.getUserByPrimaryKey(userId);
        if (user) {
            log.info(`账号[${userId}]已被使用`);
            return DataResp.fail('账号已被使用');
        } else if (email && !(await ValidCodeDao.builder().validateEmailAndCode(userId, email, validCode, APP.CODE_VALID_TIME_MINUTES))) {

            log.info(`账号[${userId}]使用的验证码[${validCode}]已过期`);
            return DataResp.fail('验证码错误或已过期');
        } else {
            socket.captcha = null;
            // 将验证码失效
            await ValidCodeDao.builder().updateValidCodeStatus(userId, email, validCode, BOOLEAN.SHORT_NO);
            // 创建用户数据
            const ticket = socketUtils.generateTicket();
            const finger = socketUtils.getFinger(socket);
            const ip = socketUtils.getClientIp(socket);
            const isSuc = await UserDao.builder().createUser(userId, password, userName, email, USER_TYPE.REGISTER_USER, ticket, finger, ip);
            log.info(`账号[${userId}]${isSuc ? '注册成功' : '注册失败'}`);
            if (isSuc) {
                return DataResp.success('注册成功').setData({ticket, userId});
            } else {
                return DataResp.fail('注册失败');
            }
        }
    }

    /**
     * 忘记密码发送邮件
     * @param socket
     * @param userId
     * @param email
     */
    @Transaction
    @CatchException
    async forgetPasswordSendValidCodeImpl(socket: any, userId: string, email: string): Promise<DataResp<any>> {
        const log = global.logUtils.createContext('SocketServiceImpl', 'forgetPasswordSendValidCodeImpl', {userId});

        const user: any = await UserDao.getUserByPrimaryKey(userId);
        if (!user) {
            // 账号不存在，但为了防止嗅探账号，此处提示未绑定邮箱
            return DataResp.fail('未绑定邮箱，请联系管理员');
        } else if (!user.email) {
            return DataResp.fail('未绑定邮箱，请联系管理员');
        } else if (email !== user.email) {
            return DataResp.fail('账号与邮箱不匹配');
        } else if (!(await emailUtils.checkEmail(userId, user.email, APP.CODE_TODAY_MAX_SEND_COUNT))) {
            return DataResp.fail('该邮箱已超过当日限发次数');
        } else {
            const validCode = constUtils.getRandomId(6);
            const subject = '[中国象棋]找回密码验证码';
            const html = `尊敬的${user.userName}，本次验证码为：<span style="color: blue">${validCode}</span>，${APP.CODE_VALID_TIME_MINUTES}分钟内有效。`;
            const sendResult = await emailUtils.sendEmail(userId, subject, user.email, html);
            if (sendResult) {
                await ValidCodeDao.builder().insertSelective({
                    userId: userId,
                    email: user.email,
                    validCode: validCode,
                    codeType: CODE_TYPE.FORGET_PASSWORD,
                    dataStatus: BOOLEAN.SHORT_YES
                });
                return DataResp.success('验证码发送成功');
            } else {
                return DataResp.fail('发送失败，请重试');
            }
        }
    }

}

export default UserCore;
