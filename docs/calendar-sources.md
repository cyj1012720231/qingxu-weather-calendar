# 日历

原日历的算法、官方历表、独立回归样本和许可已迁入晴序；界面由 React 组件接入同站天气切换。无日程或黄历功能。

## 文件与验证

- `components/calendar-view.tsx`：响应式月历、键盘操作与日期详情。
- `lib/calendar/calendar.mjs`：原核心算法；与来源提交一致。
- `public/calendar/data.json`：原官方历表与休班索引；与来源提交一致。
- `public/calendar/LICENSE-holiday`：假日数据 MIT 许可。
- `tests/calendar.test.mjs`、`tests/official-dates.json`：73,049 天回归；执行 `npm test`。
- `scripts/prepare-calendar-data.py`：重建数据，需要在 `work/hko/`、`work/holidays/` 提供原始资料。

## 数据来源与边界

1. 香港天文台 1901—2100 年公历与农历对照表： https://www.hko.gov.hk/tc/gts/time/conversion.htm 。逐年原文路径为 `https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2026c.txt`（年份替换）。农历月界与全部 4,800 个节气来自各年历表，并非固定公历日期或简化推算。远期天文预测日期可能随官方修订。
2. 国务院办公厅年度放假通知，由 https://github.com/NateScarlet/holiday-cn 整理。保存每年完整 `papers` 官方来源链接；包含 2015 年特别放假及 2020 年春节延长通知。MIT 许可见 `dist/vendor/LICENSE-holiday`。
3. 法定假日按 2007 年、2008—2013 年、2014—2024 年、2025 年起的有效规则区分。仅已收录年份显示法定节日分类，放假与补班标记只依赖年度通知。
4. 数据核验日：2026-10-20。2007 年以前官方放假安排尚未收录，2027 年以后尚未公布，不生成休/班标记。新年度数据需要更新后重新发布。
5. 普通周末不标休，闰月不重复传统节日，除夕取农历正月初一前一天。
6. 年度通知包含的跨年休班（例如 2007 年元旦涉及 2006 年末）保留，并在界面注明仅有部分跨年安排。双节重合法定日期例外采用官方解释：2009 年 https://hrss.qingdao.gov.cn/zxzx_47/gzdt_47/202206/t20220613_6130225.shtml ；2020 年 https://rsj.wuhu.gov.cn/content/article/8250944 。

合并来源提交与交互设计见 `docs/calendar-merge.md`。
