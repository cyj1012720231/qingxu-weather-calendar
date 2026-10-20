# 地点目录来源

`public/locations.json` 是和风天气（QWeather）公开常用城市 CSV 的字段投影，用于本网站的位置选择器。没有批量请求 GeoAPI 建库，没有补造区县，也没有改写行政名称。

## 可追溯版本

- 获取与核验日期：2026-10-20（Asia/Shanghai）。
- 官方说明：[常见城市列表](https://dev.qweather.com/docs/resource/location-list/)。该页面直接链接下方 QWeather 仓库，说明列表不定期更新，并建议使用 GeoAPI 获得更新、更完整的位置资料。
- 官方仓库：[qwd/LocationList](https://github.com/qwd/LocationList)。
- 固定提交：`bf62f4934f9b2e8260d8a49ee0cf8eb8a948eda3`，提交时间 `2025-11-28T03:53:39Z`。
- 固定源文件：[China-City-List-latest.csv](https://raw.githubusercontent.com/qwd/LocationList/bf62f4934f9b2e8260d8a49ee0cf8eb8a948eda3/China-City-List-latest.csv)。
- CSV 自带版本文字：`China-City-List v202506200`，原样记录，不能当作提交日期。
- CSV 文件 SHA-256：`95bdaeef4f273feb03d706a066526c61b9e2aee599b1b79c1b54aafc2279b8be`。
- GeoAPI 字段参考：[城市搜索](https://dev.qweather.com/docs/api/geoapi/city-lookup/)。下载表中的行政名称以 CSV 本身为准，不假设与当前在线结果完全一致。

## 字段与层级

输出为扁平数组，每个条目包含以下字段：

| JSON 字段 | 官方 CSV 字段 | 处理 |
| --- | --- | --- |
| `id` | `Location_ID` | 原字符串，不能转换成数字，部分 ID 含字母 |
| `name` | `Location_Name_ZH` | 原中文名称 |
| `adm1` | `Adm1_Name_ZH` | 原一级行政区名称 |
| `adm2` | `Adm2_Name_ZH` | 原上级行政区名称 |
| `country` | `Country_Region_ZH` | 原名称，港澳台有各自原始值 |
| `lat` | `Latitude` | 转换为 JSON number |
| `lon` | `Longitude` | 转换为 JSON number |
| `tz` | `Timezone` | 原 IANA 时区，未添加推断或兜底值 |

选择器依次按 `adm1`、同一 `adm1` 内的 `adm2`、对应条目的 `name` 分组，并以 `id` 作为地点唯一键。直辖市和港澳保留源表中同名的 `adm1` / `adm2` 层级。列表同时包含城市中心、区县和其他地点，末级不能统一宣称为“行政区县”；名称不能自行添加“区”或“县”后缀。`country` 保留原表的“中国”“中国台湾省”“香港特别行政区”“澳门特别行政区”，不能只筛选 `country === '中国'`，否则会漏掉港澳台。

## 覆盖与校验

固定快照共 3,577 条位置，3,577 个唯一 Location ID，34 个 `adm1` 分组、392 个 `(adm1, adm2)` 分组。分组数不是行政区划完整性证明，也不是官方地级市数量。

| 范围 | 位置数 | 原始时区 |
| --- | ---: | --- |
| 内地 | 3,183 | `Asia/Shanghai` |
| 香港特别行政区 | 20 | `Asia/Hong_Kong` |
| 澳门特别行政区 | 11 | `Asia/Macau` |
| 台湾省 | 363 | `Asia/Taipei` |

生成时通过 Python 标准库 `csv.DictReader` 解析，移除原文件首行版本信息后逐字段投影，原始记录顺序不变。已运行断言验证：源 SHA-256、版本文字、行数与 ID 唯一性、必需字符串非空、经纬度范围、全部 IANA 时区有效、34 个一级组、392 个上级组、港澳台覆盖数量、北京直辖市行政字段，以及含字母 ID `1B6D3`（香港东区）的完整保留。写入后重新读取 JSON，确认内容与转换结果完全一致。输出 UTF-8 文件为 522,560 字节。

更新时应重新获取官方 CSV，并重新核对来源提交、字段、覆盖和上述校验。这里没有自动同步任务，不保证与在线 GeoAPI 实时一致；没有凭据时也未逐条验证所有 Location ID 的在线可用性。

## 来源归属与许可说明

数据来源为 QWeather / 和风天气。产品页面应按官方[注明来源要求](https://dev.qweather.com/docs/terms/attribution/)展示可见的“和风天气”或“QWeather”并链接至其官网；本说明文件不能替代页面上的归因。

所核验的仓库根目录没有单独的开源 `LICENSE` 文件，因此本项目不将这些数据宣称为 MIT、CC0 或其他自行指定的开放许可。官方[服务条款](https://dev.qweather.com/docs/terms/tos/)指向[开发者许可协议](https://www.qweather.com/terms/developers-eula)，其[正文](https://staticpages.qweather.com/legal/developers-eula.html?head=0)标注更新于 2025-02-08。协议 2.2 对 GeoAPI 排除 2.1.2 和 2.1.3 中涉及存储、缓存、批量下载和修改等许可；本快照取自官方另外提供的可下载 CSV，不是 GeoAPI 响应缓存。本说明记录来源与相关条款，不对未明确列明的独立再分发权作授权判断。
