import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({ moderator = false }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="page-state">Checking your session…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (moderator && user.role !== 'moderator') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
