'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  ArrowUpRight,
  Menu,
  MoonStar,
  Sparkles,
  SunMedium,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/lib/components/ui/button';

const navItems = [
  { label: 'Features', href: '#features' },
  { label: 'Adapters', href: '#adapters' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'Pricing', href: 'https://github.com/SOG-web/reauth' },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span className="flex size-9 items-center justify-center border border-border/60 bg-card/40" />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9 border border-border/60 bg-background/80 backdrop-blur"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <SunMedium className="size-4" />
      ) : (
        <MoonStar className="size-4" />
      )}
    </Button>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const handleNavigate = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-3 text-sm font-semibold tracking-tight"
        >
          <span className="flex size-7 items-center justify-center border border-border/60 bg-gradient-to-br from-primary via-sky-500/60 to-emerald-400/70 text-primary-foreground">
            <Sparkles className="size-3.5" />
          </span>
          <span className="hidden sm:inline">
            ReAuth{' '}
            <span className="text-muted-foreground">/ Universal Auth</span>
          </span>
          <span className="sm:hidden">ReAuth</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const isExternal = item.href.startsWith('http');

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'group relative text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'text-foreground',
                )}
              >
                {item.label}
                <span className="absolute left-0 top-full block h-px w-full scale-x-0 bg-gradient-to-r from-primary via-sky-500 to-emerald-400 transition-transform duration-200 ease-out group-hover:scale-x-100" />
                {isExternal && <ArrowUpRight className="ml-1 inline size-3" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild className="hidden md:inline-flex">
            <Link href="/docs">
              Documentation
              <ArrowUpRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'md:hidden',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
      >
        <div className="mx-4 mb-4 border border-border/60 bg-background/95 p-6 backdrop-blur-lg">
          <div className="space-y-4">
            {navItems.map((item) => {
              const isExternal = item.href.startsWith('http');
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={handleNavigate}
                  className="flex items-center justify-between text-base font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>{item.label}</span>
                  {isExternal && <ArrowUpRight className="size-4" />}
                </Link>
              );
            })}
            <Button asChild className="w-full">
              <Link href="/docs" onClick={handleNavigate}>
                Documentation
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
