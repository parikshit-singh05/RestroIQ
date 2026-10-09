export function InventorySkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="pt-6 lg:pt-8 mb-8 max-w-[800px]">
        <div className="h-8 w-1/3 bg-[var(--color-border)] rounded-lg mb-2" />
        <div className="h-4 w-1/2 bg-[var(--color-border)]/50 rounded" />
      </div>

      <div className="h-16 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-6" />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1,2,3].map(i => <div key={i} className="h-28 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="lg:col-span-2">
           <div className="h-[400px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
        </div>
        <div className="space-y-6">
           <div className="h-[250px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
           <div className="h-[200px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
        </div>
      </div>
    </div>
  )
}