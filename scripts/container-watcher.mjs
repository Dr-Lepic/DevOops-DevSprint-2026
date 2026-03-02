import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const pollIntervalMs = Number(process.env.CONTAINER_WATCH_INTERVAL_MS || 5000);
const restartCooldownMs = Number(process.env.CONTAINER_RESTART_COOLDOWN_MS || 15000);
const restartUnhealthy = (process.env.CONTAINER_RESTART_UNHEALTHY || 'false').toLowerCase() === 'true';
const runOnce = process.argv.includes('--once');

const serviceCooldownUntil = new Map();
let checkInProgress = false;

const nowIso = () => new Date().toISOString();

const parseComposePsJson = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

const parseComposeServices = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const shouldRecover = (entry) => {
  const state = String(entry.State || '').toLowerCase();
  const health = String(entry.Health || '').toLowerCase();

  if (state !== 'running') {
    return true;
  }

  if (restartUnhealthy && health === 'unhealthy') {
    return true;
  }

  return false;
};

const listRecoverableServices = async () => {
  const [{ stdout: psStdout }, { stdout: servicesStdout }] = await Promise.all([
    execFileAsync('docker', ['compose', 'ps', '--format', 'json'], {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }),
    execFileAsync('docker', ['compose', 'config', '--services'], {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }),
  ]);

  const entries = parseComposePsJson(psStdout);
  const declaredServices = parseComposeServices(servicesStdout);
  const serviceByName = new Map(entries.map((entry) => [String(entry.Service), entry]));

  const recoverable = [];

  for (const service of declaredServices) {
    const entry = serviceByName.get(service);

    if (!entry) {
      recoverable.push({
        service,
        state: 'missing',
        health: 'unknown',
        status: 'container not present',
      });
      continue;
    }

    if (shouldRecover(entry)) {
      recoverable.push({
        service,
        state: String(entry.State || 'unknown'),
        health: String(entry.Health || 'unknown'),
        status: String(entry.Status || 'unknown'),
      });
    }
  }

  return recoverable;
};

const recoverService = async (service) => {
  await execFileAsync('docker', ['compose', 'up', '-d', service], {
    cwd: process.cwd(),
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
};

const canAttemptNow = (service) => {
  const until = serviceCooldownUntil.get(service) || 0;
  return Date.now() >= until;
};

const setCooldown = (service) => {
  serviceCooldownUntil.set(service, Date.now() + restartCooldownMs);
};

const runCheck = async () => {
  if (checkInProgress) {
    return;
  }

  checkInProgress = true;

  try {
    const downServices = await listRecoverableServices();

    if (downServices.length === 0) {
      console.log(`[${nowIso()}] ✅ All watched services are healthy/running.`);
      return;
    }

    for (const entry of downServices) {
      if (!canAttemptNow(entry.service)) {
        continue;
      }

      console.log(
        `[${nowIso()}] 🔄 Recovering ${entry.service} (state=${entry.state}, health=${entry.health}, status=${entry.status})`
      );

      try {
        await recoverService(entry.service);
        setCooldown(entry.service);
        console.log(`[${nowIso()}] ✅ Recovery command completed for ${entry.service}`);
      } catch (error) {
        setCooldown(entry.service);
        console.error(`[${nowIso()}] ❌ Recovery failed for ${entry.service}:`, error.message || error);
      }
    }
  } catch (error) {
    console.error(`[${nowIso()}] ❌ Watch check failed:`, error.message || error);
  } finally {
    checkInProgress = false;
  }
};

console.log(
  `[${nowIso()}] 👀 Container watcher started (interval=${pollIntervalMs}ms, cooldown=${restartCooldownMs}ms, restartUnhealthy=${restartUnhealthy})`
);

if (runOnce) {
  await runCheck();
  process.exit(0);
}

await runCheck();
const interval = setInterval(runCheck, pollIntervalMs);

const shutdown = () => {
  clearInterval(interval);
  console.log(`[${nowIso()}] 🛑 Container watcher stopped.`);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);