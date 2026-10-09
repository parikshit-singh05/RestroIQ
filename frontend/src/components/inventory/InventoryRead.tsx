import { FileText } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

export function InventoryRead({ data }: { data: any[] }) {
  const { buffer } = useAppContext()
  const totalDemand = data.reduce((s, d) => s + d.predicted_orders, 0)
  
  if (totalDemand === 0) return null

  return (
    <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] rounded-xl p-5">
      <div className="flex items-center space-x-2 mb-4">
        <FileText className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-bold text-[var(--color-text)] uppercase tracking-wider">Action Plan</h3>
      </div>
      <ul className="space-y-3.5">
        <li className="flex items-start text-[13px] font-medium text-[var(--color-text-secondary)] leading-relaxed">
          <span className="text-[var(--color-accent)] mr-2.5 mt-0.5 opacity-70">•</span>
          <span>Ensure baseline inventory covers <strong>{totalDemand.toLocaleString('en-IN')}</strong> base orders.</span>
        </li>
        <li className="flex items-start text-[13px] font-medium text-[var(--color-text-secondary)] leading-relaxed">
          <span className="text-[var(--color-accent)] mr-2.5 mt-0.5 opacity-70">•</span>
          <span>Procure additional <strong>{buffer}%</strong> perishable stock to cover local variance.</span>
        </li>
        <li className="flex items-start text-[13px] font-medium text-[var(--color-text-secondary)] leading-relaxed">
          <span className="text-[var(--color-accent)] mr-2.5 mt-0.5 opacity-70">•</span>
          <span>Alert supply chain regarding top 3 centers driving majority of required volume.</span>
        </li>
      </ul>
    </div>
  )
}