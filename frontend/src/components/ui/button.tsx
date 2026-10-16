import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline-danger";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:brightness-110",
  secondary: "bg-surface-2 text-fg border border-border hover:border-muted/50",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  success: "bg-success text-white dark:text-[#03200f] hover:brightness-110",
  "outline-danger": "border border-danger/50 text-danger bg-danger-soft hover:bg-danger hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg font-medium whitespace-nowrap transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
