import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生成包含 Node 服务端和所需依赖的独立目录，供 Docker 镜像运行。
  output: "standalone",
  poweredByHeader: false,
  // 允许通过这台电脑的局域网 IP 加载开发资源与热更新。
  allowedDevOrigins: ["192.168.1.110"],
  agentRules: false
};

export default nextConfig;
