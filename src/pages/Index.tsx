import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight, BarChart3, Users, Shield, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: Users, title: '3-Tier System', desc: 'Admins, Managers, and Influencers with strict role-based access.' },
  { icon: BarChart3, title: 'Real-Time Analytics', desc: 'Track revenue, conversions, and team performance instantly.' },
  { icon: Ticket, title: 'Coupon Attribution', desc: 'Permanent customer tagging with smart coupon tracking.' },
  { icon: Shield, title: 'Secure Payouts', desc: '30-day lock period with admin-approved withdrawals.' },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Viral Growth</span>
        </div>
        <Link to="/auth">
          <Button variant="outline" size="sm">Sign In</Button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-12 py-24 lg:py-32 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <Zap className="h-3 w-3" /> Master Command Center
        </div>
        <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
          Scale Your Affiliate<br />
          <span className="gradient-text">Empire Effortlessly</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          A production-ready 3-tier affiliate and influencer marketing platform with real-time analytics, smart coupon attribution, and automated commission management.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="glow-primary">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-12 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title} className="stat-card rounded-xl border border-border p-6 hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-8 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">© 2026 Viral Growth. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
