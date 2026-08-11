import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch admin dashboard stats with caching and dedup
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [salesRes, commissionsRes, payoutsRes, couponsRes, managersRes, influencersRes, creditsRes, purchaseTransRes, consumptionTransRes, paymentTxnRes, subsRes] = await Promise.all([
        supabase.from('sales').select('final_amount, created_at'),
        supabase.from('commissions').select('influencer_amount, manager_amount'),
        supabase.from('payout_requests').select('amount').eq('status', 'paid'),
        supabase.from('coupons').select('id').eq('is_active', true),
        supabase.from('user_roles').select('id').eq('role', 'manager'),
        supabase.from('user_roles').select('id').eq('role', 'influencer'),
        supabase.from('user_credits').select('balance'),
        supabase.from('credit_transactions').select('credits_change, amount_paid, created_at').in('transaction_type', ['purchase', 'topup']),
        supabase.from('credit_transactions').select('credits_change, created_at, reference_id').eq('transaction_type', 'consumption'),
        supabase.from('payment_transactions').select('status, amount, billing_type, created_at'),
        supabase.from('subscriptions').select('is_active, expiry_date'),
      ]);

      const totalSales = salesRes.data?.reduce((s, r) => s + Number(r.final_amount), 0) ?? 0;
      const totalCommissions = commissionsRes.data?.reduce((s, r) => s + Number(r.influencer_amount) + Number(r.manager_amount), 0) ?? 0;
      const totalPayouts = payoutsRes.data?.reduce((s, r) => s + Number(r.amount), 0) ?? 0;
      const totalCreditsSold = purchaseTransRes.data?.reduce((s, r) => s + Number(r.credits_change), 0) ?? 0;
      const totalCreditsConsumed = Math.abs(consumptionTransRes.data?.reduce((s, r) => s + Number(r.credits_change), 0) ?? 0);

      const paymentTxns = paymentTxnRes.data ?? [];
      const now = new Date();
      const activeSubs = (subsRes.data ?? []).filter(s => s.is_active && new Date(s.expiry_date) > now).length;

      const monthlyRev = paymentTxns.filter(t => t.status === 'succeeded' && t.billing_type === 'monthly').reduce((s, t) => s + Number(t.amount), 0);
      const yearlyRev = paymentTxns.filter(t => t.status === 'succeeded' && t.billing_type === 'yearly').reduce((s, t) => s + Number(t.amount), 0);

      // Revenue chart
      const monthMap: Record<string, { revenue: number }> = {};
      salesRes.data?.forEach((s: any) => {
        const month = new Date(s.created_at).toLocaleString('default', { month: 'short' });
        if (!monthMap[month]) monthMap[month] = { revenue: 0 };
        monthMap[month].revenue += Number(s.final_amount);
      });
      const chartData = Object.entries(monthMap).map(([name, vals]) => ({ name, ...vals }));

      // Consumption by type
      const typeMap: Record<string, number> = { invoice: 0, estimate: 0, ai_estimate: 0, other: 0 };
      (consumptionTransRes.data ?? []).forEach((t: any) => {
        const ref = t.reference_id || '';
        if (ref.startsWith('invoice')) typeMap.invoice += Math.abs(Number(t.credits_change));
        else if (ref.startsWith('ai_estimate')) typeMap.ai_estimate += Math.abs(Number(t.credits_change));
        else if (ref.startsWith('estimate')) typeMap.estimate += Math.abs(Number(t.credits_change));
        else typeMap.other += Math.abs(Number(t.credits_change));
      });
      const consumptionByType = Object.entries(typeMap).filter(([, v]) => v > 0).map(([name, value]) => ({
        name: name === 'ai_estimate' ? 'AI Estimate' : name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));

      const creditAllocation = [
        { name: 'Sold', value: totalCreditsSold },
        { name: 'Consumed', value: totalCreditsConsumed },
        { name: 'Remaining', value: Math.max(0, totalCreditsSold - totalCreditsConsumed) },
      ];

      return {
        stats: {
          totalSales, totalCommissions, totalPayouts,
          activeCoupons: couponsRes.data?.length ?? 0,
          totalManagers: managersRes.data?.length ?? 0,
          totalInfluencers: influencersRes.data?.length ?? 0,
          totalUsers: creditsRes.data?.length ?? 0,
          totalCreditsSold, totalCreditsConsumed,
          totalPayments: paymentTxns.length,
          successPayments: paymentTxns.filter(t => t.status === 'succeeded').length,
          failedPayments: paymentTxns.filter(t => t.status === 'failed').length,
          activeSubscriptions: activeSubs,
          monthlyRevenue: monthlyRev, yearlyRevenue: yearlyRev,
        },
        chartData,
        consumptionByType,
        creditAllocation,
      };
    },
    staleTime: 30_000, // Cache for 30s
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for manager dashboard stats
 */
