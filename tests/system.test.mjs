#!/usr/bin/env node
import { execSync } from 'node:child_process';

const config = {
  identityUrl: process.env.IDENTITY_URL ?? 'http://localhost:3001',
  gatewayUrl: process.env.GATEWAY_URL ?? 'http://localhost:3000',
  stockUrl: process.env.STOCK_URL ?? 'http://localhost:3002',
  timeoutMs: Number(process.env.TEST_TIMEOUT_MS ?? '5000'),
};

const results = [];

function log(title) {
  process.stdout.write(`\n${title}\n`);
}

function pass(name, details = '') {
  results.push({ name, status: 'PASS', details });
  process.stdout.write(`✅ ${name}${details ? ` — ${details}` : ''}\n`);
}

function fail(name, details = '') {
  results.push({ name, status: 'FAIL', details });
  process.stdout.write(`❌ ${name}${details ? ` — ${details}` : ''}\n`);
}

function skip(name, details = '') {
  results.push({ name, status: 'SKIP', details });
  process.stdout.write(`⏭️  ${name}${details ? ` — ${details}` : ''}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let body;

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function runDockerRedis(command) {
  const full = `docker exec redis redis-cli ${command}`;
  return execSync(full, { encoding: 'utf-8' }).trim();
}

function runDockerDbSql(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const full = `docker exec db psql -U user -d cafeteria -c "${escaped}"`;
  return execSync(full, { encoding: 'utf-8' }).trim();
}

async function main() {
  log('DevSprint Day 1 + Day 2 system tests');

  let token = '';
  let redisAvailable = true;

  try {
    runDockerRedis('PING');
  } catch (error) {
    redisAvailable = false;
    skip(
      'Redis-assisted cache policy checks',
      'docker redis container not available; start compose stack for full Day 2 validation'
    );
  }

  try {
    runDockerDbSql(
      "UPDATE items SET quantity = 50, version = 0 WHERE id IN ('iftar-box-01', 'iftar-box-02');"
    );
    pass('Test stock reset precondition');
  } catch (error) {
    skip(
      'Test stock reset precondition',
      'db container not available for reset; tests may depend on existing stock state'
    );
  }

  try {
    const healthTargets = [
      ['Identity health', `${config.identityUrl}/health`],
      ['Gateway health', `${config.gatewayUrl}/health`],
      ['Stock health', `${config.stockUrl}/health`],
    ];

    for (const [name, url] of healthTargets) {
      const response = await requestJson(url, { method: 'GET' });
      assert(response.status === 200, `${name} expected 200, got ${response.status}`);
      pass(name);
    }
  } catch (error) {
    fail('Service health checks', error.message);
    finalizeAndExit(1);
    return;
  }

  try {
    const login = await requestJson(`${config.identityUrl}/login`, {
      method: 'POST',
      body: JSON.stringify({ studentId: '2100411', password: 'password123' }),
    });

    assert(login.status === 200, `Expected login 200, got ${login.status}`);
    assert(typeof login.body.token === 'string' && login.body.token.length > 20, 'Token missing in login response');
    token = login.body.token;
    pass('Day 1 login success');
  } catch (error) {
    fail('Day 1 login success', error.message);
  }

  try {
    const unauthorized = await requestJson(`${config.gatewayUrl}/order`, {
      method: 'POST',
      body: JSON.stringify({ studentId: '2100411', itemId: 'iftar-box-01', quantity: 1 }),
    });

    assert(unauthorized.status === 401, `Expected 401, got ${unauthorized.status}`);
    pass('Day 2 order requires JWT');
  } catch (error) {
    fail('Day 2 order requires JWT', error.message);
  }

  if (token) {
    try {
      if (redisAvailable) {
        runDockerRedis('SET stock:iftar-box-01 50');
      }

      const order = await requestJson(`${config.gatewayUrl}/order`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: '2100411', itemId: 'iftar-box-01', quantity: 1 }),
      });

      assert(
        order.status === 201,
        `Expected 201, got ${order.status}, response: ${JSON.stringify(order.body)}`
      );
      assert(order.body?.orderId, 'orderId missing in order response');
      pass('Day 2 successful order flow');
    } catch (error) {
      fail('Day 2 successful order flow', error.message);
    }
  } else {
    skip('Day 2 successful order flow', 'no token from Day 1 login test');
  }

  if (token && redisAvailable) {
    try {
      runDockerRedis('SET stock:iftar-box-02 0');

      const blocked = await requestJson(`${config.gatewayUrl}/order`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: '2100411', itemId: 'iftar-box-02', quantity: 1 }),
      });

      assert(blocked.status === 400, `Expected 400, got ${blocked.status}`);
      assert(blocked.body?.error === 'Out of Stock', `Expected Out of Stock error, got ${JSON.stringify(blocked.body)}`);
      pass('Day 2 cache pre-check blocks cached zero');
    } catch (error) {
      fail('Day 2 cache pre-check blocks cached zero', error.message);
    } finally {
      try {
        runDockerRedis('DEL stock:iftar-box-02');
      } catch {
      }
    }
  }

  try {
    const statuses = [];

    for (let index = 0; index < 4; index += 1) {
      const response = await requestJson(`${config.identityUrl}/login`, {
        method: 'POST',
        body: JSON.stringify({ studentId: 'admin', password: 'admin123' }),
      });
      statuses.push(response.status);
    }

    assert(statuses.includes(429), `Expected at least one 429 from rate limit, got [${statuses.join(', ')}]`);
    pass('Day 1 login rate limiting', `statuses: [${statuses.join(', ')}]`);
  } catch (error) {
    fail('Day 1 login rate limiting', error.message);
  }

  finalizeAndExit();
}

function finalizeAndExit(defaultCode = 0) {
  log('Summary');

  const passed = results.filter((result) => result.status === 'PASS').length;
  const failed = results.filter((result) => result.status === 'FAIL').length;
  const skipped = results.filter((result) => result.status === 'SKIP').length;

  process.stdout.write(`Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}\n`);

  if (failed > 0) {
    process.exit(1);
    return;
  }

  process.exit(defaultCode);
}

main().catch((error) => {
  fail('Unhandled test runner error', error.message);
  finalizeAndExit(1);
});
