import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, XCircle, DollarSign } from 'lucide-react';

const PayoutsPage: React.FC = () => {
  const [payouts, setPayouts] = useState<any[]>([]);

  const fetchPayouts = async () => {
    const { data } = await supabase
      .from('payout_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setPayouts(data ?? []);
  };

  useEffect(() => { fetchPayouts(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('payout_requests').update({ status }).eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Payout ${status}`);
      fetchPayouts();
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning';
      case 'approved': return 'bg-info/10 text-info';
      case 'paid': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payout Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and process payout requests</p>
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Date</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No payout requests</td></tr>
              ) : payouts.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="p-4 text-sm text-muted-foreground font-mono">{p.id.slice(0, 8)}...</td>
                  <td className="p-4 text-sm text-foreground font-semibold">${Number(p.amount).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right space-x-2">
                    {p.status === 'pending' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, 'approved')} className="text-success hover:text-success">
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, 'rejected')} className="text-destructive hover:text-destructive">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, 'paid')} className="text-primary hover:text-primary">
                        <DollarSign className="h-4 w-4 mr-1" /> Mark Paid
                      </Button>
                    )}
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

export default PayoutsPage;
