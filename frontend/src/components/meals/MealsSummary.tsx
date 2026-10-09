export function MealsSummary({ data, totalMeals }: { data: any[], totalMeals: number }) {
  if (!data.length) return null

  const distinctCat = new Set(data.map(d => d.category)).size
  const distinctCui = new Set(data.map(d => d.cuisine)).size
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Menu Items</p>
        <div className="flex items-baseline space-x-2">
          <p className="text-[32px] font-heading font-bold tabular-nums text-[var(--color-text)] leading-none">{data.length}</p>
          {data.length !== totalMeals && (
            <span className="text-[13px] font-bold text-[var(--color-text-tertiary)]">of {totalMeals}</span>
          )}
        </div>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Categories</p>
        <p className="text-[32px] font-heading font-bold tabular-nums text-[var(--color-text)] leading-none">{distinctCat}</p>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Cuisines</p>
        <p className="text-[32px] font-heading font-bold tabular-nums text-[var(--color-text)] leading-none">{distinctCui}</p>
      </div>
    </div>
  )
}