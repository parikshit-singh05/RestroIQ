export function OverviewSkeleton() {
  return (
    <div className="w-full animate-pulse" aria-label="Loading overview">
      <div className="pt-6 lg:pt-10 mb-8 max-w-[800px]">
        <div className="h-6 w-24 bg-[var(--color-border)] rounded-md mb-4" />
        <div className="h-10 w-3/4 bg-[var(--color-border)] rounded-lg mb-4" />
        <div className="h-5 w-2/3 bg-[var(--color-border)]/50 rounded mb-2" />
      </div>

      <div className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="p-5 lg:p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
            <div className="h-3 w-1/2 bg-[var(--color-border-subtle)] rounded mb-4" />
            <div className="h-8 w-2/3 bg-[var(--color-border)] rounded mb-2" />
            <div className="h-3 w-1/3 bg-[var(--color-border-subtle)] rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="lg:col-span-2">
          <div className="h-[400px] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm p-6">
            <div className="h-5 w-1/3 bg-[var(--color-border-subtle)] rounded mb-2" />
            <div className="h-3 w-1/4 bg-[var(--color-border-subtle)] rounded" />
          </div>
        </div>
        <div className="flex flex-col space-y-8">
          <div className="h-[250px] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm p-5">
             <div className="h-5 w-1/2 bg-[var(--color-border-subtle)] rounded mb-6" />
             <div className="space-y-4">
               {[1,2,3].map(i => <div key={i} className="h-10 bg-[var(--color-border-subtle)] rounded" />)}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}