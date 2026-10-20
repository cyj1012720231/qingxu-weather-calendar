# 官方接口核对记录

核对日期：2026-10-20。实际读取以下官方网页，并据此实现：

- https://dev.qweather.com/docs/api/weather/weather-current/
- https://dev.qweather.com/docs/api/weather/weather-daily-forecast/
- https://dev.qweather.com/docs/api/weather/weather-hourly-forecast/
- https://dev.qweather.com/docs/api/geoapi/city-lookup/
- https://dev.qweather.com/docs/configuration/authentication/
- https://dev.qweather.com/docs/configuration/api-host/
- https://dev.qweather.com/docs/resource/metadata/
- https://dev.qweather.com/docs/resource/error-code/
- https://dev.qweather.com/docs/api/weather/weather-conditions/
- https://dev.qweather.com/docs/terms/attribution/

新天气接口没有顶层 `now/daily/hourly` 旧格式；当前指标直接在顶层，未来数据是 `days[]` 与 `hours[]`。日期字段分别为 `forecastStartTime`/`forecastEndTime` 与 `forecastTime`，日间夜间为 `daytime`/`nighttime`。温度、风速等是携带单位的对象，湿度/云量/降水概率为比例数。实时接口当前文档没有观测时间字段，本站不编造观测时间。

JWT 当前规范要求 Header `alg=EdDSA,kid`，Payload `iss,sub,iat,exp`。GeoAPI 和天气API共用开发者专属Host与服务端认证，Geo坐标顺序与天气路径相反。所有上游请求均以官方当前仍维护的接口为准，没有旧版天气兼容分支。

后台原始响应只保留天气/地理数据，不返回JWT、私钥、Host配置值或上游原始错误内容。归因固定展示和风天气官网链接，并按响应展示 metadata.attributions。位置目录另见 location-source.md。
