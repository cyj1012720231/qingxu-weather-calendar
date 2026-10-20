import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生成包含 Node 服务端和所需依赖的独立目录，供 Docker 镜像运行。
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
