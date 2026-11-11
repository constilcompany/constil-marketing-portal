import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import {
  Bot,
  Search,
  Download,
  Calendar,
  Hammer,
  MessageSquare,
  ExternalLink,
  User,
  Phone,
  Mail,
  Globe,
  RefreshCw,
  MapPin,
  Compass,
} from 'lucide-react';

interface ChatMessage {
  id?: string;
  sender: 'bot' | 'user' | string;
  text: string;
  time?: string;
}

interface ChatbotLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  messages: ChatMessage[] | any;
  referrer: string | null;
  page_url: string | null;
  timezone: string | null;
  created_at: string;
  ip_address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  landing_page?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  is_new_user?: boolean | null;
  session_count?: number | null;
  screen_resolution?: string | null;
  browser_language?: string | null;
  navigation_history?: string[] | null;
}

const ChatbotLeadsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<ChatbotLead | null>(null);

  const { data: leads = [], isLoading, refetch, isFetching } = useQuery<ChatbotLead[]>({
    queryKey: ['chatbot-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error("Error fetching chatbot_leads:", error);
        throw error;
      }
      return (data || []) as ChatbotLead[];
    },
    staleTime: 15_000,
  });

  // Filter leads based on search
  const filteredLeads = leads.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = item.name && item.name.toLowerCase().includes(q);
    const emailMatch = item.email && item.email.toLowerCase().includes(q);
    const phoneMatch = item.phone && item.phone.toLowerCase().includes(q);
    const tradeMatch = item.trade && item.trade.toLowerCase().includes(q);
    const pageMatch = item.page_url && item.page_url.toLowerCase().includes(q);

    // Also search inside conversation message content
    let messageMatch = false;
    if (Array.isArray(item.messages)) {
      messageMatch = item.messages.some(
        (m: any) => typeof m?.text === 'string' && m.text.toLowerCase().includes(q)
      );
    }

    return nameMatch || emailMatch || phoneMatch || tradeMatch || pageMatch || messageMatch;
  });

  // Export to CSV
  const exportToCSV = () => {
    if (filteredLeads.length === 0) return;

    const headers = [
      'Created At', 'Name', 'Email', 'Phone', 'Trade', 'IP Address', 'City', 'Country',
      'Page URL', 'Landing Page', 'Referrer', 'UTM Source', 'UTM Campaign', 'Total Messages'
    ];
    const rows = filteredLeads.map((item) => [
      item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${(item.email || '').replace(/"/g, '""')}"`,
      `"${(item.phone || '').replace(/"/g, '""')}"`,
      `"${(item.trade || '').replace(/"/g, '""')}"`,
      `"${(item.ip_address || '').replace(/"/g, '""')}"`,
      `"${(item.city || '').replace(/"/g, '""')}"`,
      `"${(item.country || '').replace(/"/g, '""')}"`,
      `"${(item.page_url || '').replace(/"/g, '""')}"`,
      `"${(item.landing_page || '').replace(/"/g, '""')}"`,
      `"${(item.referrer || '').replace(/"/g, '""')}"`,
      `"${(item.utm_source || '').replace(/"/g, '""')}"`,
      `"${(item.utm_campaign || '').replace(/"/g, '""')}"`,
      Array.isArray(item.messages) ? item.messages.length : 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chatbot_leads_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats calculation
  const totalLeads = leads.length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const leadsToday = leads.filter((l) => new Date(l.created_at) >= todayStart).length;

  // Find most frequent trade
  const tradeCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const t = l.trade || 'General';
    tradeCounts[t] = (tradeCounts[t] || 0) + 1;
  });
  const topTrade = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const parseMessages = (msgs: any): ChatMessage[] => {
    if (Array.isArray(msgs)) return msgs;
    if (typeof msgs === 'string') {
      try {
        const parsed = JSON.parse(msgs);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chatbot Leads</h1>
            <p className="text-muted-foreground">Prospects engaged and captured by Alex (AI Sales Representative)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={exportToCSV} disabled={filteredLeads.length === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">Total Bot Conversations</p>
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
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Hammer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold truncate max-w-[150px]">{topTrade}</p>
                <p className="text-xs text-muted-foreground">Top Trade Interest</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <CardTitle className="text-base font-semibold">Live Chat Inquiries</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search leads, trade, messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-12">Loading chatbot leads...</p>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  {leads.length === 0 ? 'No chatbot leads captured yet.' : 'No results matching your search.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visitor conversations captured by the Alex AI Sales Bot will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created At</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Page / Referrer</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((item) => {
                      const chatMsgs = parseMessages(item.messages);
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="font-medium text-sm text-foreground whitespace-nowrap">
                            {item.name || <span className="text-muted-foreground italic">Chat Visitor</span>}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-primary whitespace-nowrap">
                            {item.email || <span className="text-muted-foreground/60">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {item.phone || <span className="text-muted-foreground/60">—</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                              {item.trade || 'General'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            <span title={`Page: ${item.page_url || '—'} | Referrer: ${item.referrer || 'Direct'}`}>
                              {item.page_url ? (
                                <a href={item.page_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {item.page_url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                </a>
                              ) : (
                                item.referrer || 'Direct'
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => setSelectedLead(item)}
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-primary" />
                              View Chat ({chatMsgs.length})
                            </Button>
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

        {/* View Chat Dialog */}
        <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
            <DialogHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Conversation with {selectedLead?.name || 'Chat Visitor'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                    Captured on{' '}
                    {selectedLead?.created_at &&
                      format(new Date(selectedLead.created_at), 'MMMM dd, yyyy @ HH:mm:ss')}
                  </DialogDescription>
                </div>
                {selectedLead?.trade && (
                  <Badge className="bg-primary/10 text-primary border-primary/30">
                    Trade: {selectedLead.trade}
                  </Badge>
                )}
              </div>

              {/* Lead Details Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/60 text-xs">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="text-foreground font-mono truncate">{selectedLead?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Phone className="h-3 w-3" /> Phone
                  </p>
                  <p className="text-foreground truncate">{selectedLead?.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 font-medium">
                    <MapPin className="h-3 w-3" /> Geo / IP
                  </p>
                  <p className="text-foreground truncate" title={selectedLead?.ip_address || ''}>
                    {[selectedLead?.city, selectedLead?.country].filter(Boolean).join(', ') || selectedLead?.ip_address || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 font-medium">
                    <ExternalLink className="h-3 w-3" /> Origin
                  </p>
                  <p className="text-foreground truncate">
                    {selectedLead?.utm_source ? `${selectedLead.utm_source} (${selectedLead.utm_campaign || 'ad'})` : (selectedLead?.referrer || 'Direct')}
                  </p>
                </div>
              </div>

              {/* Visitor Journey Breadcrumbs if present */}
              {selectedLead?.navigation_history && Array.isArray(selectedLead.navigation_history) && selectedLead.navigation_history.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-border/40 text-[11px] flex items-center gap-1.5 text-muted-foreground">
                  <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">Journey:</span>
                  <span className="font-mono truncate">{selectedLead.navigation_history.join(' → ')}</span>
                </div>
              )}
            </DialogHeader>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto py-4">
              <ScrollArea className="h-[360px] pr-4">
                {(() => {
                  const msgs = parseMessages(selectedLead?.messages);
                  if (msgs.length === 0) {
                    return (
                      <p className="text-muted-foreground text-center py-12 text-sm">
                        No individual message transcript recorded for this session.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-3.5">
                      {msgs.map((msg, idx) => {
                        const isBot = msg.sender === 'bot';
                        return (
                          <div
                            key={msg.id || idx}
                            className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-muted-foreground">
                              {isBot ? (
                                <>
                                  <Bot className="h-3 w-3 text-primary" />
                                  <span className="font-semibold text-primary">Alex (AI Sales Bot)</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-semibold text-foreground">
                                    {selectedLead?.name || 'Visitor'}
                                  </span>
                                  <User className="h-3 w-3" />
                                </>
                              )}
                              {msg.time && <span>• {msg.time}</span>}
                            </div>
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isBot
                                  ? 'bg-muted text-foreground rounded-tl-sm border border-border'
                                  : 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </ScrollArea>
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ChatbotLeadsPage;

