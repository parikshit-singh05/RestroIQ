export function ForecastSkeleton() {
  return (
    <div className="max-w-[1120px] mx-auto animate-pulse pb-16" aria-label="Loading forecasts">
      <div className="mb-8">
        <div className="h-8 bg-[rgba(20,19,15,0.06)] rounded w-1/4 mb-3" />
        <div className="h-4 bg-[rgba(20,19,15,0.04)] rounded w-1/3" />
      </div>

      <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8 h-[300px]" />

      <div className="border-y border-[var(--color-hairline)] py-5 mb-8 flex justify-between">
        <div className="flex space-x-3">
          <div className="w-[140px] h-8 bg-[rgba(20,19,15,0.04)] rounded-md" />
          <div className="w-[140px] h-8 bg-[rgba(20,19,15,0.04)] rounded-md" />
          <div className="w-[140px] h-8 bg-[rgba(20,19,15,0.04)] rounded-md" />
        </div>
        <div className="w-[220px] h-8 bg-[rgba(20,19,15,0.04)] rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1 h-[220px] border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6" />
        <div className="lg:col-span-2 h-[220px] border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6" />
      </div>

      <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] h-[400px]" />
    </div>
  )
}