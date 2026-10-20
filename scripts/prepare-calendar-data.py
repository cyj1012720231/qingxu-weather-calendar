"""将官方逐日历表压缩为月初/节气索引，同时保留原始数据用于独立回归。"""
import datetime as dt
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
raw = root / "work"
months = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
translate = str.maketrans('驚蟄穀滿芒處閏', '惊蛰谷满芒处闰')
data = {'min': '1901-01-01', 'max': '2100-12-31', 'checkedAt': '2026-10-20', 'months': [['1900-12-22', 1900, 11]], 'terms': {}, 'holidays': {}}
fixtures = []
lunar_year = 1900
for year in range(1901, 2101):
    count = 0
    for line in (raw / 'hko' / f'{year}.txt').read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s+(\S+)\s+星期\S\s*(\S*)', line.strip())
        if not match:
            continue
        y, m, d, label, term = match.groups()
        date = dt.date(int(y), int(m), int(d)).isoformat()
        label, term = label.translate(translate), term.translate(translate)
        if '月' in label:
            name = label.replace('闰', '').replace('月', '')
            month = months.index(name) + 1
            if month == 1 and not label.startswith('闰'):
                lunar_year = int(y)
            data['months'].append([date, lunar_year, -month if label.startswith('闰') else month])
        if term:
            data['terms'][date] = term
        fixtures.append([date, label, term])
        count += 1
    assert count == (dt.date(year+1, 1, 1)-dt.date(year, 1, 1)).days, (year, count)
for year in range(2007, 2027):
    source = json.loads((raw / 'holidays' / f'{year}.json').read_text())
    assert source['papers'] and source['days'], year
    days = {}
    for item in source['days']:
        dt.date.fromisoformat(item['date'])
        assert isinstance(item['isOffDay'], bool)
        assert item['date'] not in days or days[item['date']] == [item['name'], item['isOffDay']]
        days[item['date']] = [item['name'], item['isOffDay']]
    data['holidays'][str(year)] = {'papers': source['papers'], 'days': days}
(root / 'public/calendar/data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
(root / 'tests/official-dates.json').write_text(json.dumps(fixtures, ensure_ascii=False, separators=(',', ':')))
print(f'Prepared {len(fixtures)} official dates, {len(data["months"])} lunar months, {len(data["terms"])} terms, {len(data["holidays"])} holiday years')
