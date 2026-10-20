# 在自己的服务器部署

本版本使用 **Next.js + Node.js 22**，页面与 `/api/*` 均在自己的服务器运行。无需 Cloudflare Workers、Wrangler、Sites 账号或数据库。Compose 启动两个服务：`proxy`（Nginx 入口）和 `app`（同一个 Node.js 进程处理前后端）。天气数据仍来自和风天气，需要自己的和风服务配置。

## 首次启动（Docker Compose）

服务器需具备 Docker Engine、Docker Compose v2 或更新版本，以及访问 npm、Docker 镜像仓库和和风 API 的网络。私密仓库需先配置自己的 GitHub 访问权限，不要在命令、URL 或代码中写 Token。

```sh
git clone https://github.com/cyj1012720231/qingxu-weather-calendar.git
cd qingxu-weather-calendar
cp .env.example .env
chmod 600 .env
```

使用服务器上的文本编辑器填写 `.env`：

| 变量 | 内容 |
| --- | --- |
| `QWEATHER_API_HOST` | 和风控制台分配的专属 `*.qweatherapi.com` 主机名 |
| `QWEATHER_KID` | JWT 凭据 ID |
| `QWEATHER_ISS` | 开发者 ID |
| `QWEATHER_SUB` | 项目 ID |
| `QWEATHER_PRIVATE_KEY` | 与已登记公钥匹配的 Ed25519 PKCS#8 私钥 |
| `HTTP_PORT` | 入口端口，默认 `8080` |
| `BIND_ADDRESS` | 入口绑定地址，默认 `0.0.0.0`；宿主机反代时可设为 `127.0.0.1` |

私钥用单引号包住；可保留真正换行，也可将每个换行写成字面量 `\n`。不要在 `NEXT_PUBLIC_*` 中保存凭据。`.env` 被 Git 和 Docker 构建上下文共同排除，Compose 只在运行时把它注入应用。

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

将端口换成实际 `HTTP_PORT`。健康接口应返回 `{"status":"ok"}`。浏览器访问 `http://服务器IP:8080`；需要放行对应入口端口。应用的 `3000` 端口仅在 Compose 网络内可见，无需开放。

健康检查只验证应用存活，不消耗和风额度，也不代表凭据可用。打开页面的“连接说明 → 重新检查连接”验证真实鉴权，再测试城市搜索、实时天气、日历日期天气。未填写凭据时日历正常使用，天气明确显示待配置。

## HTTPS 与代理

公网正式使用应配置域名和 HTTPS；浏览器的“当前位置”在普通远程 HTTP 地址上不可用，仍可手动选择城市。本仓库没有你的域名或证书，因此不自动申请证书。

可以由已有 Nginx/Caddy/面板在 443 端口终止 HTTPS，再反向代理至 Compose 的入口端口。在宿主机运行该代理时，建议把 `.env` 的 `BIND_ADDRESS` 改为 `127.0.0.1`。也可以按自己的证书配置扩展容器 Nginx，挂载证书并映射 443。

默认限流信任容器 Nginx 覆盖后的 `X-Real-IP`，不会信任访客传入的 `X-Forwarded-For`、Cloudflare 或 ChatGPT 身份头。如果增加一层反代，默认会按该反代的 IP 共享限额；需要在 `deploy/nginx.conf` 的 `server` 中仅信任该代理的实际来源 IP，并确保最外层代理覆盖访客转发头：

```nginx
# 替换示例地址为确实受你控制的代理来源；绝不能设置为 0.0.0.0/0。
set_real_ip_from 192.0.2.10;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

修改后执行 `docker compose exec proxy nginx -t`，通过再执行 `docker compose restart proxy`。不要直接将 `app` 的端口映射到公网，否则会绕过入口代理的 IP 校验。

## 更新、重启与排查

```sh
# 更新代码与镜像
git pull --ff-only
docker compose up -d --build

# 修改 .env 后重建两个服务，同时应用天气凭据、入口绑定地址和端口。
# 只执行 restart 不会重新加载 env_file；只重建 app 不会更新 proxy 的端口。
docker compose up -d --force-recreate

# 只看最近日志；不要分享包含敏感信息的整份环境配置。
docker compose logs --tail=100 app proxy

# 停止服务
docker compose down
```

Nginx 会重新解析应用容器地址，应用重建后不必手动修改 IP。短暂更新期间可能出现 502；本方案是单实例部署，没有实现零停机更新。

天气缓存、请求合并和每 IP 每分钟 60 次限流均在 Node 进程内存中，重启清空；多副本不会共享这些状态。当前不需要数据库。城市收藏与偏好保存在各浏览器的 localStorage，迁移到新域名后不会自动带入旧域名的设置。

## 直接用 Node.js（可选）

```sh
npm ci
cp .env.example .env
# 在编辑器中填写 .env
npm run build
HOSTNAME=127.0.0.1 PORT=3000 npm start
```

需要 Node.js >=22.13。`build` 会生成 `.next/standalone` 并复制浏览器静态资源；`start` 从项目根目录的 `.env` 加载变量，运行该目录内的 `server.js`。使用自己的 systemd 或进程管理器托管启动命令。

直接运行默认 `TRUST_PROXY=false`，所有请求共享限额；只有在可信反代覆盖 `X-Real-IP`、Node 端口仅绑定本机或私网时，才将它设为 `true`。凭据变化后重启 Node 进程。

## 本地开发与验证

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 4173
npm test
npm run typecheck
npm run build
npm run test:production
```

生产冒烟测试启动实际 standalone 服务并检查页面、静态资源、配置/API 错误响应和代理限流；使用测试环境变量，不连接真实和风账号。
