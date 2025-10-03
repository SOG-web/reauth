'use client';

import { useEffect, useRef } from 'react';

const testimonials = [
  {
    quote:
      'ReAuth made our migration from monolith to microservices seamless. Same auth logic, different protocols.',
    author: 'Sarah Chen',
    role: 'Lead Engineer at TechCorp',
    avatar: 'SC',
  },
  {
    quote:
      'Finally, authentication that works with our edge functions. No vendor lock-in, no compromises.',
    author: 'Marcus Johnson',
    role: 'CTO at StartupX',
    avatar: 'MJ',
  },
  {
    quote:
      'The plugin architecture is brilliant. We built custom OAuth flows in days, not weeks.',
    author: 'Aisha Patel',
    role: 'Senior Developer',
    avatar: 'AP',
  },
  {
    quote:
      'Type-safe SDKs generated automatically? This is the future of authentication libraries.',
    author: 'David Kim',
    role: 'Full Stack Developer',
    avatar: 'DK',
  },
  {
    quote:
      'Switched from a SaaS auth provider to ReAuth. Same features, zero monthly costs.',
    author: 'Emma Rodriguez',
    role: 'Founder at DevTools',
    avatar: 'ER',
  },
  {
    quote:
      "Works perfectly with our WebSocket real-time features. Other libraries couldn't handle it.",
    author: 'James Liu',
    role: 'Backend Lead',
    avatar: 'JL',
  },
  {
    quote:
      "The best DX I've experienced in auth. Clean APIs, excellent docs, zero magic.",
    author: 'Sophie Martin',
    role: 'Developer Advocate',
    avatar: 'SM',
  },
  {
    quote:
      'Cross-runtime support is a game-changer. Node, Deno, Bun - all work flawlessly.',
    author: 'Alex Turner',
    role: 'Platform Engineer',
    avatar: 'AT',
  },
];

export function Testimonials() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // Duplicate the testimonials for seamless loop
    const scrollerContent = Array.from(scroller.children);
    scrollerContent.forEach((item) => {
      const duplicatedItem = item.cloneNode(true);
      scroller.appendChild(duplicatedItem);
    });
  }, []);

  return (
    <section className="overflow-hidden border-t bg-muted/15 py-16">
      <div className="container mx-auto mb-10 px-4 text-center">
        <h2 className="text-2xl font-semibold uppercase tracking-tight md:text-3xl">
          Trusted by Developers
        </h2>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Teams everywhere ship on ReAuth without sacrificing security or DX
        </p>
      </div>

      <div className="relative">
        {/* Gradient overlays */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />

        {/* Scrolling container */}
        <div className="overflow-hidden">
          <div
            ref={scrollerRef}
            className="flex gap-6 animate-scroll"
            style={{
              width: 'max-content',
            }}
          >
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="flex w-[360px] flex-shrink-0 flex-col gap-4 border border-border/70 bg-background/80 p-6 text-left"
              >
                <p className="line-clamp-3 text-sm leading-relaxed text-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="flex items-center gap-4 border-t border-border/60 pt-4">
                  <div className="flex size-10 items-center justify-center border border-border/70 bg-muted/40 text-xs font-semibold uppercase tracking-[0.25em] text-foreground">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {testimonial.author}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes scroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }

          .animate-scroll {
            animation: scroll 40s linear infinite;
          }

          .animate-scroll:hover {
            animation-play-state: paused;
          }
        `,
        }}
      />
    </section>
  );
}
