import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useExternalUsers } from '@/hooks/use-query-helpers';
import { Search, History, Wallet, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CreditTransaction {
  id: string;
  credits_change: number;
  transaction_type: string;
  amount_paid: number | null;
  created_at: string;
  reference_id: string | null;
}

interface WalletData {
  invoice_remaining: number;
  estimate_remaining: number;
  ai_estimate_remaining: number;
  invoice_unlimited: boolean;
  estimate_unlimited: boolean;
  ai_estimate_unlimited: boolean;
}

const UsersPage: React.FC = () => {
  const { data: profiles = [], isLoading } = useExternalUsers();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openCreditHistory = async (profile: any) => {
    setSelectedUser(profile);
    setLoadingHistory(true);
    
    const [txRes, walletRes] = await Promise.all([
      supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_credit_wallets')
        .select('*')
        .eq('user_id', profile.user_id)
        .maybeSingle(),
    ]);

    setTransactions((txRes.data as CreditTransaction[]) ?? []);
    setWallet(walletRes.data as WalletData | null);
    setLoadingHistory(false);
  };

  const filtered = profiles.filter((p: any) =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUsed = transactions
    .filter(t => t.credits_change < 0)
    .reduce((sum, t) => sum + Math.abs(t.credits_change), 0);

  const totalPurchased = transactions
    .filter(t => t.credits_change > 0)
    .reduce((sum, t) => sum + t.credits_change, 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">External Users</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage external platform users (customers)</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" maxLength={100} />
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Joined</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No external users found</td></tr>
              ) : filtered.map((p: any) => (
                <tr key={p.user_id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="p-4 text-sm text-foreground">{p.full_name || '—'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{p.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openCreditHistory(p)} title="Credit History">
                      <History className="h-4 w-4 mr-1" /> Credits
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Credit History — {selectedUser?.full_name || selectedUser?.email}
            </DialogTitle>
          </DialogHeader>

          {loadingHistory ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-6 mt-2">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-secondary p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Purchased</p>
                  <p className="text-2xl font-bold text-primary mt-1">{totalPurchased}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Used</p>
                  <p className="text-2xl font-bold text-destructive mt-1">{totalUsed}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Balance</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{totalPurchased - totalUsed}</p>
                </div>
              </div>

              {wallet && (
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Current Wallet</h4>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoices:</span>
                      <span className="text-foreground font-medium">{wallet.invoice_unlimited ? '∞' : wallet.invoice_remaining}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimates:</span>
                      <span className="text-foreground font-medium">{wallet.estimate_unlimited ? '∞' : wallet.estimate_remaining}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Est.:</span>
                      <span className="text-foreground font-medium">{wallet.ai_estimate_unlimited ? '∞' : wallet.ai_estimate_remaining}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Transaction History</h4>
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">No credit transactions yet</p>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {tx.transaction_type.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={tx.credits_change >= 0 ? 'text-primary font-medium' : 'text-destructive font-medium'}>
                                {tx.credits_change >= 0 ? '+' : ''}{tx.credits_change}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {tx.amount_paid ? `$${Number(tx.amount_paid).toFixed(2)}` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UsersPage;
