import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border border-transparent text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          'border-primary/80 bg-primary text-primary-foreground hover:bg-primary/85',
        destructive:
          'border-destructive/80 bg-destructive text-white hover:bg-destructive/85 focus-visible:ring-destructive/25 dark:bg-destructive/60',
        outline:
          'border-border/70 bg-background/70 hover:bg-muted/30 hover:text-foreground',
        secondary:
          'border-secondary/60 bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'border-transparent hover:border-border/60 hover:bg-muted/20 hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-11 px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
