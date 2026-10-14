import { Outlet, NavLink } from 'react-router-dom'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useQuery } from '@tanstack/react-query'
import { useAppContext, type BufferValue } from '../../context/AppContext'
import { getCenters } from '../../lib/api'
import {
  Calendar,
  MapPin,
  LayoutDashboard,
  LineChart,
  Package,
  BarChart3,
  Building2,
  UtensilsCrossed,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function Shell() {
  const { buffer, setBuffer, theme, setTheme, scopeCenterId, setScopeCenterId } = useAppContext()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const { data: centers } = useQuery({
    queryKey: ['centers'],
    queryFn: getCenters,
    staleTime: 10 * 60 * 1000
  })

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const NavContent = () => (
    <>
      <div className="px-6 mb-8 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white shadow-sm font-heading font-black text-lg">
          R
        </div>
        <div>
          <span className="font-heading font-black text-xl tracking-tight text-[var(--color-text)]">RestroIQ</span>
          <span className="block text-[10px] font-bold text-[var(--color-accent)] tracking-widest uppercase">Ops Intel</span>
        </div>
      </div>

      <div className="px-4 mb-2">
        <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider px-3">
          Platform
        </span>
      </div>

      <nav className="space-y-1 px-3">
        <NavItem to="/overview" icon={LayoutDashboard} label="Overview" />
        <NavItem to="/forecasts" icon={LineChart} label="Forecasts" />
        <NavItem to="/inventory" icon={Package} label="Inventory" />
        <NavItem to="/analytics" icon={BarChart3} label="Analytics" />
      </nav>

      <div className="px-4 mt-8 mb-2">
        <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider px-3">
          Entities
        </span>
      </div>

      <nav className="space-y-1 px-3">
        <NavItem to="/centers" icon={Building2} label="Centers" />
        <NavItem to="/meals" icon={UtensilsCrossed} label="Meals" />
      </nav>

      <div className="mt-auto px-6 pt-6">
        <div className="p-3 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-secondary)]">
          <div className="font-bold text-[var(--color-text)] mb-1">Production Pilot</div>
          <div>Forecasting Horizon: 10 Weeks (W146-W155). 77 Centers &bull; 51 Meals.</div>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex text-[var(--color-text)] font-sans antialiased">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] py-6 flex-shrink-0 z-20">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <nav className="relative flex flex-col w-72 max-w-[80%] bg-[var(--color-surface)] h-full shadow-2xl z-10">
            <div className="flex justify-end p-4">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col flex-grow py-6 overflow-y-auto">
              <NavContent />
            </div>
          </nav>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-grow min-w-0 bg-[var(--color-bg)] relative">
        {/* Header */}
        <header className="h-16 border-b border-[var(--color-border)] flex items-center px-4 lg:px-8 justify-between flex-shrink-0 bg-[var(--color-surface)]/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center">
            <button
              className="lg:hidden p-2 mr-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center space-x-6">
              <ContextItem icon={Calendar} label="Horizon" value="Weeks 146 - 155" />
              <div className="w-px h-6 bg-[var(--color-border)]" />
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider leading-none mb-0.5">Scope</span>
                  <select
                    value={scopeCenterId ?? ''}
                    onChange={(e) => setScopeCenterId(e.target.value ? Number(e.target.value) : null)}
                    className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[12px] font-semibold text-[var(--color-text)] outline-none cursor-pointer hover:border-[var(--color-accent)] transition-colors max-w-[190px] truncate"
                    aria-label="Global fulfillment center scope"
                  >
                    <option value="">All Centers (Network)</option>
                    {(centers || []).map((c) => (
                      <option key={c.center_id} value={c.center_id}>
                        Center {c.center_id} ({c.simulated_city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 lg:space-x-6">
            {/* Buffer Selector */}
            <div className="flex items-center space-x-3">
              <span className="hidden md:inline-block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Buffer</span>
              <div className="flex items-center bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
                {([0, 10, 15, 20] as BufferValue[]).map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setBuffer(pct)}
                    className={cn(
                      "px-2.5 py-1 text-[13px] font-semibold rounded-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] cursor-pointer",
                      buffer === pct
                        ? "bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm border border-[var(--color-border)]"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-transparent"
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-6 bg-[var(--color-border)]" />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-grow overflow-auto custom-scrollbar relative w-full">
          <div className="p-4 lg:p-8 min-h-full flex flex-col max-w-[1200px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center space-x-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
          isActive
            ? "bg-[var(--color-surface-alt)] text-[var(--color-accent)] border border-[var(--color-border)] shadow-xs"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]/50"
        )
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

function ContextItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center space-x-2">
      <Icon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider leading-none mb-0.5">{label}</span>
        <span className="text-[13px] font-semibold text-[var(--color-text)] leading-none">{value}</span>
      </div>
    </div>
  )
}
