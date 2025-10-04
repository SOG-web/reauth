'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Header } from '@/lib/components/navigation/header';
import { MouseGradient } from '@/lib/components/mouse-gradient';

type SiteShellProps = {
  children: ReactNode;
};

const DOCS_PREFIX = '/docs';

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();
  const hideMarketingChrome = pathname?.startsWith(DOCS_PREFIX);

  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-background">
      {!hideMarketingChrome && (
        <>
          <MouseGradient />
          <Header />
        </>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