export function useManagerStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['manager-stats', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user');
      const [teamRes, couponsRes, commissionsRes, salesRes] = await Promise.all([
        supabase.from('manager_influencers').select('influencer_id').eq('manager_id', userId),
        supabase.from('coupons').select('id').eq('is_active', true),
        supabase.from('commissions').select('manager_amount, sale_id').eq('manager_id', userId),
        supabase.from('sales').select('final_amount'),
      ]);

      const overrideEarnings = commissionsRes.data?.reduce((s, r) => s + Number(r.manager_amount), 0) ?? 0;
      const teamRevenue = salesRes.data?.reduce((s, r) => s + Number(r.final_amount), 0) ?? 0;

      return {
        teamSize: teamRes.data?.length ?? 0,
        teamRevenue,
        overrideEarnings,
        activeCoupons: couponsRes.data?.length ?? 0,
      };
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for wallet data
 */
export function useWalletData(userId: string | undefined, role: string | null) {
  return useQuery({
    queryKey: ['wallet', userId, role],
    queryFn: async () => {
      if (!userId || !role) throw new Error('No user');
      const col = role === 'manager' ? 'manager_amount' : 'influencer_amount';
      const filterCol = role === 'manager' ? 'manager_id' : 'influencer_id';

      const [commissionsRes, payoutsRes, settingsRes] = await Promise.all([
        supabase.from('commissions').select('*').eq(filterCol, userId),
        supabase.from('payout_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('global_settings').select('minimum_payout_threshold').single(),
      ]);

      const commissions = commissionsRes.data ?? [];
      const total = commissions.reduce((s, c) => s + Number(c[col] ?? 0), 0);
      const locked = commissions.filter(c => c.status === 'locked').reduce((s, c) => s + Number(c[col] ?? 0), 0);
      const available = commissions.filter(c => c.status === 'unlocked').reduce((s, c) => s + Number(c[col] ?? 0), 0);

      return {
        earnings: { total, locked, available },
        payouts: payoutsRes.data ?? [],
        threshold: Number(settingsRes.data?.minimum_payout_threshold ?? 50),
      };
    },
    enabled: !!userId && !!role,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for coupons with role-based filtering
 */
export function useCoupons(role: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: ['coupons', role, userId],
    queryFn: async () => {
      if (role === 'influencer' && userId) {
        const { data } = await supabase.from('coupons').select('*').eq('influencer_id', userId).order('created_at', { ascending: false });
        return data ?? [];
      }
      const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!role,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for managers list (admin only)
 */
export function useManagersList() {
  return useQuery({
    queryKey: ['managers-list'],
    queryFn: async () => {
      const { data: roleData } = await supabase.from('user_roles').select('user_id').eq('role', 'manager');
      if (!roleData?.length) return [];
      const ids = roleData.map(r => r.user_id);
      const { data } = await supabase.from('profiles').select('*').in('user_id', ids);
      return data ?? [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for external users list (admin only)
 */
export function useExternalUsers() {
  return useQuery({
    queryKey: ['external-users'],
    queryFn: async () => {
      // Exclude only staff roles (admin/manager/influencer). Users with role 'user'
      // (external customers from app.constil.com) should appear here.
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'manager', 'influencer']);
      const staffIds = new Set((staffRoles ?? []).map(r => r.user_id));
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      return (allProfiles ?? []).filter(p => !staffIds.has(p.user_id));
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for pricing packages
 */
export function useActivePackages() {
  return useQuery({
    queryKey: ['active-packages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .eq('billing_type', 'subscription')
        .order('price');
      return (data as any[]) ?? [];
    },
    staleTime: 60_000, // Packages rarely change
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for user trial usage check
 */
export function useTrialUsage(userId: string | undefined) {
  return useQuery({
    queryKey: ['trial-usage', userId],
    queryFn: async () => {
      if (!userId) return {};
      const { data } = await supabase
        .from('subscriptions')
        .select('package_id')
        .eq('user_id', userId)
        .eq('is_trial', true);
      const used: Record<string, boolean> = {};
      (data ?? []).forEach((s: any) => { used[s.package_id] = true; });
      return used;
    },
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
