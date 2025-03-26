import {BATTLE} from "../configs/enums";

class LongFighting {
    private fightCountMap = new Map<string, Map<string, number>>();
    private finalFightCountMap = new Map<string, Map<string, number>>();

    getOneLongFightData(userId: string, chessId: string) {
        const userFightMap = this.fightCountMap.get(userId);
        const userFinalFightMap = this.finalFightCountMap.get(userId);
        return userFightMap?.get(chessId) ?? userFinalFightMap?.get(chessId) ?? 0;
    }

    getMultipleLongFightData(userId: string) {
        let total = 0;
        for (const [, value] of this.fightCountMap.get(userId) ?? new Map()) {
            total += value;
        }
        for (const [, value] of this.finalFightCountMap.get(userId) ?? new Map()) {
            total += value;
        }
        return total;
    }

    updateLongFighting(userId: string, chessId: string, increment: number) {
        const userFightMap = this.fightCountMap.get(userId) ?? new Map<string, number>();
        const currentValue = userFightMap.get(chessId) || 0;
        const newValue = Math.max(currentValue + increment, 0);

        userFightMap.set(chessId, newValue);
        this.fightCountMap.set(userId, userFightMap);

        // 仅保留最新的 key
        const lastKey = [...userFightMap.keys()].pop();
        if (lastKey !== chessId) {
            if (lastKey) {
                userFightMap.delete(lastKey);
            }
            this.fightCountMap.set(userId, userFightMap);
        }

        // 达到战斗计数上限后，转移到最终计数 Map，并清除当前 Map
        if (newValue >= BATTLE.ONE_LONG_FIGHTING_COUNT) {
            const userFinalFightMap = this.finalFightCountMap.get(userId) ?? new Map<string, number>();
            userFinalFightMap.set(chessId, newValue);
            this.finalFightCountMap.set(userId, userFinalFightMap);

            userFightMap.clear();
            this.fightCountMap.set(userId, userFightMap);
        }
    }

    clearLongFightCount(userId: string) {
        this.fightCountMap.delete(userId);
        this.finalFightCountMap.delete(userId);
    }
}

export default LongFighting;
