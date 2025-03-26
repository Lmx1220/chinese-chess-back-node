import BattleHistoryDao from "../dao/battle-history-dao";
import BattleUserDao from "../dao/battle-user-dao";
import ShareDao from "../dao/share-dao";
import CryptorUtils from "../utils/cryptor-utils";

/**
 * http服务实现
 */
class HttpServiceImpl {

    /**
     * 获取分享的复盘数据
     * @param code
     * @param resp
     */
    getShareReviewList = async (code: string, resp: any) => {
        const log = global.logUtils.createContext('HttpServiceImpl', 'getShareReviewList');
        const pageSize = 1000;

        const shareRows: any = await ShareDao.builder().select({shareCode: code})
        if (shareRows.length === 0) {
            resp.json(CryptorUtils.encrypt({
                code: 'fail',
                msg: '分享已过期',
            }))
        } else {
            const {battleId, userId, viewCount} = shareRows[0];
            await ShareDao.builder().updateSelective({viewCount: viewCount + 1}, {shareCode: code});
            // 对战的基本数据
            const battleData = await BattleUserDao.getShareBattleDetail(battleId, userId);
            // 获取对局详情(分页)
            const stepDataList = await BattleHistoryDao.builder().getBattleReviewDetail(userId, battleId, pageSize);
            log.info(`[${userId}]请求了[${battleId}]的详情数据(分享)`);

            resp.json(CryptorUtils.encrypt({
                code: 'success',
                msg: '获取要复盘的对局详情',
                data: {
                    stepData: stepDataList,
                    battleData: battleData,
                    userId: userId,
                    viewCount: viewCount+1,
                    battleId: battleId,
                },
            }))
            log.info(`[${userId}]查询的对局[${battleId}]复盘详情数据获取完成(分享)`);
        }
    }
}

export default HttpServiceImpl;