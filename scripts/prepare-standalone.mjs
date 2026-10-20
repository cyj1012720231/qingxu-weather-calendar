import { cpSync } from 'node:fs';

// Next standalone 只追踪服务端文件；补齐静态资源，让 Docker 和 npm start 输出一致。
cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
