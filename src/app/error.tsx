"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, ChevronDown } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log to console for dev; in production this could send to monitoring
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-slate-50">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-bni-amber-50 flex items-center justify-center text-bni-amber-600 mb-5">
          <AlertTriangle className="w-8 h-8" strokeWidth={2} />
        </div>

        <h1 className="text-title text-navy mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-500 mb-6">
          An unexpected error occurred. You can try again or head back to the
          homepage.
        </p>

        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-navy text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-navy-600 shadow-soft transition-colors"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2.5} />
            Try again
          </button>
          <a
            href="/chapter"
            className="inline-flex items-center justify-center gap-2 bg-white text-navy border border-slate-300 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Go home
          </a>
        </div>

        {/* Collapsible error details */}
        <div className="text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors mx-auto"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                showDetails ? "rotate-180" : ""
              }`}
              strokeWidth={2.5}
            />
            Technical details
          </button>
          {showDetails && (
            <div className="mt-3 p-3 rounded-lg bg-slate-100 text-[0.6875rem] font-mono text-slate-600 whitespace-pre-wrap break-all">
              {error.message}
              {error.digest && (
                <>
                  {"\n\nDigest: "}
                  <span className="text-slate-400">{error.digest}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
