import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Finance from './pages/Finance';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import Products from './pages/Products';
import SupplierOrders from './pages/SupplierOrders';
import Suppliers from './pages/Suppliers';
import Platforms from './pages/Platforms';
import Settings from './pages/Settings';
import TodoPage from './pages/Todo';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin mx-auto mb-3" />
        <p className="text-txt-muted text-sm">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RequireFinance({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'employee') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/finance" element={<RequireAuth><RequireFinance><Finance /></RequireFinance></RequireAuth>} />
      <Route path="/sales" element={<RequireAuth><Sales /></RequireAuth>} />
      <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
      <Route path="/products" element={<RequireAuth><Products /></RequireAuth>} />
      <Route path="/orders" element={<RequireAuth><SupplierOrders /></RequireAuth>} />
      <Route path="/suppliers" element={<RequireAuth><Suppliers /></RequireAuth>} />
      <Route path="/platforms" element={<RequireAuth><Platforms /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/todo" element={<RequireAuth><TodoPage /></RequireAuth>} />
      <Route path="/todo/:id" element={<RequireAuth><TodoPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
