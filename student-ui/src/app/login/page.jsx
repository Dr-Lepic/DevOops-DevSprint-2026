'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function LoginPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const identityUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:3001';
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await axios.post(`${identityUrl}/login`, {
        studentId,
        password,
      });

      const receivedToken = response.data?.token || '';
      setToken(receivedToken);
      setStatus('success');
      setMessage('Login successful! Redirecting...');

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cafeteria_token', receivedToken);
        window.localStorage.setItem('cafeteria_student_id', response.data?.studentId || studentId);
      }

      setTimeout(() => router.push('/order'), 500);
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode === 401) {
        setMessage('❌ Invalid credentials');
      } else if (statusCode === 429) {
        setMessage('⏰ Too many attempts. Please wait 1 minute.');
      } else if (statusCode === 400) {
        setMessage('⚠️ Student ID and password are required');
      } else {
        setMessage('❌ Login failed. Please try again.');
      }
      setStatus('error');
      setToken('');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <section className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mb-4">
            <span className="text-4xl">🎓</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">IUT Cafeteria</h1>
          <p className="text-gray-600">DevSprint 2026 - Student Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">Student Login</h2>
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="studentId">
                Student ID
              </label>
              <input
                id="studentId"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="2100411"
                required
                disabled={status === 'loading'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                disabled={status === 'loading'}
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  <span className="ml-2">Logging in...</span>
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {message && (
            <div
              className={`mt-5 p-4 rounded-lg text-sm ${
                status === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}

          {/* Demo credentials hint */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600 font-medium mb-2">📝 Demo Credentials:</p>
            <p className="text-xs text-gray-500">ID: <code className="bg-gray-200 px-1 rounded">2100411</code></p>
            <p className="text-xs text-gray-500">Pass: <code className="bg-gray-200 px-1 rounded">password123</code></p>
          </div>
        </div>
      </section>
    </main>
  );
}
