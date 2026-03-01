'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import Header from '@/components/Header';

export default function StatusPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const ordersRef = useRef(orders);

  // Keep ref in sync so the persist effect can read latest value
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Persist orders to localStorage whenever they change
  useEffect(() => {
    if (orders.length > 0) {
      try {
        window.localStorage.setItem('cafeteria_orders', JSON.stringify(orders));
      } catch { /* ignore */ }
    }
  }, [orders]);

  const hubUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3003';
  }, []);

  // Named handler for socket cleanup
  const handleStatusUpdate = useCallback((data) => {
    console.log('📢 Order status update:', data);

    setOrders((prev) => {
      // Check if order already exists
      const existingIndex = prev.findIndex((o) => o.orderId === data.orderId);

      if (existingIndex >= 0) {
        // Update existing order
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...data };
        return updated;
      } else {
        // Add new order
        return [data, ...prev];
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedStudentId = window.localStorage.getItem('cafeteria_student_id') || '';

    if (!storedStudentId) {
      router.push('/login');
      return;
    }

    setStudentId(storedStudentId);

    // Load persisted orders from localStorage
    try {
      const stored = JSON.parse(window.localStorage.getItem('cafeteria_orders') || '[]');
      if (stored.length > 0) {
        setOrders(stored);
      }
    } catch { /* ignore */ }

    // Connect to Socket.io
    const socket = connectSocket(hubUrl, storedStudentId);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('orderStatusUpdate', handleStatusUpdate);

    // Set initial connected state
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('orderStatusUpdate', handleStatusUpdate);
    };
  }, [hubUrl, router, handleStatusUpdate]);

  const getStatusIcon = (status) => {
    if (!status) return '📦';
    if (status === 'Ready') return '✅';
    if (status === 'In Kitchen') return '👨‍🍳';
    if (status === 'Pending') return '⏳';
    return '📦';
  };

  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (status === 'Ready') return 'bg-green-100 text-green-800 border-green-300';
    if (status === 'In Kitchen') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (status === 'Pending') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all order history?')) {
      setOrders([]);
      window.localStorage.setItem('cafeteria_orders', JSON.stringify([]));
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
        <div className="max-w-5xl mx-auto pt-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">📦 Order Status</h1>
                <p className="text-gray-600">
                  Track your orders in real-time
                  {studentId && <span className="ml-2">• Student ID: <span className="font-mono font-semibold">{studentId}</span></span>}
                </p>
              </div>
            </div>

            {/* Connection Status Card */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
              connected 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`font-medium ${connected ? 'text-green-800' : 'text-red-800'}`}>
                  {connected ? '🟢 Connected to real-time updates' : '🔴 Disconnected from server'}
                </span>
              </div>
              {orders.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>

          {/* Orders Grid */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
              <div className="mb-4">
                <span className="text-6xl">🍱</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
              <p className="text-gray-600 mb-6">Place an order to see live updates here!</p>
              <button
                onClick={() => router.push('/order')}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all transform hover:scale-105"
              >
                <span className="mr-2">🛒</span>
                Place Your First Order
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.orderId}
                  className="bg-white rounded-xl shadow-md border-2 border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getStatusIcon(order.status)}</span>
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Order ID</p>
                            <p className="text-sm font-mono font-bold text-gray-900">{order.orderId}</p>
                          </div>
                        </div>
                        
                        {order.itemName && (
                          <p className="text-gray-700 text-sm mb-2">
                            <span className="font-medium">Item:</span> {order.itemName}
                            {order.quantity && <span className="ml-2">× {order.quantity}</span>}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <span
                          className={`inline-block px-4 py-2 rounded-full text-sm font-bold border-2 ${getStatusColor(order.status)}`}
                        >
                          {order.status || 'Unknown'}
                        </span>
                        {order.timestamp && (
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(order.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Timeline */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs">
                        <div className={`flex items-center gap-2 ${order.status ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-3 h-3 rounded-full ${order.status ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          <span className="font-medium">Placed</span>
                        </div>
                        <div className={`flex-1 h-0.5 mx-2 ${order.status === 'In Kitchen' || order.status === 'Ready' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex items-center gap-2 ${order.status === 'In Kitchen' || order.status === 'Ready' ? 'text-blue-600' : 'text-gray-400'}`}>
                          <div className={`w-3 h-3 rounded-full ${order.status === 'In Kitchen' || order.status === 'Ready' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                          <span className="font-medium">In Kitchen</span>
                        </div>
                        <div className={`flex-1 h-0.5 mx-2 ${order.status === 'Ready' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex items-center gap-2 ${order.status === 'Ready' ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-3 h-3 rounded-full ${order.status === 'Ready' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                          <span className="font-medium">Ready</span>
                        </div>
                      </div>
                    </div>

                    {/* Ready pickup message */}
                    {order.status === 'Ready' && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium text-center">
                          ✨ Your order is ready for pickup! Please collect from the cafeteria counter.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
