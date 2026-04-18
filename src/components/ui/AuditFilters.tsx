"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { RotateCcw } from "lucide-react";

export default function AuditFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const entityType = searchParams.get("entityType") ?? "";
  const fromDate = searchParams.get("fromDate") ?? "";
  const toDate = searchParams.get("toDate") ?? "";

  const hasFilters = entityType || fromDate || toDate;

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // reset page on filter change
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const resetAll = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <div className="min-w-[180px]">
        <label
          htmlFor="entity-type"
          className="block text-[0.6875rem] uppercase tracking-wider font-semibold text-slate-500 mb-1.5"
        >
          Entity Type
        </label>
        <select
          id="entity-type"
          value={entityType}
          onChange={(e) => updateParam("entityType", e.target.value)}
          className="input-field"
        >
          <option value="">All Entities</option>
          <option value="members">Members</option>
          <option value="chapters">Chapters</option>
          <option value="shareable_fields">Shareable Fields</option>
          <option value="recommendations">Recommendations</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="from-date"
          className="block text-[0.6875rem] uppercase tracking-wider font-semibold text-slate-500 mb-1.5"
        >
          From
        </label>
        <input
          id="from-date"
          type="date"
          value={fromDate}
          onChange={(e) => updateParam("fromDate", e.target.value)}
          className="input-field"
        />
      </div>

      <div>
        <label
          htmlFor="to-date"
          className="block text-[0.6875rem] uppercase tracking-wider font-semibold text-slate-500 mb-1.5"
        >
          To
        </label>
        <input
          id="to-date"
          type="date"
          value={toDate}
          onChange={(e) => updateParam("toDate", e.target.value)}
          className="input-field"
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-navy hover:bg-slate-100 rounded-md transition-colors min-h-[44px]"
        >
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} />
          Reset filters
        </button>
      )}
    </div>
  );
}
