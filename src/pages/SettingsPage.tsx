import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    id: '',
    influencer_commission_percent: 10,
    manager_commission_percent: 10,
    lock_period_days: 30,
    minimum_payout_threshold: 50,
    payment_mode: 'stripe_live',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('global_settings').select('*').single().then(({ data }) => {
      if (data) setSettings(s => ({ ...s, ...data }));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('global_settings').update({
      influencer_commission_percent: settings.influencer_commission_percent,
      manager_commission_percent: settings.manager_commission_percent,
      lock_period_days: settings.lock_period_days,
      minimum_payout_threshold: settings.minimum_payout_threshold,
      payment_mode: 'stripe_live',
    } as any).eq('id', settings.id);
    if (error) toast.error(error.message);
    else toast.success('Settings saved!');
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Global Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure commission rules and payment system</p>
        </div>

        <div className="stat-card rounded-xl border border-border p-6 space-y-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Commission Settings</h3>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Influencer Commission (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={settings.influencer_commission_percent}
              onChange={e => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 100) {
                  setSettings({ ...settings, influencer_commission_percent: val });
                }
              }}
              className="bg-secondary border-border"
            />
            <p className="text-xs text-muted-foreground">Percentage of the final paid amount (after discount) that goes to the influencer</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Manager Commission (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={settings.manager_commission_percent}
              onChange={e => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 100) {
                  setSettings({ ...settings, manager_commission_percent: val });
                }
              }}
              className="bg-secondary border-border"
            />
            <p className="text-xs text-muted-foreground">Percentage of final paid amount that goes to the manager (calculated independently)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Lock Period (days)</label>
            <Input type="number" value={settings.lock_period_days} onChange={e => setSettings({ ...settings, lock_period_days: parseInt(e.target.value) })} className="bg-secondary border-border" />
            <p className="text-xs text-muted-foreground">Days before commission becomes available for withdrawal</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Minimum Payout Threshold ($)</label>
            <Input type="number" value={settings.minimum_payout_threshold} onChange={e => setSettings({ ...settings, minimum_payout_threshold: parseFloat(e.target.value) })} className="bg-secondary border-border" />
            <p className="text-xs text-muted-foreground">Minimum available balance required to request a payout</p>
          </div>


          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
