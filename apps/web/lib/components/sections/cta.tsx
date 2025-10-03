'use client';

import { Button } from '@/lib/components/ui/button';
import { ArrowRight, Github, BookOpen } from 'lucide-react';
import Link from 'next/link';

export function CTA() {
  return (
    <section className="border-t bg-muted/15 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl border border-border/70 bg-background/80 px-8 py-12 text-center">
          <h2 className="text-3xl font-semibold uppercase tracking-tight md:text-4xl">
            Ready to Build?
          </h2>

          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            Ship authentication that meets your constraints without vendor
            lock-in. Configure once, deploy everywhere, and keep total control
            of your stack.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="default"
              className="group min-w-[200px] border border-border/70 bg-primary/80 uppercase tracking-[0.3em]"
              asChild
            >
              <Link href="/docs">
                <BookOpen className="size-5" />
                <span>Read Documentation</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>

            <Button
              size="default"
              variant="outline"
              className="min-w-[200px] border border-border/70 uppercase tracking-[0.3em]"
              asChild
            >
              <Link href="https://github.com/SOG-web/reauth">
                <Github className="size-5" />
                <span>Star on GitHub</span>
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-5 text-left md:grid-cols-3">
            <div className="border border-border/70 bg-background/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-foreground">
                Open Source
              </h3>
              <p className="mt-2 text-xs text-muted-foreground md:text-sm">
                MIT licensed with an active community. Fork, extend, and deploy
                without recurring fees.
              </p>
            </div>

            <div className="border border-border/70 bg-background/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-foreground">
                Type Safe
              </h3>
              <p className="mt-2 text-xs text-muted-foreground md:text-sm">
                Built in TypeScript with full inference. Generate SDKs that keep
                your contract in sync.
              </p>
            </div>

            <div className="border border-border/70 bg-background/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-foreground">
                Production Ready
              </h3>
              <p className="mt-2 text-xs text-muted-foreground md:text-sm">
                Hardened through real-world deployments with comprehensive
                coverage and observability hooks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
