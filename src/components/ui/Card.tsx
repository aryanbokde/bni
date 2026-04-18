import { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "interactive";
}

const VARIANTS = {
  default: "bg-white border border-slate-100 shadow-soft",
  elevated: "bg-white shadow-medium border border-slate-100",
  outlined: "bg-white border border-slate-200",
  interactive:
    "bg-white border border-slate-100 shadow-soft hover:shadow-medium hover:border-slate-200 transition-all duration-normal cursor-pointer",
};

export default function Card({
  children,
  variant = "default",
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 pt-5 pb-3 border-b border-slate-100 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl ${className}`}>
      {children}
    </div>
  );
}
