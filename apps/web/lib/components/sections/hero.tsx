'use client';

import Link from 'next/link';
import { ArrowRight, Code2, Globe2, ShieldCheck, Zap } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';

const codeLines = [
  [
    { content: 'import ', tone: 'text-sky-300' },
    { content: '{ ', tone: 'text-emerald-300' },
    { content: 'ReAuthEngine ', tone: 'text-emerald-100' },
    { content: '} ', tone: 'text-emerald-300' },
    { content: "from '@re-auth/reauth'", tone: 'text-purple-200' },
  ],
  [
    { content: 'import ', tone: 'text-sky-300' },
    { content: '{ ', tone: 'text-emerald-300' },
    { content: 'emailPasswordPlugin ', tone: 'text-emerald-100' },
    { content: '} ', tone: 'text-emerald-300' },
    { content: "from '@re-auth/reauth/plugins'", tone: 'text-purple-200' },
  ],
  [
    { content: 'import ', tone: 'text-sky-300' },
    { content: '{ ', tone: 'text-emerald-300' },
    { content: 'KyselyAdapter ', tone: 'text-emerald-100' },
    { content: '} ', tone: 'text-emerald-300' },
    { content: "from '@re-auth/reauth/adapters'", tone: 'text-purple-200' },
  ],
  [],
  [
    { content: 'const ', tone: 'text-sky-300' },
    { content: 'engine ', tone: 'text-emerald-100' },
    { content: '= new ', tone: 'text-sky-300' },
    { content: 'ReAuthEngine', tone: 'text-emerald-100' },
    { content: '({', tone: 'text-slate-200' },
  ],
  [
    { content: '  orm: ', tone: 'text-slate-400' },
    { content: 'new ', tone: 'text-sky-300' },
    { content: 'KyselyAdapter', tone: 'text-emerald-100' },
    { content: '(db),', tone: 'text-slate-300' },
  ],
  [{ content: '  plugins: [', tone: 'text-slate-300' }],
  [
    { content: '    ', tone: '' },
    { content: 'emailPasswordPlugin', tone: 'text-emerald-100' },
    { content: '({', tone: 'text-slate-200' },
  ],
  [
    { content: '      requireEmailVerification: ', tone: 'text-slate-400' },
    { content: 'true', tone: 'text-orange-300' },
    { content: ',', tone: 'text-slate-400' },
  ],
  [
    { content: '    })', tone: 'text-slate-300' },
    { content: ',', tone: 'text-slate-400' },
  ],
  [{ content: '  ],', tone: 'text-slate-400' }],
  [{ content: '})', tone: 'text-slate-300' }],
  [],
  [{ content: '// Use with ANY runtime', tone: 'text-slate-500' }],
  [
    { content: 'export ', tone: 'text-sky-300' },
    { content: 'const ', tone: 'text-sky-300' },
    { content: 'auth ', tone: 'text-emerald-100' },
    { content: '= engine', tone: 'text-slate-200' },
  ],
];

const metrics = [
  { label: 'Frameworks', value: '18+', icon: Globe2 },
  { label: 'Plugins', value: '30+', icon: Zap },
  { label: 'Security Tests', value: '400+', icon: ShieldCheck },
];

export function Hero() {
  return (
    <section id="hero" className="relative isolate overflow-hidden border-b">
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-background via-primary/10 to-background" />
      <div className="absolute left-1/2 top-[-20%] -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/30 via-sky-400/20 to-emerald-400/25 blur-3xl" />
      <div className="absolute right-[-10%] bottom-[-10%] -z-10 h-[480px] w-[480px] rounded-full bg-gradient-to-tl from-emerald-400/20 via-primary/15 to-transparent blur-3xl" />

      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] flex-col justify-center px-4 py-16 md:py-24 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:items-center">
          <div className="relative z-10 flex flex-col gap-8">
            <div className="inline-flex w-fit items-center gap-2 border border-border/60 bg-background/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground backdrop-blur">
              <span className="size-2 rounded-full bg-gradient-to-br from-primary via-sky-500 to-emerald-400" />
              Compose Auth Anywhere
            </div>

            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Build authentication once & reuse it
              <span className="block bg-gradient-to-r from-primary via-sky-500 to-emerald-400 bg-clip-text text-transparent">
                across every runtime
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              ReAuth separates your core auth logic from frameworks and
              protocols. Ship passwordless, OAuth, or custom flows with one
              engine that deploys from Node to edge.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="group h-12 rounded-none border border-border/70 bg-primary px-6"
                asChild
              >
                <Link href="/docs">
                  Explore Docs
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-none border-border/70 px-6"
                asChild
              >
                <Link href="https://github.com/SOG-web/reauth">
                  <Code2 className="mr-2 size-4" />
                  View on GitHub
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex items-center gap-3 border border-border/60 bg-background/60 px-4 py-3 backdrop-blur"
                >
                  <span className="flex size-9 items-center justify-center border border-border/60 bg-gradient-to-br from-primary/80 via-sky-500/60 to-emerald-400/70 text-primary-foreground">
                    <metric.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {metric.value}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {metric.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-[2px] border border-primary/40" />
            <div className="relative overflow-hidden border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(18,19,30,0.92),_rgba(11,12,20,0.98))]">
              <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.3em] text-white/60">
                <div className="size-2.5 rounded-full bg-rose-400" />
                <div className="size-2.5 rounded-full bg-amber-300" />
                <div className="size-2.5 rounded-full bg-emerald-400" />
                <span className="ml-auto font-mono text-[10px] text-white/50">
                  reauth.config.ts
                </span>
              </div>

              <div className="relative max-h-[420px] overflow-hidden px-6 py-6">
                <div className="absolute -left-40 top-10 h-48 w-48 bg-emerald-400/20 blur-3xl" />
                <div className="absolute right-10 top-1/2 h-40 w-40 -translate-y-1/2 bg-sky-500/20 blur-3xl" />
                <div className="relative font-mono text-[13px] leading-relaxed text-white">
                  {codeLines.map((line, index) => (
                    <div key={index} className="flex gap-4">
                      <span className="w-6 text-right text-[11px] text-white/30">
                        {index + 1}
                      </span>
                      <span className="flex-1 whitespace-pre">
                        {line.length === 0 ? (
                          <>&nbsp;</>
                        ) : (
                          line.map((token, i) => (
                            <span key={i} className={token.tone}>
                              {token.content}
                            </span>
                          ))
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -right-6 -top-6 flex flex-col border border-white/20 bg-white/10 px-4 py-3 text-xs font-medium text-white backdrop-blur">
              <span className="text-[11px] uppercase tracking-wide text-white/60">
                Deployment Modes
              </span>
              <span className="text-sm font-semibold">
                Server · Edge · Worker
              </span>
            </div>

            <div className="absolute -bottom-6 -left-4 flex items-center gap-3 border border-white/15 bg-black/30 px-4 py-3 text-xs font-medium text-white backdrop-blur">
              <span className="size-8 border border-white/30 bg-gradient-to-br from-primary via-sky-500 to-emerald-400" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">
                  Generated SDKs
                </p>
                <p className="text-sm font-semibold">
                  Type-safe clients in minutes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
