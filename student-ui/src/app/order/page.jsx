'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { connectSocket } from '@/lib/socket';
import Header from '@/components/Header';
import LoadingSpinner from '@/components/LoadingSpinner';

const MENU_ITEMS = [
  { id: 'iftar-box-01', name: '🍱 Iftar Box', price: '150 BDT', description: 'Traditional iftar meal' },
  { id: 'dinner-special', name: '🍛 Dinner Special', price: '120 BDT', description: 'Daily special dinner' }
];

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
  const [retryIdempotencyKey, setRetryIdempotencyKey] = useState('');

  const gatewayUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';
  }, []);

  const hubUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3003';
  }, []);

  const selectedItem = MENU_ITEMS.find(item => item.id === itemId) || MENU_ITEMS[0];

  const createIdempotencyKey = () => {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  // Named handler for socket cleanup
  const handleStatusUpdate = useCallback((data) => {
    console.log('📢 Order status update received:', data);
    setOrderStatus(data.status);
    setMessage(`✅ Order ${data.orderId} is ${data.status}!`);

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

    if (!storedToken) {
      router.push('/login');
      return;
    }

    // Connect to Socket.io if we have a studentId
    if (storedStudentId) {
      const socket = connectSocket(hubUrl, storedStudentId);

      // Listen for order status updates (named handler)
      socket.on('orderStatusUpdate', handleStatusUpdate);

      return () => {
        socket.off('orderStatusUpdate', handleStatusUpdate);
      };
    }
  }, [hubUrl, handleStatusUpdate, router]);

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!token) {
      setMessage('⚠️ Please login first.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setOrderId('');
    setOrderStatus('Pending');
    setLatency(null);
    const idempotencyKey = retryIdempotencyKey || createIdempotencyKey();

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
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      const elapsed = Date.now() - startTime;
      setLatency(elapsed);

      setStatus('success');
      setMessage(`✅ ${response.data?.message || 'Order placed successfully'}`);
      const newOrderId = response.data?.orderId || '';
      setOrderId(newOrderId);
      setOrderStatus('Stock Verified');
      setRetryIdempotencyKey('');

      // Persist new order to localStorage
      if (newOrderId) {
        try {
          const stored = JSON.parse(window.localStorage.getItem('cafeteria_orders') || '[]');
          stored.unshift({
            orderId: newOrderId,
            itemId,
            itemName: selectedItem.name,
            quantity: Number(quantity),
            status: 'Stock Verified',
            timestamp: new Date().toISOString(),
          });
          window.localStorage.setItem('cafeteria_orders', JSON.stringify(stored));
        } catch { /* ignore */ }
      }

      window.setTimeout(() => {
        setOrderStatus('In Kitchen');

        if (!newOrderId) {
          return;
        }

        try {
          const stored = JSON.parse(window.localStorage.getItem('cafeteria_orders') || '[]');
          const idx = stored.findIndex((o) => o.orderId === newOrderId);
          if (idx >= 0) {
            stored[idx] = { ...stored[idx], status: 'In Kitchen' };
            window.localStorage.setItem('cafeteria_orders', JSON.stringify(stored));
          }
        } catch { /* ignore */ }
      }, 500);
    } catch (error) {
      const statusCode = error?.response?.status;

      if (statusCode === 400) {
        setMessage(`❌ ${error?.response?.data?.error || 'Out of Stock'}`);
      } else if (statusCode === 401) {
        setMessage('🔒 Session invalid. Please login again.');
      } else if (statusCode === 409) {
        setMessage('⚠️ Conflict during deduction. Please retry.');
      } else {
        setMessage('❌ Order failed. Please try again.');
      }

      const elapsed = Date.now() - startTime;
      setLatency(elapsed);

      setStatus('error');
      setOrderStatus('');
      setRetryIdempotencyKey(idempotencyKey);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
        <div className="max-w-2xl mx-auto pt-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-white">
              <h1 className="text-3xl font-bold mb-2">🍽️ Place Your Order</h1>
              <p className="text-indigo-100">Select your items and place an order</p>
            </div>

            {/* Form Section */}
            <div className="p-8">
              <form className="space-y-6" onSubmit={submitOrder}>
                {/* Item Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3" htmlFor="itemId">
                    Select Item
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {MENU_ITEMS.map((item) => (
                      <label
                        key={item.id}
                        className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          itemId === item.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="itemId"
                          value={item.id}
                          checked={itemId === item.id}
                          onChange={(e) => setItemId(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold text-gray-900">{item.name}</span>
                            <span className="text-sm font-bold text-indigo-600">{item.price}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        </div>
                        {itemId === item.id && (
                          <div className="ml-3 flex-shrink-0">
                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="quantity">
                    Quantity
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 flex items-center justify-center font-bold text-gray-700 transition-colors"
                      disabled={quantity <= 1}
                    >
                      −
                    </button>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      max="10"
                      className="w-20 text-center border-2 border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Math.min(10, Number(event.target.value))))}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(10, quantity + 1))}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 flex items-center justify-center font-bold text-gray-700 transition-colors"
                      disabled={quantity >= 10}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-4 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
                  disabled={status === 'loading' || !token}
                >
                  {status === 'loading' ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span className="ml-2">Placing order...</span>
                    </>
                  ) : (
                    <>
                      <span>🛒 Place Order</span>
                    </>
                  )}
                </button>
              </form>

              {/* Response Time Warning */}
              {latency !== null && latency > 1000 && (
                <div className="mt-6 flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-amber-900">High Latency Detected</p>
                    <p className="text-sm text-amber-800">
                      Gateway responded in {latency}ms (&gt;1s) — possible congestion
                    </p>
                  </div>
                </div>
              )}

              {/* Success Response Time */}
              {latency !== null && latency <= 1000 && status === 'success' && (
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>⚡ Response time: {latency}ms</span>
                </div>
              )}

              {/* Message */}
              {message && (
                <div
                  className={`mt-6 p-4 rounded-lg text-sm font-medium ${
                    status === 'success'
                      ? 'bg-green-50 text-green-800 border-2 border-green-200'
                      : 'bg-red-50 text-red-800 border-2 border-red-200'
                  }`}
                >
                  {message}
                </div>
              )}

              {/* Order Details */}
              {orderId && (
                <div className="mt-6 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Order ID</p>
                      <p className="text-sm font-mono font-bold text-gray-900">{orderId}</p>
                    </div>
                    {orderStatus && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          orderStatus === 'Ready'
                            ? 'bg-green-500 text-white'
                            : orderStatus === 'Stock Verified'
                            ? 'bg-purple-500 text-white'
                            : orderStatus === 'Pending'
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {orderStatus}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => router.push('/status')}
                    className="mt-3 w-full text-center bg-white hover:bg-gray-50 text-indigo-600 font-medium py-2 px-4 rounded-lg border border-indigo-200 transition-colors"
                  >
                    📦 Track Order Status
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
