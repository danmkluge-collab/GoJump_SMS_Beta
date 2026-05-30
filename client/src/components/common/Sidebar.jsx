import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HomeIcon, ExclamationTriangleIcon, ShieldCheckIcon,
  DocumentTextIcon, ClipboardDocumentListIcon, ChartBarIcon,
  UserGroupIcon, BellIcon, QrCodeIcon, ClipboardDocumentCheckIcon,
  BookOpenIcon, PhoneIcon, ArrowRightOnRectangleIcon, UsersIcon,
  AcademicCapIcon, MegaphoneIcon, TableCellsIcon,
  ArrowPathIcon, InformationCircleIcon, ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

const NAV = [
  // ── Core ───────────────────────────────────────────────────────────────────
  { label: 'Dashboard',            path: '/dashboard',          icon: HomeIcon,                    roles: ['employee','staff','s_ta','admin'] },
  // ── Safety Risk Management ────────────────────────────────────────────────
  { label: 'Hazard Reports',       path: '/hazard-reports',     icon: ExclamationTriangleIcon,      roles: ['staff','s_ta','admin'] },
  { label: 'Risk Register',        path: '/risk-register',      icon: ShieldCheckIcon,             roles: ['staff','s_ta','admin'] },
  { label: 'Incidents',            path: '/incidents',          icon: ClipboardDocumentListIcon,    roles: ['staff','s_ta','admin'] },
  // ── Safety Assurance ─────────────────────────────────────────────────────
  { label: 'Internal Audits',      path: '/internal-audit',     icon: ClipboardDocumentCheckIcon,  roles: ['staff','s_ta','admin'] },
  { label: 'KPIs',                 path: '/kpis',               icon: ChartBarIcon,                roles: ['staff','s_ta','admin'] },
  // ── Safety Promotion ─────────────────────────────────────────────────────
  { label: 'Safety Bulletins',     path: '/safety-bulletins',   icon: MegaphoneIcon,               roles: ['staff','s_ta','admin'] },
  { label: 'Training Records',     path: '/training',           icon: AcademicCapIcon,             roles: ['staff','s_ta','admin'] },
  { label: 'Accountability Matrix',path: '/accountability',     icon: TableCellsIcon,              roles: ['s_ta','admin'] },
  // ── Operations & Change ───────────────────────────────────────────────────
  { label: 'Change Requests',      path: '/change-requests',    icon: ArrowPathIcon,               roles: ['staff','s_ta','admin'] },
  { label: 'Documents',            path: '/documents',          icon: DocumentTextIcon,            roles: ['staff','s_ta','admin'] },
  { label: 'Meetings',             path: '/meetings',           icon: UserGroupIcon,               roles: ['staff','s_ta','admin'] },
  { label: 'ERP',                  path: '/erp',                icon: PhoneIcon,                   roles: ['staff','s_ta','admin'] },
  { label: 'SMS Overview',         path: '/sms-overview',       icon: InformationCircleIcon,       roles: ['staff','s_ta','admin'] },
  // ── Admin ─────────────────────────────────────────────────────────────────
  { label: 'Audit Log',            path: '/audit-log',          icon: BookOpenIcon,                roles: ['s_ta','admin'] },
  { label: 'QR Codes',             path: '/qr-codes',           icon: QrCodeIcon,                  roles: ['s_ta','admin'] },
  { label: 'Records Mgmt',         path: '/records',            icon: ArchiveBoxIcon,              roles: ['admin'] },
  { label: 'Users',                path: '/users',              icon: UsersIcon,                   roles: ['admin'] },
];

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-700 text-white'
            : 'text-blue-100 hover:bg-blue-700/60 hover:text-white'
        }`
      }
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {item.label}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visible = NAV.filter((n) => n.roles.includes(user?.role));

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-blue-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-blue-800">
        <div className="bg-white rounded-lg p-1.5">
          <ShieldCheckIcon className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <div className="font-bold text-sm leading-tight">GoJump America</div>
          <div className="text-xs text-blue-300">Safety Management System</div>
        </div>
      </div>

      {/* Location badge */}
      {user?.location && (
        <div className="px-4 py-2 bg-blue-800/50">
          <div className="text-xs text-blue-300">Location</div>
          <div className="text-sm font-medium truncate">{user.location.name}</div>
        </div>
      )}
      {user?.role === 'admin' && !user?.location && (
        <div className="px-4 py-2 bg-blue-800/50">
          <div className="text-xs text-blue-300">Access</div>
          <div className="text-sm font-medium">All Locations</div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map((item) => (
          <NavItem key={item.path} item={item} onClick={onClose} />
        ))}
      </nav>

      {/* User / Logout */}
      <div className="px-4 py-4 border-t border-blue-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-blue-300 capitalize">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-blue-300 hover:text-white transition-colors w-full">
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-64">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600/75" onClick={onClose} />
          <div className="relative flex flex-col w-64 h-full">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
