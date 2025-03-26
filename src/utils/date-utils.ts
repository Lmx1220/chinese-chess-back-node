import moment from "moment";

class DateUtils {

  /**
   * 日期格式化类
   * @param date
   * @param pattern
   * @return {*}
   */
  formatDate = (date: Date, pattern = 'yyyy-MM-dd hh:mm:ss.S'): string => {
    if (!date) {
      return '';
    }

    let o: any = {
      'M+': date.getMonth() + 1,
      'd+': date.getDate(),
      'h+': date.getHours(),
      'm+': date.getMinutes(),
      's+': date.getSeconds(),
      'q+': Math.floor((date.getMonth() + 3) / 3),
      'S': date.getMilliseconds(),
    };
    // [年]处理
    if (/(y+)/.test(pattern)) {
      pattern = pattern.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    //
    for (let k in o) {
      if (new RegExp('(' + k + ')').test(pattern)) {
        pattern = pattern.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
      }
    }
    return pattern;
  }

  /**
   * 字符串转成日期
   * @param strTime
   */
  strToDate(strTime: string): Date {
    return moment(strTime).toDate()
  }

  /**
   * 判断两个日期间的时间差
   * @param startDate
   * @param endTime
   */
  dateDiffSeconds(startDate: Date, endTime: Date): number {
    return moment(endTime).diff(moment(startDate), 'seconds');
  }

  /**
   * 判断两个毫秒数值的时间差
   * @param begin
   * @param end
   */
  dateDiffMilliseconds(begin: number, end: number): number {
    return moment(end).diff(moment(begin), 'milliseconds');
  }

  /**
   * 判断两个毫秒数值的时间差
   * @param begin
   * @param end
   */
  diffMilliseconds(begin: Date, end: Date) {
    return moment(begin).diff(moment(end), 'milliseconds');
  }
}

export default DateUtils;