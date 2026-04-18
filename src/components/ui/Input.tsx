"use client";

import { forwardRef, InputHTMLAttributes, ReactNode, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, leftIcon, rightIcon, className = "", id, ...props }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-caption font-semibold text-slate-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined
            }
            className={`
              w-full rounded-lg border bg-white text-sm
              min-h-[44px] py-2.5
              transition-all duration-normal ease-smooth
              placeholder:text-slate-400
              focus:outline-none focus:ring-4
              disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
              ${leftIcon ? "pl-10" : "pl-3.5"}
              ${rightIcon ? "pr-10" : "pr-3.5"}
              ${
                hasError
                  ? "border-bni-red focus:border-bni-red focus:ring-bni-red/15"
                  : "border-slate-300 focus:border-bni-blue focus:ring-bni-blue/15"
              }
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-bni-red font-medium">
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-slate-500">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
