import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useManagersList } from '@/hooks/use-query-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { getSafeErrorMessage, sanitizeInput, isValidEmail } from '@/lib/security';

const ManagersPage: React.FC = () => {
  const { role } = useAuth();
  const { data: managers = [], isLoading, refetch } = useManagersList();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const createManager = async () => {
    const name = sanitizeInput(newName, 100);
    const email = newEmail.trim().toLowerCase();
    
    if (!name || !email || !newPassword) {
      toast.error('All fields are required');
      return;
    }
    if (!isValidEmail(email)) {
      toast.error('Invalid email format');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email, password: newPassword, full_name: name, role: 'manager' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Manager created successfully!');
      setOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      refetch();
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const filtered = managers.filter((m: any) =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (role !== 'admin') return null;

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manager Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage your managers</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Manager</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create Manager</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Full Name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-secondary border-border" maxLength={100} />
                <Input placeholder="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="bg-secondary border-border" maxLength={255} />
                <Input placeholder="Password (min 8 chars)" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-secondary border-border" minLength={8} />
                <Button onClick={createManager} disabled={creating} className="w-full">Create Manager</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search managers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" maxLength={100} />
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
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No managers found</td></tr>
              ) : filtered.map((m: any) => (
                <tr key={m.user_id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="p-4 text-sm text-foreground">{m.full_name || '—'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{m.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

export default ManagersPage;
