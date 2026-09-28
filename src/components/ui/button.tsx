import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--brand)] px-4 py-2 text-white hover:bg-[var(--brand-dark)]",
        outline: "border border-[var(--border)] bg-white px-4 py-2 text-slate-700 hover:bg-[var(--surface-muted)]",
        ghost: "px-3 py-2 text-slate-600 hover:bg-[var(--surface-muted)]",
        destructive: "bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100",
      },
      size: { default: "min-h-10", sm: "min-h-9 text-xs", lg: "min-h-11 text-base" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
