"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-navy text-white hover:bg-navy-600 active:bg-navy-800 shadow-soft hover:shadow-medium",
  secondary:
    "bg-white text-navy border border-slate-300 hover:bg-slate-50 active:bg-slate-100 shadow-soft",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200",
  danger:
    "bg-bni-red text-white hover:bg-bni-red-600 shadow-soft hover:shadow-medium",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs min-h-[36px] rounded-md gap-1.5",
  md: "px-4 py-2.5 text-sm min-h-[44px] rounded-lg gap-2",
  lg: "px-5 py-3 text-base min-h-[52px] rounded-lg gap-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-normal ease-smooth
          focus:outline-none focus-visible:ring-4 focus-visible:ring-bni-blue/25
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
          ${VARIANTS[variant]}
          ${SIZES[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
