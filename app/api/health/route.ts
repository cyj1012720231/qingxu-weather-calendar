export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 容器存活检查不调用和风 API，也不暴露服务端配置。 */
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
