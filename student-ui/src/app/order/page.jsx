'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { connectSocket, disconnectSocket } from '@/lib/socket';

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

  const gatewayUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';
  }, []);

  const hubUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3003';
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

      // Listen for order status updates
      socket.on('orderStatusUpdate', (data) => {
        console.log('📢 Order status update received:', data);
        setOrderStatus(data.status);
        setMessage(`Order ${data.orderId} is ${data.status}!`);
      });

      return () => {
        disconnectSocket();
      };
    }
  }, [hubUrl]);

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!token) {
      setMessage('Please login first.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setOrderId('');
    setOrderStatus('');

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

      setStatus('success');
      setMessage(response.data?.message || 'Order placed successfully');
      setOrderId(response.data?.orderId || '');
      setOrderStatus('In Kitchen');
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

      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded border border-gray-300 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Place Order</h1>
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

        {message && <p className="mt-4 text-sm">{message}</p>}
        {orderId && (
          <div className="mt-2 space-y-1">
            <p className="text-xs break-all">Order ID: {orderId}</p>
            {orderStatus && (
              <p className="text-sm font-semibold">
                Status: <span className={orderStatus === 'Ready' ? 'text-green-600' : 'text-blue-600'}>{orderStatus}</span>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
