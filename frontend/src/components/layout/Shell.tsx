import { Outlet, NavLink } from 'react-router-dom'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAppContext, type BufferValue } from '../../context/AppContext'
import {
  Calendar,
  MapPin,
  LayoutDashboard,
  LineChart,
  Package,
  BarChart3,
  Building2,
  UtensilsCrossed,
} from 'lucide-react'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function Shell() {
  const { buffer, setBuffer } = useAppContext()

  return (
    <div className="flex h-screen w-full bg-[var(--color-canvas)] text-[var(--color-ink)] overflow-hidden font-sans selection:bg-[var(--color-brand)] selection:text-white">
      {/* Left Rail */}
      <nav className="w-64 flex-shrink-0 border-r border-[var(--color-hairline)] flex flex-col bg-[var(--color-canvas)] z-20 relative">
        <div className="h-20 flex items-center px-8 border-b border-[var(--color-hairline)]">
          <div className="flex items-baseline space-x-2">
            <h1 className="font-serif text-3xl tracking-tight text-[var(--color-brand)] leading-none">RestroIQ</h1>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-growth)] animate-pulse" title="System live"></div>
          </div>
        </div>

        <div className="flex flex-col flex-grow py-8 overflow-y-auto custom-scrollbar">
          <div className="mb-8">
            <div className="px-8 text-[11px] font-semibold tracking-[0.15em] text-[var(--color-ink-secondary)] uppercase mb-3">Workflow</div>
            <div className="flex flex-col space-y-0.5 px-4">
              <NavItem to="/overview" icon={LayoutDashboard} label="Overview" />
              <NavItem to="/forecasts" icon={LineChart} label="Forecasts" />
              <NavItem to="/inventory" icon={Package} label="Inventory" />
            </div>
          </div>
          <div>
            <div className="px-8 text-[11px] font-semibold tracking-[0.15em] text-[var(--color-ink-secondary)] uppercase mb-3">Explore</div>
            <div className="flex flex-col space-y-0.5 px-4">
              <NavItem to="/analytics" icon={BarChart3} label="Analytics" />
              <NavItem to="/centers" icon={Building2} label="Centers" />
              <NavItem to="/meals" icon={UtensilsCrossed} label="Meals" />
            </div>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div className="p-3 rounded-lg bg-[rgba(20,19,15,0.03)] border border-[var(--color-hairline)] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center text-xs font-semibold">OP</div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium leading-tight truncate">Operations</span>
              <span className="text-[11px] text-[var(--color-ink-secondary)] leading-tight">System Admin</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex flex-col flex-grow min-w-0 bg-[var(--color-canvas)]">
        {/* Context bar */}
        <header className="h-16 border-b border-[var(--color-hairline)] flex items-center px-10 justify-between flex-shrink-0 bg-[rgba(255,255,255,0.5)] backdrop-blur-sm z-10">
          <div className="flex items-center space-x-8">
            <ContextItem icon={Calendar} label="Horizon" value="Weeks 146 - 155" />
            <div className="w-px h-6 bg-[var(--color-hairline)]" />
            <div className="flex items-center space-x-2.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--color-ink-secondary)]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-[var(--color-ink-secondary)] uppercase tracking-wider leading-none mb-1">Scope</span>
                <select className="appearance-none bg-transparent text-[13px] font-semibold outline-none cursor-pointer hover:text-[var(--color-brand)] transition-colors">
                  <option>All Centers</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-medium text-[var(--color-ink-secondary)] uppercase tracking-wider">Buffer</span>
            <div className="flex items-center bg-[rgba(20,19,15,0.04)] p-0.5 rounded-md">
              {([0, 10, 15, 20] as BufferValue[]).map((pct) => (
                <button
                  key={pct}
                  onClick={() => setBuffer(pct)}
                  className={cn(
                    "px-3 py-1 text-[13px] font-medium rounded transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 cursor-pointer",
                    buffer === pct
                      ? "bg-[var(--color-surface)] text-[var(--color-brand)] shadow-[0_1px_2px_rgba(20,19,15,0.06)]"
                      : "text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]"
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-grow overflow-auto custom-scrollbar relative">
          <div className="px-10 pb-8 min-h-full flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function ContextItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center space-x-2.5">
      <Icon className="w-3.5 h-3.5 text-[var(--color-ink-secondary)]" />
      <div className="flex flex-col">
        <span className="text-[10px] font-medium text-[var(--color-ink-secondary)] uppercase tracking-wider leading-none mb-1">{label}</span>
        <span className="text-[13px] font-semibold tracking-tight leading-none">{value}</span>
      </div>
    </div>
  )
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "group flex items-center space-x-3 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 outline-none",
        isActive
          ? "bg-[var(--color-surface)] text-[var(--color-brand)] shadow-[0_1px_2px_rgba(20,19,15,0.04)] border border-[var(--color-hairline)]"
          : "text-[var(--color-ink-secondary)] hover:bg-[rgba(20,19,15,0.04)] hover:text-[var(--color-ink)] border border-transparent"
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-[var(--color-brand)]" : "text-[var(--color-ink-secondary)] group-hover:text-[var(--color-ink)]")} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}