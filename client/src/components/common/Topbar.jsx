import React, { useState, useEffect } from 'react';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications').then((r) => setNotifications(r.data)).catch(() => {});
    const interval = setInterval(() => {
      api.get('/notifications').then((r) => setNotifications(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const unread = notifications.filter((n) => !n.read).length;

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setShowDropdown(false);
  };

  const typeColors = { danger: 'bg-red-50 border-red-200', warning: 'bg-yellow-50 border-yellow-200', info: 'bg-blue-50 border-blue-200' };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between flex-shrink-0">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600">
        <Bars3Icon className="h-6 w-6" />
      </button>

      <div className="hidden lg:block">
        <h1 className="text-lg font-semibold text-gray-900">
          GoJump America — Safety Management System
        </h1>
        <p className="text-xs text-gray-500">FAA 14 CFR Part 5 Compliant</p>
      </div>

      <div className="flex items-center gap-4 relative">
        {/* Notifications */}
        <button
          onClick={() => setShowDropdown((v) => !v)}
          className="relative p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <BellIcon className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Mark all read</button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications</div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="text-sm text-gray-800">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <span className="hidden sm:block font-medium">{user?.name}</span>
        </div>
      </div>
    </header>
  );
}
