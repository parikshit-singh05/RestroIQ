export function OverviewSkeleton() {
  return (
    <div className="max-w-[1120px] mx-auto animate-pulse" aria-label="Loading overview">
      {/* Headline skeleton */}
      <div className="mb-10 max-w-[760px]">
        <div className="h-8 bg-[rgba(20,19,15,0.06)] rounded w-4/5 mb-3" />
        <div className="h-4 bg-[rgba(20,19,15,0.04)] rounded w-2/3 mb-4" />
        <div className="h-4 bg-[rgba(20,19,15,0.04)] rounded w-3/5" />
      </div>

      {/* Chart skeleton */}
      <div className="mb-8 border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6">
        <div className="h-4 bg-[rgba(20,19,15,0.06)] rounded w-1/3 mb-2" />
        <div className="h-3 bg-[rgba(20,19,15,0.04)] rounded w-1/4 mb-5" />
        <div className="h-[340px] bg-[rgba(20,19,15,0.03)] rounded" />
      </div>

      {/* Numbers strip skeleton */}
      <div className="mb-10 grid grid-cols-4 border-y border-[var(--color-hairline)] divide-x divide-[var(--color-hairline)]">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="py-5 px-6">
            <div className="h-3 bg-[rgba(20,19,15,0.04)] rounded w-2/3 mb-3" />
            <div className="h-7 bg-[rgba(20,19,15,0.06)] rounded w-1/2 mb-2" />
            <div className="h-2.5 bg-[rgba(20,19,15,0.03)] rounded w-1/3" />
          </div>
        ))}
      </div>

      {/* Needs attention skeleton */}
      <div className="mb-8">
        <div className="h-4 bg-[rgba(20,19,15,0.06)] rounded w-1/4 mb-4" />
        <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] divide-y divide-[var(--color-hairline)]">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="py-3.5 px-4 flex items-center space-x-4">
              <div className="h-4 w-4 bg-[rgba(20,19,15,0.04)] rounded" />
              <div className="flex-1">
                <div className="h-3.5 bg-[rgba(20,19,15,0.06)] rounded w-1/3 mb-1.5" />
                <div className="h-2.5 bg-[rgba(20,19,15,0.03)] rounded w-1/4" />
              </div>
              <div className="h-4 bg-[rgba(20,19,15,0.05)] rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}