'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Header from '@/components/Header';
import LoadingSpinner from '@/components/LoadingSpinner';

const SERVICES = [
  { key: 'identity-provider', name: 'Identity Provider', envKey: 'NEXT_PUBLIC_IDENTITY_URL', fallback: 'http://localhost:3001', icon: '🔐' },
  { key: 'order-gateway', name: 'Order Gateway', envKey: 'NEXT_PUBLIC_GATEWAY_URL', fallback: 'http://localhost:3000', icon: '🚪' },
  { key: 'stock-service', name: 'Stock Service', envKey: 'NEXT_PUBLIC_STOCK_SERVICE_URL', fallback: 'http://localhost:3002', icon: '📦' },
  { key: 'kitchen-queue', name: 'Kitchen Queue', envKey: 'NEXT_PUBLIC_KITCHEN_QUEUE_URL', fallback: 'http://localhost:3005', icon: '👨‍🍳' },
  { key: 'notification-hub', name: 'Notification Hub', envKey: 'NEXT_PUBLIC_HUB_URL', fallback: 'http://localhost:3003', icon: '📢' },
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
    healthy: 'bg-green-100 text-green-800 border-green-300',
    degraded: 'bg-amber-100 text-amber-800 border-amber-300',
    down: 'bg-red-100 text-red-800 border-red-300',
  };
  const labels = {
    healthy: '✅ Healthy',
    degraded: '⚠️ Degraded',
    down: '❌ Down',
  };
  const key = status || 'down';
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border-2 ${styles[key] || styles.down}`}>
      {labels[key] || '❌ Down'}
    </span>
  );
}

function DependencyDot({ name, status }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2.5 h-2.5 rounded-full ${status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-gray-700 font-medium">{name}</span>
      <span className={`ml-auto font-semibold ${status === 'up' ? 'text-green-700' : 'text-red-700'}`}>
        {status === 'up' ? 'UP' : 'DOWN'}
      </span>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [healthData, setHealthData] = useState({});
  const [lastPoll, setLastPoll] = useState(null);
  const [polling, setPolling] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const ADMIN_PASSWORD = 'admin123'; // Simple password for demo

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
    // Check if already authenticated
    if (typeof window !== 'undefined') {
      const adminAuth =window.sessionStorage.getItem('admin_auth');
      if (adminAuth === 'verified') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth, isAuthenticated]);

  const healthyCount = Object.values(healthData).filter((d) => d.status === 'healthy').length;
  const totalCount = SERVICES.length;

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError('');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('admin_auth', 'verified');
      }
    } else {
      setAuthError('❌ Invalid password. Please try again.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('admin_auth');
    }
    router.push('/order');
  };

  // Show password verification screen if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <section className="w-full max-w-md">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mb-4">
              <span className="text-4xl">⚙️</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Access</h1>
            <p className="text-gray-600">Enter admin password to continue</p>
          </div>

          {/* Password Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">Authentication Required</h2>
            <form className="space-y-5" onSubmit={handlePasswordSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="adminPassword">
                  Admin Password
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Access Admin Dashboard
              </button>
            </form>

            {authError && (
              <div className="mt-5 p-4 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                {authError}
              </div>
            )}

            {/* Demo password hint */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 font-medium mb-2">🔐 Demo Password:</p>
              <p className="text-xs text-gray-500">Password: <code className="bg-gray-200 px-1 rounded">admin123</code></p>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/order')}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                ← Back to Order Page
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
        <div className="max-w-7xl mx-auto pt-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">⚙️ Admin Dashboard</h1>
                <p className="text-gray-600">
                  Monitor all microservices health and performance
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchHealth}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-300 hover:border-indigo-500 rounded-lg text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors shadow-sm"
                  disabled={polling}
                >
                  {polling ? (
                    <>
                      <LoadingSpinner size="sm" color="gray" />
                      <span>Refreshing...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>Refresh Now</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-5 py-2.5 bg-red-50 border-2 border-red-300 hover:bg-red-100 rounded-lg text-sm font-medium text-red-700 transition-colors shadow-sm"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Overall Status Banner */}
            <div
              className={`rounded-xl px-6 py-4 shadow-md border-2 ${
                healthyCount === totalCount
                  ? 'bg-green-50 border-green-300 text-green-900'
                  : healthyCount > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {healthyCount === totalCount ? '✅' : healthyCount > 0 ? '⚠️' : '❌'}
                  </span>
                  <div>
                    <p className="font-bold text-lg">
                      {healthyCount === totalCount
                        ? 'All Systems Operational'
                        : healthyCount > 0
                        ? `${totalCount - healthyCount} Service(s) Degraded or Down`
                        : 'All Services Unreachable'}
                    </p>
                    <p className="text-sm opacity-80">
                      {healthyCount}/{totalCount} services healthy
                      {lastPoll && (
                        <span> • Last updated: {lastPoll.toLocaleTimeString()}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">
                    {healthyCount}/{totalCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Service Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((svc) => {
              const data = healthData[svc.key];
              const isDown = !data || data.status === 'down';
              const isDegraded = data?.status === 'degraded';

              return (
                <div
                  key={svc.key}
                  className={`bg-white rounded-xl shadow-lg border-2 overflow-hidden transition-all hover:shadow-xl ${
                    isDown
                      ? 'border-red-300'
                      : isDegraded
                      ? 'border-amber-300'
                      : 'border-green-300'
                  }`}
                >
                  {/* Service Header */}
                  <div className={`px-6 py-4 ${
                    isDown
                      ? 'bg-red-50'
                      : isDegraded
                      ? 'bg-amber-50'
                      : 'bg-green-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{svc.icon}</span>
                        <h2 className="font-bold text-gray-900">{svc.name}</h2>
                      </div>
                      <StatusBadge status={data?.status} />
                    </div>
                  </div>

                  {/* Service Body */}
                  <div className="p-6 space-y-4">
                    {/* Error Message */}
                    {data?.error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-800 font-medium">{data.error}</p>
                      </div>
                    )}

                    {/* Uptime */}
                    {data?.uptime !== undefined && (
                      <div className="flex items-center justify-between py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">⏱️ Uptime</span>
                        <span className="text-sm font-bold text-gray-900">{formatUptime(data.uptime)}</span>
                      </div>
                    )}

                    {/* Dependencies */}
                    {data?.dependencies && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Dependencies</p>
                        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                          {Object.entries(data.dependencies).map(([name, status]) => (
                            <DependencyDot key={name} name={name} status={status} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Queue Stats (kitchen-queue only) */}
                    {data?.queue && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Queue Stats</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <p className="text-xs text-blue-600 mb-1">Waiting</p>
                            <p className="text-2xl font-bold text-blue-900">{data.queue.waiting}</p>
                          </div>
                          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                            <p className="text-xs text-indigo-600 mb-1">Active</p>
                            <p className="text-2xl font-bold text-indigo-900">{data.queue.active}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <p className="text-xs text-green-600 mb-1">Completed</p>
                            <p className="text-2xl font-bold text-green-900">{data.queue.completed}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                            <p className="text-xs text-red-600 mb-1">Failed</p>
                            <p className="text-2xl font-bold text-red-900">{data.queue.failed}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Socket Connections (notification-hub only) */}
                    {data?.connections !== undefined && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                        <p className="text-xs text-indigo-600 uppercase font-bold mb-1">Socket Connections</p>
                        <p className="text-3xl font-bold text-indigo-900">
                          {data.connections}
                          <span className="text-sm text-indigo-600 ml-2">active</span>
                        </p>
                      </div>
                    )}

                    {/* Last Checked */}
                    {data?.lastChecked && (
                      <p className="text-xs text-gray-400 text-center pt-2">
                        Checked: {new Date(data.lastChecked).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
