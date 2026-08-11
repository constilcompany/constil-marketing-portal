import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2 } from 'lucide-react';

interface CreditPackage {
  id: string;
  name: string;
  credit_amount: number;
  price: number;
  is_active: boolean;
  billing_type: string;
  billing_interval: string | null;
  template_tier: string;
  invoice_credits: number;
  estimate_credits: number;
  ai_estimate_credits: number;
  invoice_unlimited: boolean;
  estimate_unlimited: boolean;
  ai_estimate_unlimited: boolean;
  trial_enabled: boolean;
  trial_days: number | null;
  created_at: string;
}

const defaultForm = {
  name: '',
  credit_amount: 0,
  price: 29,
  billing_type: 'subscription' as string,
  billing_interval: 'monthly' as string | null,
  template_tier: 'basic',
  invoice_credits: 10,
  estimate_credits: 5,
  ai_estimate_credits: 2,
  invoice_unlimited: false,
  estimate_unlimited: false,
  ai_estimate_unlimited: false,
  trial_enabled: false,
  trial_days: 14,
  trial_invoice_credits: 3,
  trial_estimate_credits: 2,
  trial_ai_estimate_credits: 1,
};

const CreditPackagesPage: React.FC = () => {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const fetchPackages = async () => {
    const { data } = await supabase.from('credit_packages').select('*').order('price');
    setPackages((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPackages(); }, []);

  const resetForm = () => { setForm({ ...defaultForm }); setEditingId(null); };

  const openEdit = (pkg: CreditPackage) => {
    setForm({
      name: pkg.name,
      credit_amount: pkg.credit_amount,
      price: pkg.price,
      billing_type: pkg.billing_type,
      billing_interval: pkg.billing_interval || 'monthly',
      template_tier: pkg.template_tier,
      invoice_credits: pkg.invoice_credits,
      estimate_credits: pkg.estimate_credits,
      ai_estimate_credits: pkg.ai_estimate_credits,
      invoice_unlimited: pkg.invoice_unlimited,
      estimate_unlimited: pkg.estimate_unlimited,
      ai_estimate_unlimited: pkg.ai_estimate_unlimited,
      trial_enabled: pkg.trial_enabled ?? false,
      trial_days: pkg.trial_days ?? 14,
      trial_invoice_credits: (pkg as any).trial_invoice_credits ?? 3,
      trial_estimate_credits: (pkg as any).trial_estimate_credits ?? 2,
      trial_ai_estimate_credits: (pkg as any).trial_ai_estimate_credits ?? 1,
    });
    setEditingId(pkg.id);
    setDialogOpen(true);
  };

  const savePackage = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    const payload = {
      name: form.name,
      credit_amount: form.credit_amount,
      price: form.price,
      billing_type: 'subscription',
      billing_interval: form.billing_interval || 'monthly',
      template_tier: form.template_tier,
      invoice_credits: form.invoice_credits,
      estimate_credits: form.estimate_credits,
      ai_estimate_credits: form.ai_estimate_credits,
      invoice_unlimited: form.invoice_unlimited,
      estimate_unlimited: form.estimate_unlimited,
      ai_estimate_unlimited: form.ai_estimate_unlimited,
      trial_enabled: form.trial_enabled,
      trial_days: form.trial_enabled ? form.trial_days : null,
      trial_invoice_credits: form.trial_enabled ? form.trial_invoice_credits : 0,
      trial_estimate_credits: form.trial_enabled ? form.trial_estimate_credits : 0,
      trial_ai_estimate_credits: form.trial_enabled ? form.trial_ai_estimate_credits : 0,
    } as any;

    if (editingId) {
      const { error } = await supabase.from('credit_packages').update(payload).eq('id', editingId);
      if (error) toast.error(error.message);
      else { toast.success('Package updated!'); setDialogOpen(false); resetForm(); fetchPackages(); }
    } else {
      const { error } = await supabase.from('credit_packages').insert(payload);
      if (error) toast.error(error.message);
      else { toast.success('Package created!'); setDialogOpen(false); resetForm(); fetchPackages(); }
    }
  };

  const deletePackage = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('credit_packages').delete().eq('id', deleteId);
    if (error) toast.error(error.message);
    else { toast.success('Package deleted'); fetchPackages(); }
    setDeleteId(null);
  };

  const toggleActive = async (pkg: CreditPackage) => {
    const { error } = await supabase.from('credit_packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id);
    if (error) toast.error(error.message);
    else fetchPackages();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Credit Packages</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage subscription packages with segmented credits</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Package</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? 'Edit Package' : 'Create Package'}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Package Name</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Professional Plan" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Billing Interval</label>
                    <Select value={form.billing_interval || 'monthly'} onValueChange={v => setForm({ ...form, billing_interval: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price ($)</label>
                    <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template Tier</label>
                  <Select value={form.template_tier} onValueChange={v => setForm({ ...form, template_tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <h4 className="text-sm font-semibold text-foreground pt-2 border-t border-border">Trial Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.trial_enabled} onCheckedChange={v => setForm({ ...form, trial_enabled: v })} />
                    <label className="text-sm font-medium">Enable Trial</label>
                  </div>
                  {form.trial_enabled && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Trial Duration (days)</label>
                      <Input type="number" value={form.trial_days} onChange={e => setForm({ ...form, trial_days: parseInt(e.target.value) || 0 })} min={1} />
                    </div>
                  )}
                </div>
                {form.trial_enabled && (
                  <>
                    <h4 className="text-sm font-semibold text-foreground pt-2 border-t border-border">Trial Credit Limits</h4>
                    <p className="text-xs text-muted-foreground">Set restricted credit amounts for the trial period (separate from full package credits)</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Trial Invoice</label>
                        <Input type="number" value={form.trial_invoice_credits} onChange={e => setForm({ ...form, trial_invoice_credits: parseInt(e.target.value) || 0 })} min={0} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Trial Estimate</label>
                        <Input type="number" value={form.trial_estimate_credits} onChange={e => setForm({ ...form, trial_estimate_credits: parseInt(e.target.value) || 0 })} min={0} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Trial AI Est.</label>
                        <Input type="number" value={form.trial_ai_estimate_credits} onChange={e => setForm({ ...form, trial_ai_estimate_credits: parseInt(e.target.value) || 0 })} min={0} />
                      </div>
                    </div>
                  </>
                )}

                <h4 className="text-sm font-semibold text-foreground pt-2 border-t border-border">Segmented Credit Buckets</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Invoice Credits</label>
                    <Input type="number" value={form.invoice_credits} onChange={e => setForm({ ...form, invoice_credits: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={form.invoice_unlimited} onCheckedChange={v => setForm({ ...form, invoice_unlimited: v })} />
                    <label className="text-xs text-muted-foreground">Unlimited</label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estimate Credits</label>
                    <Input type="number" value={form.estimate_credits} onChange={e => setForm({ ...form, estimate_credits: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={form.estimate_unlimited} onCheckedChange={v => setForm({ ...form, estimate_unlimited: v })} />
                    <label className="text-xs text-muted-foreground">Unlimited</label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">AI Estimate Credits</label>
                    <Input type="number" value={form.ai_estimate_credits} onChange={e => setForm({ ...form, ai_estimate_credits: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={form.ai_estimate_unlimited} onCheckedChange={v => setForm({ ...form, ai_estimate_unlimited: v })} />
                    <label className="text-xs text-muted-foreground">Unlimited</label>
                  </div>
                </div>

                <Button onClick={savePackage} className="w-full">{editingId ? 'Update Package' : 'Create Package'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Estimate</TableHead>
                <TableHead>AI Est.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map(pkg => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {pkg.billing_interval || 'monthly'}
                    </Badge>
                  </TableCell>
                  <TableCell>${Number(pkg.price).toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{pkg.template_tier}</TableCell>
                  <TableCell>
                    {pkg.trial_enabled ? (
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">{pkg.trial_days}d</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>{pkg.invoice_unlimited ? '∞' : pkg.invoice_credits}</TableCell>
                  <TableCell>{pkg.estimate_unlimited ? '∞' : pkg.estimate_credits}</TableCell>
                  <TableCell>{pkg.ai_estimate_unlimited ? '∞' : pkg.ai_estimate_credits}</TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(pkg)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(pkg)} title="Toggle active">
                        {pkg.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(pkg.id)} title="Delete" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {packages.length === 0 && !loading && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No packages yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this package. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deletePackage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default CreditPackagesPage;
