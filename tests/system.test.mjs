#!/usr/bin/env node
import { execSync } from 'node:child_process';

const config = {
  identityUrl: process.env.IDENTITY_URL ?? 'http://localhost:3001',
  gatewayUrl: process.env.GATEWAY_URL ?? 'http://localhost:3000',
  stockUrl: process.env.STOCK_URL ?? 'http://localhost:3002',
  notificationHubUrl: process.env.NOTIFICATION_HUB_URL ?? 'http://localhost:3003',
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

function runDockerDbSql(sql, raw = false) {
  const escaped = sql.replace(/"/g, '\\"');
  const flags = raw ? '-t -A' : '';
  const full = `docker exec db psql -U user -d cafeteria ${flags} -c "${escaped}"`;
  return execSync(full, { encoding: 'utf-8' }).trim();
}

async function main() {
  log('═══════════════════════════════════════');
  log('  DevSprint System Tests (Day 1-3)');
  log('═══════════════════════════════════════');

  let token = '';
  let redisAvailable = true;
  let dbAvailable = true;

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
    dbAvailable = false;
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
      ['Notification Hub health', `${config.notificationHubUrl}/health`],
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

  // ─── Day 3: Notification Hub /notify endpoint ───────────────────────
  log('\n─── Day 3 Tests ───');

  try {
    const notify = await requestJson(`${config.notificationHubUrl}/notify`, {
      method: 'POST',
      body: JSON.stringify({
        studentId: '2100411',
        orderId: 'test-notify-001',
        status: 'Ready',
      }),
    });

    assert(notify.status === 200, `Expected 200, got ${notify.status}`);
    assert(
      notify.body?.message === 'Notification broadcasted',
      `Expected "Notification broadcasted", got ${JSON.stringify(notify.body)}`
    );
    pass('Day 3 notification hub /notify endpoint');
  } catch (error) {
    fail('Day 3 notification hub /notify endpoint', error.message);
  }

  // ─── Day 3: /notify validates payload ───────────────────────────────
  try {
    const badNotify = await requestJson(`${config.notificationHubUrl}/notify`, {
      method: 'POST',
      body: JSON.stringify({ studentId: '2100411' }), // missing orderId, status
    });

    assert(badNotify.status === 400, `Expected 400, got ${badNotify.status}`);
    pass('Day 3 notification hub rejects incomplete payload');
  } catch (error) {
    fail('Day 3 notification hub rejects incomplete payload', error.message);
  }

  // ─── Day 3: Kitchen Queue processes order end-to-end ────────────────
  // Place an order, then poll notification hub health to confirm the
  // worker picks up the job. We validate by checking that the order
  // succeeds (201) and then waiting enough time for the kitchen worker
  // to process (3-7s) and call /notify.
  if (token) {
    try {
      // Reset stock for this test
      if (redisAvailable) {
        runDockerRedis('SET stock:iftar-box-01 50');
      }
      if (dbAvailable) {
        runDockerDbSql(
          "UPDATE items SET quantity = 50, version = 0 WHERE id = 'iftar-box-01';"
        );
      }

      const order = await requestJson(`${config.gatewayUrl}/order`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId: 'iftar-box-01', quantity: 1 }),
      });

      assert(order.status === 201, `Expected 201, got ${order.status}`);
      assert(order.body?.orderId, 'orderId missing');
      pass('Day 3 order enqueued to kitchen', `orderId: ${order.body.orderId}`);

      // Wait for kitchen worker to process (max 3-7s cook + network)
      log('  ⏳ Waiting 9s for kitchen worker to process...');
      await new Promise((r) => setTimeout(r, 9000));

      // Verify the worker ran by checking the queue is drained.
      // We use Redis to inspect BullMQ completed count.
      if (redisAvailable) {
        const completedRaw = runDockerRedis('ZCARD bull:cook_order:completed');
        const completed = parseInt(completedRaw, 10);
        assert(completed >= 1, `Expected ≥1 completed jobs, got ${completed}`);
        pass('Day 3 kitchen worker processed job', `completed jobs: ${completed}`);
      } else {
        skip('Day 3 kitchen worker processed job', 'Redis not available to inspect queue');
      }
    } catch (error) {
      fail('Day 3 kitchen queue end-to-end', error.message);
    }
  } else {
    skip('Day 3 kitchen queue end-to-end', 'no token');
  }

  // ─── Thundering Herd: concurrent burst test ─────────────────────────
  log('\n─── Thundering Herd Test ───');

  if (token && redisAvailable && dbAvailable) {
    const HERD_STOCK = 10;
    const HERD_REQUESTS = 25;
    const ITEM_ID = 'iftar-box-02';

    try {
      // Reset to exactly HERD_STOCK units
      runDockerDbSql(
        `UPDATE items SET quantity = ${HERD_STOCK}, version = 0 WHERE id = '${ITEM_ID}';`
      );
      runDockerRedis(`SET stock:${ITEM_ID} ${HERD_STOCK}`);
      pass('Thundering herd precondition reset', `stock=${HERD_STOCK}, requests=${HERD_REQUESTS}`);

      // Fire HERD_REQUESTS concurrent order requests
      const promises = Array.from({ length: HERD_REQUESTS }, () =>
        requestJson(`${config.gatewayUrl}/order`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({ itemId: ITEM_ID, quantity: 1 }),
        })
      );

      const responses = await Promise.all(promises);

      const succeeded = responses.filter((r) => r.status === 201).length;
      const outOfStock = responses.filter((r) => r.status === 400).length;
      const conflicts = responses.filter((r) => r.status === 409).length;
      const otherErrors = responses.filter(
        (r) => ![201, 400, 409].includes(r.status)
      ).length;

      log(`  Results: ${succeeded} succeeded, ${outOfStock} out-of-stock, ${conflicts} conflicts, ${otherErrors} other`);

      // Core assertion: cannot sell more than available stock
      assert(
        succeeded <= HERD_STOCK,
        `Oversold! ${succeeded} orders succeeded but only ${HERD_STOCK} in stock`
      );
      pass(
        'Thundering herd no overselling',
        `${succeeded}/${HERD_REQUESTS} succeeded (max ${HERD_STOCK})`
      );

      // Verify DB quantity is non-negative (no overselling at DB level)
      const dbResult = runDockerDbSql(
        `SELECT quantity FROM items WHERE id = '${ITEM_ID}';`, true
      );
      const dbQty = parseInt(dbResult.trim(), 10);
      assert(dbQty >= 0, `DB quantity went negative: ${dbQty}`);
      assert(
        dbQty === HERD_STOCK - succeeded,
        `DB quantity mismatch: expected ${HERD_STOCK - succeeded}, got ${dbQty}`
      );
      pass('Thundering herd DB integrity', `remaining=${dbQty}`);

      // Verify Redis cache is in sync with DB
      const redisQty = parseInt(runDockerRedis(`GET stock:${ITEM_ID}`), 10);
      assert(redisQty >= 0, `Redis stock went negative: ${redisQty}`);
      assert(
        redisQty === dbQty,
        `Redis/DB mismatch: Redis=${redisQty}, DB=${dbQty}`
      );
      pass('Thundering herd Redis-DB cache sync', `Redis=${redisQty}, DB=${dbQty}`);
    } catch (error) {
      fail('Thundering herd test', error.message);
    } finally {
      // Clean up: restore stock
      try {
        runDockerDbSql(
          `UPDATE items SET quantity = 50, version = 0 WHERE id = '${ITEM_ID}';`
        );
        runDockerRedis(`SET stock:${ITEM_ID} 50`);
      } catch { /* best effort */ }
    }
  } else {
    skip(
      'Thundering herd test',
      'Requires token + Redis + DB containers'
    );
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
