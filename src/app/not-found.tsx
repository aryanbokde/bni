import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-slate-50">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-bni-blue-50 flex items-center justify-center text-bni-blue-600 mb-5">
          <Compass className="w-8 h-8" strokeWidth={2} />
        </div>

        <div className="text-6xl font-bold text-navy mb-2 leading-none">
          404
        </div>
        <h1 className="text-title text-navy mb-2">Page not found</h1>
        <p className="text-sm text-slate-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/chapter"
          className="inline-flex items-center justify-center gap-2 bg-navy text-white rounded-lg px-5 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-navy-600 shadow-soft transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
