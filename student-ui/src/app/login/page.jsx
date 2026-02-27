'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

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
      setMessage('Login successful');

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cafeteria_token', receivedToken);
        window.localStorage.setItem('cafeteria_student_id', response.data?.studentId || studentId);
      }

      router.push('/order');
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode === 401) {
        setMessage('Invalid credentials');
      } else if (statusCode === 429) {
        setMessage('Too many attempts. Please wait 1 minute.');
      } else if (statusCode === 400) {
        setMessage('studentId and password are required');
      } else {
        setMessage('Login failed. Please try again.');
      }
      setStatus('error');
      setToken('');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded border border-gray-300 p-6">
        <h1 className="text-xl font-semibold mb-4">Student Login</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm mb-1" htmlFor="studentId">Student ID</label>
            <input
              id="studentId"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="2100411"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password123"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm">{message}</p>
        )}

        {token && (
          <p className="mt-2 text-xs break-all">JWT: {token}</p>
        )}
      </section>
    </main>
  );
}
