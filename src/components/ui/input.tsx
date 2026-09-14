import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("min-h-10 w-full rounded-lg border bg-white px-3 text-sm shadow-sm placeholder:text-slate-400", className)} {...props} />
  ),
);
Input.displayName = "Input";
