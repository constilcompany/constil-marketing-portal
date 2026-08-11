import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Zap } from 'lucide-react';

interface ActionConfig {
  id: string;
  action_type: string;
  credit_cost: number;
  is_active: boolean;
}

const ACTION_LABELS: Record<string, { label: string; description: string }> = {
  invoice: { label: 'Invoice Creation', description: 'Credits consumed when a user creates an invoice' },
  estimate: { label: 'Estimate Creation', description: 'Credits consumed when a user creates an estimate' },
  ai_estimate: { label: 'AI Estimate', description: 'Credits consumed when a user generates an AI-powered estimate' },
};

const CreditConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<ActionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('credit_action_config')
      .select('*')
      .order('action_type')
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setConfigs((data as any) ?? []);
        setLoading(false);
      });
  }, []);

  const updateConfig = async (config: ActionConfig) => {
    setSaving(config.id);
    const { error } = await supabase
      .from('credit_action_config')
      .update({ credit_cost: config.credit_cost, is_active: config.is_active })
      .eq('id', config.id);
    if (error) toast.error(error.message);
    else toast.success(`${ACTION_LABELS[config.action_type]?.label ?? config.action_type} updated!`);
    setSaving(null);
  };

  const setField = (id: string, field: keyof ActionConfig, value: any) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set how many credits each action costs. Changes apply immediately.
          </p>
        </div>

        <div className="space-y-4">
          {configs.map((config) => {
            const meta = ACTION_LABELS[config.action_type] ?? {
              label: config.action_type,
              description: '',
            };
            return (
              <div
                key={config.id}
                className="stat-card rounded-xl border border-border p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {config.is_active ? 'Active' : 'Disabled'}
                    </span>
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(v) => setField(config.id, 'is_active', v)}
                    />
                  </div>
                </div>

                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Credit Cost
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={config.credit_cost}
                      onChange={(e) =>
                        setField(config.id, 'credit_cost', parseInt(e.target.value) || 1)
                      }
                      className="bg-secondary border-border"
                    />
                  </div>
                  <Button
                    onClick={() => updateConfig(config)}
                    disabled={saving === config.id}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saving === config.id ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreditConfigPage;
