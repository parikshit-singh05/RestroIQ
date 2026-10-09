export function ForecastSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="pt-6 lg:pt-8 mb-8 max-w-[800px]">
        <div className="h-8 w-1/3 bg-[var(--color-border)] rounded-lg mb-2" />
        <div className="h-4 w-1/2 bg-[var(--color-border)]/50 rounded" />
      </div>

      <div className="h-24 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-8" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="h-[300px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
        <div className="lg:col-span-2 space-y-6">
           <div className="h-[250px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
           <div className="h-[250px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
        </div>
      </div>
    </div>
  )
}