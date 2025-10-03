'use client';

import { Shield, Users, TrendingUp, Sparkles } from 'lucide-react';

const stats = [
  {
    icon: Shield,
    value: '20+',
    label: 'Auth Providers',
    description: 'OAuth, Email, Phone, Passwordless & more',
  },
  {
    icon: Users,
    value: '50K+',
    label: 'Downloads',
    description: 'Trusted by developers worldwide',
  },
  {
    icon: TrendingUp,
    value: '99.9%',
    label: 'Uptime',
    description: 'Production-ready reliability',
  },
  {
    icon: Sparkles,
    value: '100%',
    label: 'Type-Safe',
    description: 'Full TypeScript support',
  },
];

export function Stats() {
  return (
    <section className="border-b bg-muted/15">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 border border-border/70 bg-background/70 p-5 text-left"
            >
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                <span className="flex size-9 items-center justify-center border border-border/70 bg-muted/40 text-foreground">
                  <stat.icon className="size-5" />
                </span>
                {stat.label}
              </div>
              <div className="text-3xl font-semibold text-foreground md:text-4xl">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground md:text-sm">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
