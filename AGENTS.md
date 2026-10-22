<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 晴序 · 天气与日历

本文件记录项目长期适用的开发约定。上方 Next.js 托管规则块由 `next dev` 维护，项目说明写在标记之外。

## 技术栈与运行方式

- Next.js App Router、React、TypeScript、Tailwind CSS；UI 优先复用 `components/ui/` 的现有组件。
- 使用 npm 与 `package-lock.json`，Node.js 要求 `>=22.13.0`。
- 页面和 `/api/*` 均由 Node.js 服务处理，使用 Next.js `standalone` 输出；部署入口为 Docker Compose 与 Nginx。
- 自托管运行不依赖 Sites、Cloudflare Workers 或数据库；已有迁移文档只作为历史参考。

## 常用命令

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 4173
npm test
npm run lint
npm run typecheck
npm run build
npm run test:production
npm start
```

- `npm run build` 包含 `scripts/prepare-standalone.mjs`，负责补齐 standalone 静态资源，不要只运行 `next build` 代替完整构建。
- `npm start` 与 `npm run test:production` 均需先完成构建。生产冒烟测试会临时启动本地 standalone 服务，使用测试配置，不验证真实和风天气连接。
- 本地天气配置参照 `.env.example` 与 [部署文档](docs/deployment.md)，不要输出真实 `.env` 或凭据内容。

## 关键文件

- `app/page.tsx`：页面切换、位置选择、偏好、常用城市与天气加载。
- `components/calendar-view.tsx`、`components/date-weather.tsx`：月历交互与指定日期天气；`components/weather-ui.tsx`：天气展示与图表。
- `app/globals.css`：响应式布局与天气动画；`components/ui/`：现有基础 UI 组件。
- `lib/calendar/calendar.mjs`、`lib/calendar/calendar.d.mts`：日历算法与对应类型声明；`public/calendar/data.json`：官方历表及休班数据。
- `lib/weather.ts`、`lib/date-weather.ts`：天气类型、单位、时区、日期范围与历史响应转换。
- `lib/weather-client.ts`：浏览器请求、请求取消、旧数据回退与地点解析。
- `lib/qweather-server.ts`：上游参数校验、固定路径、签名、缓存、限流与错误处理。
- `lib/weather-runtime.ts`、`lib/weather-service.ts`：Node.js 环境配置与服务实例；`app/api/`：本站 API 入口。
- `Dockerfile`、`compose.yaml`、`deploy/nginx.conf`：自托管构建与入口代理；`scripts/prepare-standalone.mjs`：构建后静态资源复制。

## 必须保持的业务约定

- 日历范围为 1901—2100 年，“今天”按北京时间计算；天气日期和时间按所选城市时区计算，不能使用浏览器或服务器本地时区替代。
- 天气查询支持含今天共 10 日预报，以及不含今天的过去 10 日历史；日期必须精确匹配，超出范围或缺少数据时明确提示，不能用今天或相邻日期代替。
- 当前与预报接口使用新版值对象及单位；历史接口单独转换旧版字符串字段。保留数值 `0` 与缺失值的区别，不补造天气、降水概率或观测时间。
- 日历页面不请求天气，自动定位延后到进入天气页面。天气按当前可见视图加载，不增加定时天气轮询；本地时钟更新不触发天气请求。
- 手动刷新保留已有内容、滚动位置与展开状态；失败回退保留过期提示和数据来源。切换城市或日期时保留请求取消与防止旧响应覆盖新选择的处理。
- 农历、节气、休班以已收录的官方资料为准，不推测未收录年份的放假安排，不把普通周末标成官方休假；更新数据时保留来源、许可与独立回归样本。
- UI 改动保留键盘操作、无障碍名称、触摸交互、移动端布局及减少动态效果的支持。

## 服务端与凭据边界

- 和风天气凭据仅由 Node.js 服务端在运行时读取；不要写入客户端模块、`NEXT_PUBLIC_*`、构建配置、静态资源、日志或返回给浏览器。
- 浏览器通过本站 `/api/*` 访问天气与地点服务；保留上游 Host、路径和参数白名单以及禁用重定向的限制，不开放任意 URL 代理。
- 保留缓存隔离、同请求合并、限流与错误冷却。当前缓存和限流为进程内实现，不能宣称支持多副本共享配额。
- `/api/health` 仅用于存活检查，不访问天气上游；真实连接检查通过 `/api/status?check=1`，会访问上游并可能消耗额度。
- 不提交 `.env`、私钥、构建产物或本地工具状态；需要新增配置时同步维护 `.env.example` 和部署文档，示例不得包含真实凭据。

## 修改与验证

- 优先复用现有组件、工具函数和依赖；改动共享逻辑前检查调用方和相关测试，不顺手重排或重写无关代码。
- 新增或修改核心逻辑、复杂判断和特殊实现时，补齐必要中文注释；核心方法按需添加中文 JSDoc，说明约束与原因。
- 测试使用 Node.js 内置 `node:test`；单元与回归测试位于 `tests/*.test.ts`、`tests/*.test.mjs`，生产冒烟测试位于 `tests/production/smoke.mjs`。
- 按改动范围验证：逻辑改动运行相关测试；类型或组件改动运行类型检查与 lint；构建、路由或部署改动运行完整构建及生产冒烟测试。
- 日历算法或数据改动需运行 `npm test`，保留 `tests/official-dates.json` 的 73,049 天独立回归，不能根据待测算法生成期望结果。
- UI 改动还需实际检查移动端与桌面布局和受影响交互；组件渲染测试不能替代浏览器验证。
- 只报告实际完成的验证；合成测试或未配置凭据的冒烟测试不能证明真实上游、账户权限或额度可用。

## 进一步阅读

- [README](README.md)：项目概况与功能说明。
- [部署与排查](docs/deployment.md)、[自托管验证记录](docs/self-hosting-verification.md)。
- [天气接口协议](docs/api-contract.md)、[地点目录来源](docs/location-source.md)、[日历来源与边界](docs/calendar-sources.md)。
- `docs/verification.md` 中标明的 Sites 阶段记录是历史资料，当前部署以自托管文档和实际代码为准。
