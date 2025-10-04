import { ArrowRight, Check } from 'lucide-react';

const highlights = [
  'Protocol + runtime agnostic core engine',
  'Composable plugins for OAuth, 2FA, orgs, custom flows',
  'Zero lock-in: bring your database, transport, or adapter',
  'SDK generator stays in sync with your configuration',
];

const moduleTiles = [
  {
    badge: 'Layer 01',
    caption: 'Core Engine',
    description:
      'Model auth flows once and keep deterministic checks across runtimes and regions.',
    footer: 'Runtime neutral',
  },
  {
    badge: 'Layer 02',
    caption: 'Protocol Bridges',
    description:
      'Switch between REST, GraphQL, or edge handlers without rewriting validation logic.',
    footer: 'Adapters plug in',
  },
  {
    badge: 'Layer 03',
    caption: 'Policy Plane',
    description:
      'Compose plugins for SSO, 2FA, and org rules so every tenant keeps aligned guardrails.',
    footer: 'Policies stay in sync',
  },
];

const moduleSignals = [
  {
    label: 'Plugin Slots',
    value: '12',
    description: 'Mix and match flows per tenant without touching the core.',
  },
  {
    label: 'Runtime Targets',
    value: '6',
    description: 'Node, Deno, Bun, Workers, Lambda, or anywhere JS executes.',
  },
  {
    label: 'SDK Clients',
    value: 'Auto-generated',
    description: 'Ship typed clients in sync with the server configuration.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative border-y bg-muted/10 py-20">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-primary/10 to-background" />
      <div className="container mx-auto grid gap-14 px-4 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:items-center">
        <div className="space-y-10">
          <div className="inline-flex items-center gap-3 border border-border/80 bg-background/80 px-5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            <span className="size-2 bg-primary/70" />
            Modular by Design
          </div>

          <div className="space-y-5">
            <h2 className="max-w-xl text-3xl font-semibold uppercase tracking-tight text-foreground md:text-4xl">
              Every feature you expect from a managed provider - minus the lock
              in.
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground md:text-base">
              Your auth lives in three layers: a runtime-agnostic engine,
              protocol adapters, and generated SDKs. Swap runtimes, keep your
              rules, and deliver the same experience everywhere.
            </p>
          </div>

          <ul className="grid gap-3 text-sm md:text-base">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-4">
                <span className="mt-0.5 flex size-6 items-center justify-center border border-border/70 bg-muted/40 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-foreground">
                  <Check className="size-3" />
                </span>
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <a
            href="https://github.com/SOG-web/reauth"
            className="group inline-flex w-fit items-center gap-2 border border-border/70 bg-background/80 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-foreground transition-colors hover:bg-background"
          >
            Browse the plugin catalog
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        <div className="relative border border-border/70 bg-background/40 p-4">
          <div className="pointer-events-none absolute inset-0 border border-border/60" />
          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-border/60 bg-muted/20 px-4 py-3 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              <span className="text-foreground/80">System Blueprint</span>
              <span>ReAuth Stack</span>
            </div>

            <div className="grid gap-4">
              {moduleTiles.map((module) => (
                <div
                  key={module.badge}
                  className="flex flex-col gap-3 border border-border/60 bg-muted/15 p-4"
                >
                  <div className="flex items-center justify-between text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                    <span>{module.badge}</span>
                    <span>{module.footer}</span>
                  </div>
                  <div className="text-lg font-semibold uppercase tracking-tight text-foreground">
                    {module.caption}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {module.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 border border-border/60 bg-muted/10 p-4 sm:grid-cols-3">
              {moduleSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="flex flex-col gap-1 border border-border/60 bg-background/80 p-3"
                >
                  <span className="text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                    {signal.label}
                  </span>
                  <span className="text-base font-semibold uppercase tracking-tight text-foreground">
                    {signal.value}
                  </span>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {signal.description}
                  </span>
                </div>
              ))}
            </div>

            <div className="border border-border/60 bg-background/80 px-4 py-3 text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">
              End-to-end predictability without the managed provider premium.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
