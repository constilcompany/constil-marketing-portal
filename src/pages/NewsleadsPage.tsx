import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail, Search, Download, Calendar, Globe, RefreshCw, MapPin, Compass } from 'lucide-react';

interface Newslead {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  page_url: string | null;
  timezone: string | null;
  created_at: string;
  ip_address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  is_new_user?: boolean | null;
  session_count?: number | null;
  screen_resolution?: string | null;
  browser_language?: string | null;
  navigation_history?: string[] | null;
}

const NewsleadsPage: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: leads = [], isLoading, refetch, isFetching } = useQuery<Newslead[]>({
    queryKey: ['newsleads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsleads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error("Error fetching newsleads:", error);
        throw error;
      }
      return (data || []) as Newslead[];
    },
    staleTime: 15_000,
  });

  // Filter leads based on search input
  const filteredLeads = leads.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.page_url && item.page_url.toLowerCase().includes(q)) ||
      (item.ip_address && item.ip_address.toLowerCase().includes(q)) ||
      (item.city && item.city.toLowerCase().includes(q)) ||
      (item.country && item.country.toLowerCase().includes(q)) ||
      (item.utm_source && item.utm_source.toLowerCase().includes(q))
    );
  });

  // Export to CSV
  const exportToCSV = () => {
    if (filteredLeads.length === 0) return;

    const headers = [
      'Created At', 'Name', 'Email', 'Phone', 'IP Address', 'City', 'Country',
      'Landing Page', 'Referrer', 'UTM Source', 'UTM Campaign', 'Session Count', 'Timezone'
    ];
    const rows = filteredLeads.map((item) => [
      item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${item.email.replace(/"/g, '""')}"`,
      `"${(item.phone || '').replace(/"/g, '""')}"`,
      `"${(item.ip_address || '').replace(/"/g, '""')}"`,
      `"${(item.city || '').replace(/"/g, '""')}"`,
      `"${(item.country || '').replace(/"/g, '""')}"`,
      `"${(item.landing_page || item.page_url || '').replace(/"/g, '""')}"`,
      `"${(item.referrer || '').replace(/"/g, '""')}"`,
      `"${(item.utm_source || '').replace(/"/g, '""')}"`,
      `"${(item.utm_campaign || '').replace(/"/g, '""')}"`,
      `"${item.session_count || 1}"`,
      `"${(item.timezone || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `newsleads_forensics_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats calculation
  const totalLeads = leads.length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const leadsToday = leads.filter((l) => new Date(l.created_at) >= todayStart).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Newsleads & Popup Forensics</h1>
            <p className="text-muted-foreground">Manage and track leads captured from website newsletter, modal, and campaign landing pages</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={exportToCSV} disabled={filteredLeads.length === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              Export Forensics CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">Total Newsleads</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{leadsToday}</p>
                <p className="text-xs text-muted-foreground">Captured Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredLeads.length}</p>
                <p className="text-xs text-muted-foreground">Matching Filter</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Table Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <CardTitle className="text-base font-semibold">Subscribers & Leads</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, IP, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-12">Loading newsleads...</p>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  {leads.length === 0 ? 'No newsleads captured yet.' : 'No results matching your search.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads submitted from the website modal will appear here with full visitor forensics.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Captured At</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email / Phone</TableHead>
                      <TableHead>Location & IP</TableHead>
                      <TableHead>Origin / Campaign</TableHead>
                      <TableHead>Page Journey</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((item) => {
                      const locationStr = [item.city, item.country].filter(Boolean).join(', ');
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')}
                            {item.is_new_user !== undefined && (
                              <div className="mt-0.5">
                                <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                                  {item.is_new_user ? 'New Visitor' : `Session #${item.session_count || 2}`}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm text-foreground whitespace-nowrap">
                            {item.name || <span className="text-muted-foreground italic">Anonymous</span>}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            <div className="font-mono text-primary text-xs">{item.email}</div>
                            {item.phone && <div className="text-xs text-muted-foreground mt-0.5">{item.phone}</div>}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {locationStr ? (
                              <div className="flex items-center gap-1 text-foreground">
                                <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                                <span>{locationStr}</span>
                              </div>
                            ) : null}
                            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                              {item.ip_address || item.timezone || 'UTC'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {item.utm_source ? (
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[11px]">
                                {item.utm_source} {item.utm_campaign ? `(${item.utm_campaign})` : ''}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">{item.referrer || 'Direct'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={item.page_url || item.landing_page || ''}>
                            {item.navigation_history && Array.isArray(item.navigation_history) && item.navigation_history.length > 0 ? (
                              <div className="flex items-center gap-1 text-[11px] font-mono">
                                <Compass className="h-3 w-3 text-primary shrink-0" />
                                <span className="truncate">{item.navigation_history.join(' → ')}</span>
                              </div>
                            ) : (
                              <a href={item.page_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {item.page_url?.replace(/^https?:\/\/[^/]+/, '') || '/'}
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default NewsleadsPage;
