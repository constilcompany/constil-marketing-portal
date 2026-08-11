import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';

const InfluencersPage: React.FC = () => {
  const { user } = useAuth();
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchInfluencers = async () => {
    if (!user) return;
    const { data: teamData } = await supabase
      .from('manager_influencers')
      .select('influencer_id')
      .eq('manager_id', user.id);
    if (!teamData?.length) { setInfluencers([]); return; }
    const ids = teamData.map(t => t.influencer_id);
    const { data } = await supabase.from('profiles').select('*').in('user_id', ids);
    setInfluencers(data ?? []);
  };

  useEffect(() => { fetchInfluencers(); }, [user]);

  const createInfluencer = async () => {
    if (!newEmail || !newPassword || !newName) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: newEmail, password: newPassword, full_name: newName, role: 'influencer' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Influencer created and added to your team!');
      setOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      fetchInfluencers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create influencer');
    } finally {
      setCreating(false);
    }
  };

  const filtered = influencers.filter(i =>
    i.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Influencer Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your team of influencers</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Influencer</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create Influencer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Full Name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-secondary border-border" />
                <Button onClick={createInfluencer} disabled={creating} className="w-full">Create Influencer</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search influencers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No influencers in your team</td></tr>
              ) : filtered.map(i => (
                <tr key={i.user_id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="p-4 text-sm text-foreground">{i.full_name || '—'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{i.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InfluencersPage;
