'use client';

import { Terminal } from 'lucide-react';

export function QuickStart() {
  return (
    <section className="border-t bg-muted/20 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-semibold uppercase tracking-tight">
              Get Started in Seconds
            </h2>
            <p className="text-sm text-muted-foreground md:text-base">
              Install ReAuth and ship authentication that works across every
              runtime without rewriting
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Install */}
            <div className="flex flex-col gap-4 border border-border/70 bg-background/70 p-5">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                <span className="flex size-7 items-center justify-center border border-border/60 bg-muted/40 text-[0.7rem] text-foreground">
                  1
                </span>
                Install Package
              </div>
              <div className="border border-dashed border-border/60 bg-muted/30 p-3">
                <div className="flex items-start gap-2 font-mono text-[0.75rem] leading-relaxed">
                  <Terminal className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
                  <code className="text-foreground">
                    npm install @re-auth/reauth
                  </code>
                </div>
              </div>
            </div>

            {/* Configure */}
            <div className="flex flex-col gap-4 border border-border/70 bg-background/70 p-5">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                <span className="flex size-7 items-center justify-center border border-border/60 bg-muted/40 text-[0.7rem] text-foreground">
                  2
                </span>
                Configure Engine
              </div>
              <div className="border border-dashed border-border/60 bg-muted/30 p-3">
                <pre className="overflow-x-auto font-mono text-[0.75rem] leading-relaxed">
                  <code className="text-foreground">
                    {`const engine = new ReAuthEngine({
  orm: adapter,
  plugins: [...]
})`}
                  </code>
                </pre>
              </div>
            </div>

            {/* Use */}
            <div className="flex flex-col gap-4 border border-border/70 bg-background/70 p-5">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                <span className="flex size-7 items-center justify-center border border-border/60 bg-muted/40 text-[0.7rem] text-foreground">
                  3
                </span>
                Deploy Anywhere
              </div>
              <div className="border border-dashed border-border/60 bg-muted/30 p-3">
                <pre className="overflow-x-auto font-mono text-[0.75rem] leading-relaxed">
                  <code className="text-foreground">
                    {`app.use(createAdapter(engine));
// Works across Express, Hono, Next.js
// No changes to your auth logic.`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
