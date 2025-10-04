'use client';

export function Architecture() {
  return (
    <section id="adapters" className="bg-muted/10 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="text-2xl font-semibold uppercase tracking-tight md:text-3xl">
            Three-Layer Architecture
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Keep your authentication logic portable, testable, and maintainable
            with a deliberate separation of concerns.
          </p>
        </div>

        <div className="mx-auto max-w-5xl space-y-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                number: '01',
                title: 'Core Engine',
                description:
                  'Protocol-agnostic auth logic that owns sessions, tokens, and user state without caring about transports.',
                bullets: [
                  'Session management',
                  'Plugin system',
                  'ORM adapters',
                ],
              },
              {
                number: '02',
                title: 'HTTP Adapters',
                description:
                  'Surface the engine over HTTP frameworks with proper cookies, headers, redirects, and error handling.',
                bullets: [
                  'Request/response orchestration',
                  'Cookie + header helpers',
                  'OAuth flow primitives',
                ],
              },
              {
                number: '03',
                title: 'Framework Integration',
                description:
                  'Ship idiomatic APIs for Express, Hono, Fastify, Next.js, or anything else that speaks HTTP.',
                bullets: [
                  'Express middleware',
                  'Hono handlers',
                  'Fastify plugins',
                ],
              },
            ].map((layer) => (
              <div
                key={layer.number}
                className="flex flex-col gap-4 border border-border/70 bg-background/80 p-6"
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                  <span>{layer.title}</span>
                  <span className="border border-border/70 bg-muted/40 px-2 py-1 text-[0.65rem] text-foreground">
                    {layer.number}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {layer.description}
                </p>
                <ul className="space-y-2 text-sm text-foreground">
                  {layer.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2">
                      <span className="h-px w-6 bg-primary/50" />
                      <span className="opacity-80">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border border-border/70 bg-background/70 px-6 py-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Pro tip - test the engine in isolation, then swap frameworks
              without rewriting your auth logic or SDKs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
