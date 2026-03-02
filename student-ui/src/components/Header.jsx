'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = window.localStorage.getItem('cafeteria_student_id') || '';
      setStudentId(id);
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('cafeteria_token');
      window.localStorage.removeItem('cafeteria_student_id');
      window.localStorage.removeItem('cafeteria_orders');
    }
    router.push('/login');
  };

  const navItems = [
    { label: 'Order', path: '/order', icon: '🍽️' },
    { label: 'Status', path: '/status', icon: '📦' },
  ];

  // Don't show shared student header on login/admin pages
  if (pathname === '/login' || pathname === '/admin') return null;

  return (
    <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold">🎓 IUT Cafeteria</h1>
            </div>
            <nav className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.path
                      ? 'bg-white bg-opacity-20'
                      : 'hover:bg-white hover:bg-opacity-10'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            {studentId && (
              <div className="hidden sm:block text-sm">
                <span className="opacity-75">Student:</span>
                <span className="ml-2 font-mono font-semibold">{studentId}</span>
              </div>
            )}
            {studentId && (
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-md text-sm font-medium transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Mobile navigation */}
      <div className="md:hidden border-t border-white border-opacity-10">
        <div className="px-2 pt-2 pb-3 space-x-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`inline-block px-3 py-2 rounded-md text-sm font-medium ${
                pathname === item.path
                  ? 'bg-white bg-opacity-20'
                  : 'hover:bg-white hover:bg-opacity-10'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
