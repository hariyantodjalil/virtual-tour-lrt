import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#D81435] text-white",
        secondary: "border-transparent bg-gray-100 text-gray-800",
        available: "border-transparent bg-emerald-100 text-emerald-800 border-emerald-200",
        occupied: "border-transparent bg-red-100 text-red-800 border-red-200",
        maintenance: "border-transparent bg-amber-100 text-amber-800 border-amber-200",
        outline: "text-gray-600 border-gray-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
