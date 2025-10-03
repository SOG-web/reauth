'use client';

import { useState } from 'react';
import {
  Highlight,
  type Language,
  type PrismTheme,
  type RenderProps,
} from 'prism-react-renderer';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/lib/components/ui/tabs';

const highlightTheme: PrismTheme = {
  plain: {
    color: '#E5E7EB',
    backgroundColor: 'transparent',
  },
  styles: [
    {
      types: ['comment'],
      style: { color: 'rgba(148, 163, 184, 0.65)', fontStyle: 'italic' },
    },
    {
      types: ['keyword', 'builtin', 'operator'],
      style: { color: 'rgba(96, 165, 250, 0.95)' },
    },
    {
      types: ['string', 'char'],
      style: { color: 'rgba(134, 239, 172, 0.95)' },
    },
    {
      types: ['function', 'method'],
      style: { color: 'rgba(253, 224, 71, 0.9)' },
    },
    {
      types: ['number', 'boolean', 'constant'],
      style: { color: 'rgba(248, 180, 152, 0.95)' },
    },
    {
      types: ['punctuation'],
      style: { color: '#E5E7EB' },
    },
  ],
};

const codeExamples = {
  express: {
    title: 'Express',
    language: 'ts' as Language,
    code: `import express from 'express';
import { createExpressAdapter } from '@re-auth/http-adapters';

const app = express();

const adapter = createExpressAdapter({
  engine: auth,
  basePath: '/auth'
});

app.use('/auth', adapter.createRouter());

app.listen(3000);`,
  },
  hono: {
    title: 'Hono',
    language: 'ts' as Language,
    code: `import { Hono } from 'hono';
import { HonoAdapter } from '@re-auth/http-adapters';

const app = new Hono();

const adapter = new HonoAdapter({ engine: auth });
adapter.registerRoutes(app, '/auth', true);

export default app;`,
  },
  nextjs: {
    title: 'Next.js',
    language: 'ts' as Language,
    code: `// app/api/auth/[...auth]/route.ts
import { createHonoAdapter } from '@re-auth/http-adapters';
import { handle } from 'hono/vercel';

const adapter = createHonoAdapter({
  engine: auth,
  basePath: '/api/auth'
});

export const GET = handle(adapter);
export const POST = handle(adapter);`,
  },
  client: {
    title: 'Client SDK',
    language: 'ts' as Language,
    code: `import { createClient } from './reauth-client';

const client = createClient({
  baseURL: 'http://localhost:3000/auth'
});

// Type-safe authentication
const { data } = await client.emailPassword.register({
  email: 'user@example.com',
  password: 'securePassword123'
});

// Auto-generated from your configuration!`,
  },
};

export function CodeShowcase() {
  const [activeTab, setActiveTab] = useState('express');

  return (
    <section id="showcase" className="border-t bg-muted/15 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
          <h2 className="text-2xl font-semibold uppercase tracking-tight md:text-3xl">
            Works With Your Stack
          </h2>
          <p className="text-sm text-muted-foreground md:text-base">
            One auth engine, adapters for every protocol. Pick your target and
            drop these snippets in without rewrites.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-6 grid w-full grid-cols-4">
              {Object.entries(codeExamples).map(([key, example]) => (
                <TabsTrigger key={key} value={key}>
                  {example.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(codeExamples).map(([key, example]) => (
              <TabsContent key={key} value={key}>
                <div className="border border-border/70 bg-background/80">
                  <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
                    <div className="size-2.5 rounded-full bg-rose-400" />
                    <div className="size-2.5 rounded-full bg-amber-300" />
                    <div className="size-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                      {example.title}
                    </span>
                  </div>
                  <Highlight
                    code={example.code}
                    language={example.language}
                    theme={highlightTheme}
                  >
                    {(renderProps: RenderProps) => {
                      const {
                        className,
                        style,
                        tokens,
                        getLineProps,
                        getTokenProps,
                      } = renderProps;

                      return (
                        <pre
                          className={`${className} overflow-x-auto p-5`}
                          style={style}
                        >
                          <code className="block min-w-full font-mono text-[0.78rem] leading-relaxed">
                            {tokens.map((line, lineIndex) => {
                              const isLastLine =
                                lineIndex === tokens.length - 1;
                              const isEmpty =
                                line.length === 1 &&
                                line[0]?.content.trim() === '';
                              if (isLastLine && isEmpty) {
                                return null;
                              }

                              const lineProps = getLineProps({ line });
                              const {
                                className: lineClassName,
                                ...restLineProps
                              } = lineProps;
                              const mergedLineClassName =
                                `${lineClassName} flex min-h-[1.35rem] items-baseline gap-4`.trim();

                              return (
                                <div
                                  key={lineIndex}
                                  className={mergedLineClassName}
                                  {...restLineProps}
                                >
                                  <span className="w-10 select-none text-right text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground/70">
                                    {lineIndex + 1}
                                  </span>
                                  <span className="flex-1 whitespace-pre text-foreground">
                                    {line.map((token, tokenIndex) => {
                                      const tokenProps = getTokenProps({
                                        token,
                                      });
                                      const { ...restTokenProps } = tokenProps;
                                      return (
                                        <span
                                          key={tokenIndex}
                                          {...restTokenProps}
                                        />
                                      );
                                    })}
                                  </span>
                                </div>
                              );
                            })}
                          </code>
                        </pre>
                      );
                    }}
                  </Highlight>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  );
}
