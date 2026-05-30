import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HazardReportForm from './pages/HazardReportForm';
import HazardReports from './pages/HazardReports';
import RiskRegister from './pages/RiskRegister';
import Incidents from './pages/Incidents';
import Documents from './pages/Documents';
import KPIs from './pages/KPIs';
import Meetings from './pages/Meetings';
import ERP from './pages/ERP';
import AuditLog from './pages/AuditLog';
import InternalAudit from './pages/InternalAudit';
import QRCodes from './pages/QRCodes';
import Users from './pages/Users';
import NotFound from './pages/NotFound';
import AccountabilityMatrix from './pages/AccountabilityMatrix';
import TrainingRecords from './pages/TrainingRecords';
import SafetyBulletins from './pages/SafetyBulletins';
import ChangeManagement from './pages/ChangeManagement';
import SMSOverview from './pages/SMSOverview';
import RecordsManagement from './pages/RecordsManagement';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/report" element={<HazardReportForm />} />

      {/* Protected routes */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="hazard-reports" element={<HazardReports />} />
        <Route path="risk-register" element={<RiskRegister />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="documents" element={<Documents />} />
        <Route path="kpis" element={<KPIs />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="erp" element={<ERP />} />
        <Route path="audit-log" element={<PrivateRoute roles={['admin', 's_ta']}><AuditLog /></PrivateRoute>} />
        <Route path="internal-audit" element={<InternalAudit />} />
        <Route path="qr-codes" element={<PrivateRoute roles={['admin', 's_ta']}><QRCodes /></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute roles={['admin']}><Users /></PrivateRoute>} />
        <Route path="safety-bulletins" element={<SafetyBulletins />} />
        <Route path="training" element={<TrainingRecords />} />
        <Route path="accountability" element={<PrivateRoute roles={['admin','s_ta']}><AccountabilityMatrix /></PrivateRoute>} />
        <Route path="change-requests" element={<ChangeManagement />} />
        <Route path="sms-overview" element={<SMSOverview />} />
        <Route path="records" element={<PrivateRoute roles={['admin']}><RecordsManagement /></PrivateRoute>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
