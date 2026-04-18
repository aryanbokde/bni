import { ReactNode } from "react";

type Variant =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "navy"
  | "purple";

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-bni-blue-50 text-bni-blue-700 ring-bni-blue-200",
  green: "bg-bni-green-50 text-bni-green-600 ring-bni-green-100",
  amber: "bg-bni-amber-50 text-bni-amber-600 ring-bni-amber-100",
  red: "bg-bni-red-50 text-bni-red-600 ring-bni-red-100",
  navy: "bg-navy-50 text-navy-700 ring-navy-100",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
};

const SIZES = {
  sm: "text-[0.6875rem] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

export default function Badge({
  children,
  variant = "neutral",
  size = "md",
  icon,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-full
        ring-1 ring-inset whitespace-nowrap
        ${VARIANTS[variant]}
        ${SIZES[size]}
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
