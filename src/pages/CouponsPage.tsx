import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupons } from '@/hooks/use-query-helpers';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Copy, Loader2 } from 'lucide-react';
import { getSafeErrorMessage, sanitizeInput } from '@/lib/security';

const CouponsPage: React.FC = () => {
  const { role, user } = useAuth();
  const { data: coupons = [], isLoading: loadingCoupons, refetch: refetchCoupons } = useCoupons(role, user?.id);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<any>(null);
  const [editForm, setEditForm] = useState({ discount: '', usageLimit: '', expiryDays: '', isActive: true });
  const [form, setForm] = useState({ code: '', discount: '10', usageLimit: '100', expiryDays: '30', influencerId: '' });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isInfluencer = role === 'influencer';

  // Fetch influencers with React Query
  const { data: influencers = [] } = useQuery({
    queryKey: ['coupon-influencers', role, user?.id],
    queryFn: async () => {
      if (isAdmin) {
        const { data: roleData } = await supabase.from('user_roles').select('user_id').eq('role', 'influencer');
        if (!roleData?.length) return [];
        const ids = roleData.map(r => r.user_id);
        const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
        return data ?? [];
      } else if (isManager && user) {
        const { data: teamData } = await supabase.from('manager_influencers').select('influencer_id').eq('manager_id', user.id);
        if (!teamData?.length) return [];
        const ids = teamData.map(t => t.influencer_id);
        const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
        return data ?? [];
      }
      return [];
    },
    enabled: isAdmin || isManager,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const createCoupon = async () => {
    const code = sanitizeInput(form.code, 50).toUpperCase();
    if (!code || !form.influencerId) {
      toast.error('Code and influencer are required');
      return;
    }
    setCreating(true);
    try {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + parseInt(form.expiryDays));

      const { error } = await supabase.from('coupons').insert({
        code,
        discount_percent: Math.min(100, Math.max(0, parseFloat(form.discount) || 10)),
        usage_limit: Math.max(1, parseInt(form.usageLimit) || 100),
        expiry_date: expiry.toISOString(),
        influencer_id: form.influencerId,
        manager_id: null,
      });

      if (error) toast.error(getSafeErrorMessage(error));
      else {
        toast.success('Coupon created!');
        setOpen(false);
        setForm({ code: '', discount: '10', usageLimit: '100', expiryDays: '30', influencerId: '' });
        refetchCoupons();
      }
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (c: any) => {
    setEditCoupon(c);
    setEditForm({
      discount: String(c.discount_percent),
      usageLimit: String(c.usage_limit ?? ''),
      expiryDays: '30',
      isActive: c.is_active,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editCoupon) return;
    setSaving(true);
    try {
      const updates: any = {
        discount_percent: Math.min(100, Math.max(0, parseFloat(editForm.discount) || 10)),
        usage_limit: parseInt(editForm.usageLimit) || null,
        is_active: editForm.isActive,
      };
      if (editForm.expiryDays) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + parseInt(editForm.expiryDays));
        updates.expiry_date = expiry.toISOString();
      }
      const { error } = await supabase.from('coupons').update(updates).eq('id', editCoupon.id);
      if (error) toast.error(getSafeErrorMessage(error));
      else { toast.success('Coupon updated!'); setEditOpen(false); refetchCoupons(); }
    } finally {
      setSaving(false);
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Coupon code copied!');
  };

  const influencerMap = Object.fromEntries(influencers.map((i: any) => [i.user_id, i.full_name || i.email]));
  const filtered = coupons.filter((c: any) => c.code.toLowerCase().includes(search.toLowerCase()));
  const canEdit = isAdmin || isManager;

  if (loadingCoupons) {
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
            <h1 className="text-2xl font-bold text-foreground">
              {isInfluencer ? 'My Coupons' : 'Coupon Management'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isInfluencer ? 'View and share your coupon codes'
                : isManager ? 'Manage your influencer team coupons'
                : 'Create and manage discount coupons'}
            </p>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Create Coupon</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">New Coupon</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Coupon Code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="bg-secondary border-border font-mono" maxLength={50} />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Assign to Influencer *</label>
                    <Select value={form.influencerId} onValueChange={v => setForm({ ...form, influencerId: v })}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Select influencer" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {influencers.map((i: any) => (
                          <SelectItem key={i.user_id} value={i.user_id}>{i.full_name || i.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="Discount %" type="number" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} className="bg-secondary border-border" min={0} max={100} />
                  <Input placeholder="Usage Limit" type="number" value={form.usageLimit} onChange={e => setForm({ ...form, usageLimit: e.target.value })} className="bg-secondary border-border" min={1} />
                  <Input placeholder="Expiry (days)" type="number" value={form.expiryDays} onChange={e => setForm({ ...form, expiryDays: e.target.value })} className="bg-secondary border-border" min={1} />
                  <Button onClick={createCoupon} disabled={creating || !form.influencerId} className="w-full">Create Coupon</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {canEdit && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Edit Coupon: {editCoupon?.code}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {editCoupon?.auto_generated && (
                  <p className="text-xs text-accent bg-accent/10 rounded-lg px-3 py-2">
                    Auto-generated coupon — ownership cannot be changed
                  </p>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Discount %</label>
                  <Input type="number" value={editForm.discount} onChange={e => setEditForm({ ...editForm, discount: e.target.value })} className="bg-secondary border-border" min={0} max={100} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Usage Limit</label>
                  <Input type="number" value={editForm.usageLimit} onChange={e => setEditForm({ ...editForm, usageLimit: e.target.value })} className="bg-secondary border-border" min={1} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Extend Expiry (days from now)</label>
                  <Input type="number" value={editForm.expiryDays} onChange={e => setEditForm({ ...editForm, expiryDays: e.target.value })} className="bg-secondary border-border" min={1} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Active</label>
                  <button
                    onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                    className={`w-10 h-5 rounded-full transition-colors ${editForm.isActive ? 'bg-success' : 'bg-muted'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-foreground transition-transform ${editForm.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <Button onClick={saveEdit} disabled={saving} className="w-full">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search coupons..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" maxLength={100} />
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {!isInfluencer && <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Influencer</th>}
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Code</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Discount</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Usage</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Expiry</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isInfluencer ? 7 : 8} className="text-center py-8 text-muted-foreground">No coupons found</td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  {!isInfluencer && (
                    <td className="p-4 text-sm text-muted-foreground">
                      {c.influencer_id ? (influencerMap[c.influencer_id] || c.influencer_id.slice(0, 8) + '...') : '—'}
                    </td>
                  )}
                  <td className="p-4 text-sm font-mono text-foreground font-semibold">{c.code}</td>
                  <td className="p-4 text-sm text-muted-foreground">{c.discount_percent}%</td>
                  <td className="p-4 text-sm text-muted-foreground">{c.usage_count}/{c.usage_limit ?? '∞'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'Never'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.auto_generated ? 'bg-info/10 text-info' : 'bg-accent/10 text-accent'}`}>
                      {c.auto_generated ? 'Auto' : 'Manual'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2">
                    {isInfluencer && (
                      <Button variant="ghost" size="sm" onClick={() => copyCouponCode(c.code)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
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

export default CouponsPage;
