'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const SERVICES = [
  { key: 'identity-provider', name: 'Identity Provider', envKey: 'NEXT_PUBLIC_IDENTITY_URL', fallback: 'http://localhost:3001' },
  { key: 'order-gateway', name: 'Order Gateway', envKey: 'NEXT_PUBLIC_GATEWAY_URL', fallback: 'http://localhost:3000' },
  { key: 'stock-service', name: 'Stock Service', envKey: 'NEXT_PUBLIC_STOCK_SERVICE_URL', fallback: 'http://localhost:3002' },
  { key: 'kitchen-queue', name: 'Kitchen Queue', envKey: 'NEXT_PUBLIC_KITCHEN_QUEUE_URL', fallback: 'http://localhost:3005' },
  { key: 'notification-hub', name: 'Notification Hub', envKey: 'NEXT_PUBLIC_HUB_URL', fallback: 'http://localhost:3003' },
];

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatusBadge({ status }) {
  const styles = {
    healthy: 'bg-green-100 text-green-800',
    degraded: 'bg-amber-100 text-amber-800',
    down: 'bg-red-100 text-red-800',
  };
  const labels = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    down: 'Down',
  };
  const key = status || 'down';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${styles[key] || styles.down}`}>
      {labels[key] || 'Down'}
    </span>
  );
}

function DependencyDot({ name, status }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={`w-2 h-2 rounded-full ${status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-gray-600">{name}</span>
      <span className={status === 'up' ? 'text-green-700' : 'text-red-700'}>{status}</span>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [healthData, setHealthData] = useState({});
  const [lastPoll, setLastPoll] = useState(null);
  const [polling, setPolling] = useState(false);

  const serviceUrls = useMemo(() => {
    const urls = {};
    SERVICES.forEach((svc) => {
      urls[svc.key] = (typeof window !== 'undefined' && process.env[svc.envKey]) || svc.fallback;
    });
    return urls;
  }, []);

  const fetchHealth = useCallback(async () => {
    setPolling(true);
    const results = await Promise.allSettled(
      SERVICES.map(async (svc) => {
        const url = serviceUrls[svc.key];
        const res = await axios.get(`${url}/health`, { timeout: 3000 });
        return { key: svc.key, data: res.data, error: null };
      })
    );

    const newData = {};
    results.forEach((result, idx) => {
      const svc = SERVICES[idx];
      if (result.status === 'fulfilled') {
        newData[svc.key] = { ...result.value.data, error: null, lastChecked: new Date().toISOString() };
      } else {
        newData[svc.key] = {
          status: 'down',
          service: svc.name,
          error: result.reason?.message || 'Unreachable',
          lastChecked: new Date().toISOString(),
        };
      }
    });

    setHealthData(newData);
    setLastPoll(new Date());
    setPolling(false);
  }, [serviceUrls]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const healthyCount = Object.values(healthData).filter((d) => d.status === 'healthy').length;
  const totalCount = SERVICES.length;

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              {healthyCount}/{totalCount} services healthy
              {lastPoll && (
                <span> &middot; Last poll: {lastPoll.toLocaleTimeString()}</span>
              )}
              {polling && <span className="ml-2 text-gray-400">polling...</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-sm text-gray-500 hover:underline"
              onClick={fetchHealth}
            >
              Refresh Now
            </button>
            <button
              type="button"
              className="rounded bg-black text-white px-4 py-2 text-sm"
              onClick={() => router.push('/order')}
            >
              Place Order
            </button>
          </div>
        </div>

        {/* Overall status bar */}
        <div className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium ${
          healthyCount === totalCount
            ? 'bg-green-100 text-green-800'
            : healthyCount > 0
            ? 'bg-amber-100 text-amber-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {healthyCount === totalCount
            ? 'All systems operational'
            : healthyCount > 0
            ? `${totalCount - healthyCount} service(s) degraded or down`
            : 'All services are unreachable'}
        </div>

        {/* Service grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((svc) => {
            const data = healthData[svc.key];
            return (
              <div
                key={svc.key}
                className={`bg-white rounded-lg border p-5 shadow-sm ${
                  !data || data.status === 'down'
                    ? 'border-red-200'
                    : data.status === 'degraded'
                    ? 'border-amber-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">{svc.name}</h2>
                  <StatusBadge status={data?.status} />
                </div>

                {data?.error && (
                  <p className="text-xs text-red-600 mb-2">{data.error}</p>
                )}

                {data?.uptime !== undefined && (
                  <p className="text-xs text-gray-500 mb-3">
                    Uptime: {formatUptime(data.uptime)}
                  </p>
                )}

                {/* Dependencies */}
                {data?.dependencies && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-400 uppercase mb-1">Dependencies</p>
                    <div className="space-y-1">
                      {Object.entries(data.dependencies).map(([name, status]) => (
                        <DependencyDot key={name} name={name} status={status} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Queue stats (kitchen-queue only) */}
                {data?.queue && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-400 uppercase mb-1">Queue</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Waiting</span>
                        <span className="font-mono">{data.queue.waiting}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Active</span>
                        <span className="font-mono">{data.queue.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Completed</span>
                        <span className="font-mono text-green-700">{data.queue.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Failed</span>
                        <span className="font-mono text-red-700">{data.queue.failed}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Socket connections (notification-hub only) */}
                {data?.connections !== undefined && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase mb-1">Connections</p>
                    <p className="text-xs text-gray-600">
                      <span className="font-mono">{data.connections}</span> active socket{data.connections !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {/* Last checked */}
                {data?.lastChecked && (
                  <p className="text-xs text-gray-300 mt-3">
                    Checked: {new Date(data.lastChecked).toLocaleTimeString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
