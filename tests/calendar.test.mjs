import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const { createCalendar, beijingToday, monthCells, shiftMonth } = await import('../lib/calendar/calendar.mjs');

test('连续月历跨年、月末和历表边界跳转不丢失有效日期', () => {
  assert.equal(typeof shiftMonth, 'function');
  assert.equal(shiftMonth('2026-12-21', 1), '2027-01-21');
  assert.equal(shiftMonth('2026-01-21', -1), '2025-12-21');
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftMonth('2024-03-31', -1), '2024-02-29');
  assert.equal(shiftMonth('1901-01-01', -3), '1901-01-01');
  assert.equal(shiftMonth('2100-12-31', 3), '2100-12-31');
});

test('提供可验证的日历接口', () => assert.equal(typeof createCalendar, 'function'));
if (createCalendar) {
  const data = JSON.parse(fs.readFileSync(new URL('../public/calendar/data.json', import.meta.url)));
  const calendar = createCalendar(data);
  test('73,049 天逐日回归官方原表的农历文字和节气，防止月界/闰月转换偏移', () => {
    const fixtures = JSON.parse(fs.readFileSync(new URL('./official-dates.json', import.meta.url)));
    assert.equal(fixtures.length, 73049);
    for (const [date, expectedLunar, expectedTerm] of fixtures) {
      const info = calendar.day(date);
      const label = info.lunar.day === 1 ? info.lunar.monthName.replace('冬月', '十一月').replace('腊月', '十二月') : info.lunar.dayName;
      assert.equal(label, expectedLunar, date);
      assert.equal(info.term || '', expectedTerm, date);
    }
  });
  test('春节、除夕和2025闰六月保持正确，不在闰月重复传统节日', () => {
    assert.equal(calendar.day('2026-02-17').lunar.full, '丙午年 正月初一');
    assert.ok(calendar.day('2026-02-16').festivals.includes('除夕'));
    assert.equal(calendar.day('2025-07-25').lunar.full, '乙巳年 闰六月初一');
    assert.deepEqual(calendar.day('2020-05-23').festivals, []);
    assert.ok(calendar.day('2026-09-25').festivals.includes('中秋节'));
  });
  test('节气使用逐年官方历表，不固定在同一个公历日', () => {
    assert.equal(calendar.day('2026-10-08').term, '寒露');
    assert.equal(calendar.day('2026-10-23').term, '霜降');
    assert.equal(calendar.day('2024-04-04').term, '清明');
    assert.equal(calendar.day('2026-04-05').term, '清明');
  });
  test('实际放假、法定节日和补班分开，普通周末与未知年份无标记', () => {
    assert.equal(calendar.day('2026-10-01').holiday.isOffDay, true);
    assert.equal(calendar.day('2026-10-01').statutory, '国庆节法定节假日');
    assert.equal(calendar.day('2026-10-07').statutory, null);
    assert.equal(calendar.day('2026-10-10').holiday.isOffDay, false);
    assert.equal(calendar.day('2026-10-17').holiday, null);
    assert.equal(calendar.day('2027-10-01').holiday, null);
    assert.equal(calendar.day('2001-10-01').holiday, null);
    assert.equal(calendar.day('2025-01-28').statutory, '春节法定节假日');
    assert.equal(calendar.day('2024-02-09').statutory, null);
    assert.equal(calendar.day('2025-05-02').statutory, '劳动节法定节假日');
    assert.equal(calendar.day('2024-05-02').statutory, null);
  });
  test('官方2026全部放假和补班日期数量，以及特殊历史通知', () => {
    const entries = Object.entries(data.holidays['2026'].days);
    assert.equal(entries.filter(([,value]) => value[1]).length, 33);
    assert.equal(entries.filter(([,value]) => !value[1]).length, 6);
    assert.equal(calendar.day('2015-09-03').holiday.isOffDay, true);
    assert.equal(calendar.day('2020-02-02').holiday.isOffDay, true);
  });
  test('双节重合时法定休假按官方特殊安排，传统节日本日仍不移动', () => {
    assert.equal(calendar.day('2009-10-03').statutory, '国庆节法定节假日');
    assert.equal(calendar.day('2009-10-06').statutory, '中秋节法定节假日');
    assert.equal(calendar.day('2020-10-04').statutory, '中秋节法定节假日');
    assert.ok(calendar.day('2020-10-01').festivals.includes('中秋节'));
  });
  test('北京时间午夜、闰年、周一开始及范围边界', () => {
    assert.equal(beijingToday(new Date('2026-10-19T16:01:00Z')), '2026-10-20');
    assert.equal(beijingToday(new Date('2026-10-19T15:59:00Z')), '2026-10-19');
    assert.equal(monthCells(2026, 10)[0], '2026-09-28');
    assert.equal(monthCells(2024, 2).filter(x=>x?.startsWith('2024-02')).length, 29);
    assert.ok(!monthCells(1901, 1).some(x=>x && x < '1901-01-01'));
    assert.ok(!monthCells(2100, 12).some(x=>x && x > '2100-12-31'));
    assert.throws(()=>calendar.day('2026-02-30'), RangeError);
    assert.throws(()=>calendar.day('2101-01-01'), RangeError);
  });
}
