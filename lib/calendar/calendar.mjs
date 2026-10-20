const DAY = 86400000;
export const MIN = '1901-01-01';
export const MAX = '2100-12-31';
const lunarDays = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const lunarMonths = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const traditional = {'1-1':'春节','1-15':'元宵节','5-5':'端午节','7-7':'七夕节','8-15':'中秋节','9-9':'重阳节','12-8':'腊八节'};
const solarFestivals = {'1-1':'元旦','5-1':'劳动节','10-1':'国庆节'};
// 双节重合的法定日期按官方明确调整，传统中秋节本日仍由农历确定。
// 依据：青岛人社 2009 年说明、芜湖人社 2020-09-18 答复（见 README 来源）。
const statutoryAdjustments = {'2009-10-03':'国庆节','2009-10-06':'中秋节','2020-10-01':'国庆节','2020-10-04':'中秋节'};
export const iso = date => date.toISOString().slice(0, 10);
export const addDays = (date, count) => iso(new Date(Date.parse(date) + count * DAY));

/** 中国日历统一以北京时间跨日，避免海外浏览器与夏令时影响日期。 */
export function beijingToday(now = new Date()) {
  return iso(new Date(now.getTime() + 8 * 3600000));
}

/** 月历始终从周一开始；超出官方历表范围的位置保留为空格。 */
export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({length: Math.ceil((offset + length) / 7) * 7}, (_, i) => {
    const date = iso(new Date(first.getTime() + (i - offset) * DAY));
    return date < MIN || date > MAX ? null : date;
  });
}

/** 只查官方历表，不用固定公历日期近似农历或节气。 */
export function createCalendar(data) {
  const monthStarts = data.months.map(([date, year, month]) => ({date, time: Date.parse(date), year, month}));
  const holidays = Object.assign({}, ...Object.values(data.holidays).map(x => x.days));
  const cache = new Map();
  function day(date) {
    if (cache.has(date)) return cache.get(date);
    const time = Date.parse(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || iso(new Date(time)) !== date || date < MIN || date > MAX) throw new RangeError('日期超出 1901—2100 年或无效');
    // 二分定位最近的农历月初，闰月使用负月份并保留独立月界。
    let left = 0, right = monthStarts.length - 1;
    while (left < right) {
      const middle = Math.ceil((left + right) / 2);
      if (monthStarts[middle].time <= time) left = middle;
      else right = middle - 1;
    }
    const start = monthStarts[left];
    const lunarDay = (time - start.time) / DAY + 1;
    const month = Math.abs(start.month);
    const leap = start.month < 0;
    const monthName = `${leap ? '闰' : ''}${lunarMonths[month - 1]}月`;
    const ganzhi = '甲乙丙丁戊己庚辛壬癸'[(start.year - 4) % 10] + '子丑寅卯辰巳午未申酉戌亥'[(start.year - 4) % 12];
    const zodiac = '鼠牛虎兔龙蛇马羊猴鸡狗猪'[(start.year - 4) % 12];
    const [year, solarMonth, solarDay] = date.split('-').map(Number);
    const term = data.terms[date] || null;
    const festivals = [];
    const lunarFestival = !leap && traditional[`${month}-${lunarDay}`];
    const solarFestival = solarFestivals[`${solarMonth}-${solarDay}`];
    // 除夕是下一天正月初一的前一日，不能假设每年腊月都有三十。
    const next = monthStarts[left + 1];
    const isEve = next?.month === 1 && next.time - time === DAY;
    if (lunarFestival) festivals.push(lunarFestival);
    if (isEve) festivals.push('除夕');
    if (solarFestival) festivals.push(solarFestival);
    if (term === '清明') festivals.push('清明节');
    const entry = holidays[date];
    const holiday = entry ? {name: entry[0], isOffDay: entry[1]} : null;
    // 法定节日与连休天数不同；仅对已收录年份按当时生效的办法分类。
    let statutory = null;
    if (data.holidays[year]) {
      if (solarMonth === 1 && solarDay === 1) statutory = '元旦';
      if (solarMonth === 5 && solarDay <= (year >= 2025 ? 2 : year <= 2007 ? 3 : 1)) statutory = '劳动节';
      if (solarMonth === 10 && solarDay <= 3) statutory = '国庆节';
      const eveLegal = year >= 2025 || (year >= 2008 && year <= 2013);
      const springDays = year >= 2008 && year <= 2013 ? 2 : 3;
      if ((isEve && eveLegal) || (!leap && month === 1 && lunarDay <= springDays)) statutory = '春节';
      if (year >= 2008 && (term === '清明' || (!leap && month === 5 && lunarDay === 5) || (!leap && month === 8 && lunarDay === 15))) statutory = term === '清明' ? '清明节' : month === 5 ? '端午节' : '中秋节';
    }
    statutory = statutoryAdjustments[date] || statutory;
    const result = {date, year, month: solarMonth, day: solarDay, weekday: new Date(time).getUTCDay(),
      lunar: {year: start.year, month, day: lunarDay, leap, monthName, dayName: lunarDays[lunarDay - 1], ganzhi, zodiac, full: `${ganzhi}年 ${monthName}${lunarDays[lunarDay - 1]}`},
      festivals, term, holiday, statutory: statutory ? `${statutory}法定节假日` : null};
    cache.set(date, result);
    return result;
  }
  return {day};
}
