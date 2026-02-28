'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket, disconnectSocket } from '@/lib/socket';

export default function StatusPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);

  const hubUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3003';
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

    // Connect to Socket.io
    const socket = connectSocket(hubUrl, storedStudentId);

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Listen for order status updates
    socket.on('orderStatusUpdate', (data) => {
      console.log('📢 Order status update:', data);
      
      setOrders((prev) => {
        // Check if order already exists
        const existingIndex = prev.findIndex(o => o.orderId === data.orderId);
        
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
    });

    return () => {
      disconnectSocket();
    };
  }, [hubUrl, router]);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Order Status</h1>
            <p className="text-sm text-gray-600">Student ID: {studentId}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <button
              type="button"
              className="rounded bg-black text-white px-4 py-2 text-sm"
              onClick={() => router.push('/order')}
            >
              Place Order
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">No orders yet. Place an order to see live updates!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.orderId}
                className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-mono text-gray-500 mb-2">
                      {order.orderId}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          order.status === 'Ready'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'In Kitchen'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {order.timestamp ? new Date(order.timestamp).toLocaleTimeString() : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
