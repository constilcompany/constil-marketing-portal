import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/StatCard';
import { CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react';

const PaymentLogsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, succeeded: 0, failed: 0, pending: 0 });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('payment_transactions')
        .select('*, credit_packages(name)')
        .order('created_at', { ascending: false });

      const txns = (data as any[]) ?? [];
      setTransactions(txns);
      setStats({
        total: txns.length,
        succeeded: txns.filter(t => t.status === 'succeeded').length,
        failed: txns.filter(t => t.status === 'failed').length,
        pending: txns.filter(t => t.status === 'pending').length,
      });
    };
    fetch();
  }, []);

  const statusColor = (s: string) => {
    if (s === 'succeeded') return 'bg-success/10 text-success';
    if (s === 'failed') return 'bg-destructive/10 text-destructive';
    return 'bg-warning/10 text-warning';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">All payment transactions (mock &amp; live)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Payments" value={stats.total} icon={CreditCard} />
          <StatCard title="Succeeded" value={stats.succeeded} icon={CheckCircle} iconColor="text-success" />
          <StatCard title="Failed" value={stats.failed} icon={XCircle} iconColor="text-destructive" />
          <StatCard title="Pending" value={stats.pending} icon={Clock} iconColor="text-warning" />
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{t.credit_packages?.name || '—'}</TableCell>
                  <TableCell className="font-semibold">${Number(t.amount).toFixed(2)}</TableCell>
                  <TableCell className="capitalize text-sm">{t.billing_type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{t.payment_mode}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}>
                      {t.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">{t.stripe_payment_intent_id}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payment transactions yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PaymentLogsPage;
