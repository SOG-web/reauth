import { Hero } from '@/lib/components/sections/hero';
import { Features } from '@/lib/components/sections/features';
import { Architecture } from '@/lib/components/sections/architecture';
import { CodeShowcase } from '@/lib/components/sections/code-showcase';
import { QuickStart } from '@/lib/components/sections/quick-start';
import { Testimonials } from '@/lib/components/sections/testimonials';
import { CTA } from '@/lib/components/sections/cta';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Hero />
      <QuickStart />
      <Features />
      <CodeShowcase />
      <Architecture />
      <Testimonials />
      <CTA />
    </main>
  );
}
