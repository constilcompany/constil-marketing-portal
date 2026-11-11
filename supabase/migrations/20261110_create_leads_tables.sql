-- Migration: Create tables for Chatbot Leads and Newsleads
-- Generated on 2026-11-10

-- 1. Chatbot Leads Table (Used by Alex AI Sales Bot & Website Chatbot)
CREATE TABLE IF NOT EXISTS public.chatbot_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'alex_sales_bot',
  page_url TEXT,
  referrer TEXT,
  timezone TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Newsleads / Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS public.newsleads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'website_newsletter',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chatbot_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsleads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to allow clean idempotent reruns
DROP POLICY IF EXISTS "Admin full access chatbot_leads" ON public.chatbot_leads;
DROP POLICY IF EXISTS "Public insert chatbot_leads" ON public.chatbot_leads;
DROP POLICY IF EXISTS "Admin full access newsleads" ON public.newsleads;
DROP POLICY IF EXISTS "Public insert newsleads" ON public.newsleads;

-- Policies for chatbot_leads
CREATE POLICY "Admin full access chatbot_leads" 
  ON public.chatbot_leads 
  FOR ALL 
  TO authenticated 
  USING (true);

CREATE POLICY "Public insert chatbot_leads" 
  ON public.chatbot_leads 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

-- Policies for newsleads
CREATE POLICY "Admin full access newsleads" 
  ON public.newsleads 
  FOR ALL 
  TO authenticated 
  USING (true);

CREATE POLICY "Public insert newsleads" 
  ON public.newsleads 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

