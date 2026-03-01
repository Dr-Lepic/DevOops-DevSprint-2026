'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { connectSocket } from '@/lib/socket';

export default function OrderPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [studentId, setStudentId] = useState('');
  const [itemId, setItemId] = useState('iftar-box-01');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [latency, setLatency] = useState(null);

  const gatewayUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';
  }, []);

  const hubUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3003';
  }, []);

  // Named handler for socket cleanup
  const handleStatusUpdate = useCallback((data) => {
    console.log('📢 Order status update received:', data);
    setOrderStatus(data.status);
    setMessage(`Order ${data.orderId} is ${data.status}!`);

    // Persist update to localStorage (update existing order)
    try {
      const stored = JSON.parse(window.localStorage.getItem('cafeteria_orders') || '[]');
      const idx = stored.findIndex((o) => o.orderId === data.orderId);
      if (idx >= 0) {
        stored[idx] = { ...stored[idx], ...data };
        window.localStorage.setItem('cafeteria_orders', JSON.stringify(stored));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedToken = window.localStorage.getItem('cafeteria_token') || '';
    const storedStudentId = window.localStorage.getItem('cafeteria_student_id') || '';
    setToken(storedToken);
    setStudentId(storedStudentId);

    // Connect to Socket.io if we have a studentId
    if (storedStudentId) {
      const socket = connectSocket(hubUrl, storedStudentId);

      // Listen for order status updates (named handler)
      socket.on('orderStatusUpdate', handleStatusUpdate);

      return () => {
        socket.off('orderStatusUpdate', handleStatusUpdate);
      };
    }
  }, [hubUrl, handleStatusUpdate]);

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!token) {
      setMessage('Please login first.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setOrderId('');
    setOrderStatus('Pending');
    setLatency(null);

    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${gatewayUrl}/order`,
        {
          itemId,
          quantity: Number(quantity),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const elapsed = Date.now() - startTime;
      setLatency(elapsed);

      setStatus('success');
      setMessage(response.data?.message || 'Order placed successfully');
      const newOrderId = response.data?.orderId || '';
      setOrderId(newOrderId);
      setOrderStatus('In Kitchen');

      // Persist new order to localStorage
      if (newOrderId) {
        try {
          const stored = JSON.parse(window.localStorage.getItem('cafeteria_orders') || '[]');
          stored.unshift({
            orderId: newOrderId,
            itemId,
            quantity: Number(quantity),
            status: 'In Kitchen',
            timestamp: new Date().toISOString(),
          });
          window.localStorage.setItem('cafeteria_orders', JSON.stringify(stored));
        } catch { /* ignore */ }
      }
    } catch (error) {
      const statusCode = error?.response?.status;

      if (statusCode === 400) {
        setMessage(error?.response?.data?.error || 'Out of Stock');
      } else if (statusCode === 401) {
        setMessage('Session invalid. Please login again.');
      } else if (statusCode === 409) {
        setMessage('Conflict during deduction. Please retry.');
      } else {
        setMessage('Order failed. Please try again.');
      }

      const elapsed = Date.now() - startTime;
      setLatency(elapsed);

      setStatus('error');
      setOrderStatus('');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded border border-gray-300 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Place Order</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-sm text-gray-500 hover:underline"
              onClick={() => router.push('/admin')}
            >
              Admin
            </button>
            {token && (
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
                onClick={() => router.push('/status')}
              >
                View Status
              </button>
            )}
          </div>
        </div>

        {!token && (
          <div className="mb-4 text-sm">
            <p className="mb-2">No login token found.</p>
            <button
              type="button"
              className="rounded bg-black text-white px-3 py-2"
              onClick={() => router.push('/login')}
            >
              Go to Login
            </button>
          </div>
        )}

        <form className="space-y-4" onSubmit={submitOrder}>
          <div>
            <label className="block text-sm mb-1" htmlFor="itemId">Item ID</label>
            <input
              id="itemId"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              type="number"
              min="1"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
            disabled={status === 'loading' || !token}
          >
            {status === 'loading' ? 'Placing order...' : 'Place Order'}
          </button>
        </form>

        {latency !== null && latency > 1000 && (
          <div className="mt-4 flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>&#9888;</span>
            <span>Gateway responded in {latency}ms (&gt;1s) &mdash; possible congestion</span>
          </div>
        )}

        {latency !== null && latency <= 1000 && (
          <p className="mt-4 text-xs text-gray-400">Response time: {latency}ms</p>
        )}

        {message && <p className="mt-4 text-sm">{message}</p>}
        {orderId && (
          <div className="mt-2 space-y-1">
            <p className="text-xs break-all">Order ID: {orderId}</p>
            {orderStatus && (
              <p className="text-sm font-semibold">
                Status:{' '}
                <span
                  className={
                    orderStatus === 'Ready'
                      ? 'text-green-600'
                      : orderStatus === 'Pending'
                      ? 'text-amber-500'
                      : 'text-blue-600'
                  }
                >
                  {orderStatus}
                </span>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
