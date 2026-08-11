import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const LedgerPage: React.FC = () => {
  const { user } = useAuth();
  const [commissions, setCommissions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('commissions')
      .select('*, sales(id, total_amount, created_at)')
      .eq('influencer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCommissions(data ?? []));
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Detailed commission history</p>
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Sale ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Commission</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Unlock Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No commissions yet</td></tr>
              ) : commissions.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="p-4 text-sm text-muted-foreground font-mono">{c.sale_id?.slice(0, 8)}...</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-sm text-foreground font-semibold">${Number(c.influencer_amount).toLocaleString()}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(c.unlock_date).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'unlocked' ? 'bg-success/10 text-success' :
                      c.status === 'paid' ? 'bg-info/10 text-info' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LedgerPage;
