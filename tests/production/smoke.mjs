import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('standalone生产服务包含静态资源、服务端API、运行时配置与IP限流', { timeout: 60000 }, async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  reservation.close();
  await once(reservation, 'close');

  // 覆盖所有天气配置，确保测试不读取真实凭据、不请求真实天气上游。
  const sentinel = 'runtime-only-test-marker';
  const child = spawn(process.execPath, ['.next/standalone/server.js'], {
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', TRUST_PROXY: 'true', QWEATHER_API_HOST: '', QWEATHER_KID: sentinel, QWEATHER_ISS: '', QWEATHER_SUB: '', QWEATHER_PRIVATE_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const url = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null) throw Error(`生产服务提前退出：${output}`);
      try { ready = (await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500) })).ok; } catch {}
      if (ready) break;
      await delay(100);
    }
    assert.ok(ready, `生产服务未能启动：${output}`);
    assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { status: 'ok' });
    const home = await fetch(url);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.ok(html.includes('晴序'));
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+)/g)].map(match => match[1]))];
    assert.ok(assets.some(asset => asset.endsWith('.js')));
    assert.ok(assets.some(asset => asset.endsWith('.css')));
    for (const asset of assets) {
      const response = await fetch(url + asset);
      assert.equal(response.status, 200, asset);
      assert.ok(!(await response.text()).includes(sentinel));
    }
    assert.equal((await fetch(`${url}/calendar/data.json`)).status, 200);
    const config = await (await fetch(`${url}/api/status`)).json();
    assert.equal(config.configured, false);
    assert.deepEqual(config.missing, ['QWEATHER_API_HOST', 'QWEATHER_ISS', 'QWEATHER_SUB', 'QWEATHER_PRIVATE_KEY']);
    assert.ok(!JSON.stringify(config).includes(sentinel));
    const check = await (await fetch(`${url}/api/status?check=1`)).json();
    assert.equal(check.connection.code, 'CONFIG_MISSING');
    for (const [path, status, code] of [
      ['/api/weather?kind=current&lat=91&lon=0', 400, 'INVALID_REQUEST'],
      ['/api/weather?kind=current&lat=0&lon=0', 503, 'CONFIG_MISSING'],
      ['/api/locations?q=Beijing', 503, 'CONFIG_MISSING'],
      ['/api/locations?q=Beijing&url=https://example.com', 400, 'INVALID_REQUEST'],
    ]) {
      const response = await fetch(url + path);
      assert.equal(response.status, status, path);
      assert.equal((await response.json()).error.code, code, path);
    }
    for (let i = 0; i < 61; i++) {
      const response = await fetch(`${url}/api/weather?kind=current&lat=0&lon=0`, { headers: { 'X-Real-IP': '203.0.113.42', 'oai-authenticated-user-id': `spoof-${i}` } });
      assert.equal(response.status, i < 60 ? 503 : 429);
      if (i === 60) assert.equal(response.headers.get('retry-after'), '60');
    }
    const otherIp = await fetch(`${url}/api/weather?kind=current&lat=0&lon=0`, { headers: { 'X-Real-IP': '203.0.113.43' } });
    assert.equal(otherIp.status, 503);
    // Next 按路由打包后，同一访客仍必须共享全站的天气 API 限额。
    for (const path of ['/api/locations?q=Beijing', '/api/status?check=1']) {
      const response = await fetch(url + path, { headers: { 'X-Real-IP': '203.0.113.42' } });
      assert.equal(response.status, 429, path);
    }
  } finally {
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(timer);
  }
});
