import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import ManagerDashboard from '@/components/dashboards/ManagerDashboard';
import InfluencerDashboard from '@/components/dashboards/InfluencerDashboard';
import { Loader2 } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      {role === 'admin' && <AdminDashboard />}
      {role === 'manager' && <ManagerDashboard />}
      {role === 'influencer' && <InfluencerDashboard />}
      {!role && (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default DashboardPage;
