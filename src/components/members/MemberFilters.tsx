"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export default function MemberFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "ACTIVE";
  const role = searchParams.get("role") ?? "";
  const search = searchParams.get("search") ?? "";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Status dropdown */}
      <select
        value={status}
        onChange={(e) => updateParams("status", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">All Statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="ARCHIVED">Archived</option>
      </select>

      {/* Role dropdown */}
      <select
        value={role}
        onChange={(e) => updateParams("role", e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">All Roles</option>
        <option value="MEMBER">Member</option>
        <option value="PRESIDENT">President</option>
        <option value="VP">VP</option>
        <option value="SECRETARY">Secretary</option>
        <option value="TREASURER">Treasurer</option>
        <option value="ADMIN">Admin</option>
      </select>

      {/* Search input */}
      <input
        type="text"
        placeholder="Search name or category..."
        defaultValue={search}
        onChange={(e) => {
          // Debounce by using onBlur or a small delay
          const value = e.target.value;
          if (value.length === 0 || value.length >= 2) {
            updateParams("search", value);
          }
        }}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
      />
    </div>
  );
}
