export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 shimmer rounded-lg" />
        <div className="h-4 w-64 shimmer rounded" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-white border border-slate-100 p-5"
          >
            <div className="w-9 h-9 rounded-lg shimmer mb-3" />
            <div className="h-8 w-16 shimmer rounded mb-2" />
            <div className="h-3 w-20 shimmer rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="rounded-xl bg-white border border-slate-100 p-5 space-y-3">
        <div className="h-5 w-40 shimmer rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 shimmer rounded" />
              <div className="h-3 w-1/2 shimmer rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
