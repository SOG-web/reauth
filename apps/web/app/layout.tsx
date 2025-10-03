import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { RootProvider } from 'fumadocs-ui/provider/next';

import './globals.css';

import { ThemeProvider } from '@/lib/components/theme-provider';
import { SiteShell } from '@/lib/components/site-shell';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'ReAuth – Authentication Without Limits',
  description:
    'Build authentication that adapts to every runtime, framework, and protocol with ReAuth.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <RootProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <SiteShell>{children}</SiteShell>
          </ThemeProvider>
        </RootProvider>
      </body>
    </html>
  );
}
