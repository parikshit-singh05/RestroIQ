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
  const { buffer, setBuffer, theme, setTheme } = useAppContext()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const NavContent = () => (
    <>
      <div className="mb-8">
        <div className="px-6 text-[11px] font-bold tracking-[0.15em] text-[var(--color-text-tertiary)] uppercase mb-3">Workflow</div>
        <div className="flex flex-col space-y-1 px-3">
          <NavItem to="/overview" icon={LayoutDashboard} label="Overview" />
          <NavItem to="/forecasts" icon={LineChart} label="Forecasts" />
          <NavItem to="/inventory" icon={Package} label="Inventory" />
        </div>
      </div>
      <div>
        <div className="px-6 text-[11px] font-bold tracking-[0.15em] text-[var(--color-text-tertiary)] uppercase mb-3">Explore</div>
        <div className="flex flex-col space-y-1 px-3">
          <NavItem to="/analytics" icon={BarChart3} label="Analytics" />
          <NavItem to="/centers" icon={Building2} label="Centers" />
          <NavItem to="/meals" icon={UtensilsCrossed} label="Meals" />
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen w-full bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden selection:bg-[var(--color-accent)] selection:text-white">
      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex w-[260px] flex-shrink-0 border-r border-[var(--color-border)] flex-col bg-[var(--color-surface)] z-20">
        <div className="h-16 flex items-center px-6 border-b border-[var(--color-border)]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center shadow-sm">
              <span className="text-white font-heading font-bold text-sm leading-none">R</span>
            </div>
            <h1 className="font-heading font-bold text-lg tracking-tight text-[var(--color-text)] leading-none">RestroIQ</h1>
          </div>
        </div>

        <div className="flex flex-col flex-grow py-6 overflow-y-auto custom-scrollbar">
          <NavContent />
        </div>

        <div className="p-4 border-t border-[var(--color-border-subtle)]">
          <div className="p-3 rounded-lg bg-[var(--color-surface-alt)] flex items-center space-x-3 border border-[var(--color-border-subtle)]">
            <div className="w-8 h-8 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center text-xs font-bold">OP</div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold text-[var(--color-text)] leading-tight truncate">Operations</span>
              <span className="text-[11px] font-medium text-[var(--color-text-secondary)] leading-tight">System Admin</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <nav className="relative w-[280px] h-full bg-[var(--color-surface)] flex flex-col shadow-2xl">
            <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--color-border)]">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center">
                  <span className="text-white font-heading font-bold text-sm leading-none">R</span>
                </div>
                <h1 className="font-heading font-bold text-lg tracking-tight text-[var(--color-text)] leading-none">RestroIQ</h1>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
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
                  <select className="appearance-none bg-transparent text-[13px] font-semibold text-[var(--color-text)] outline-none cursor-pointer hover:text-[var(--color-accent)] transition-colors">
                    <option>All Centers</option>
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

function ContextItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center space-x-2">
      <Icon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider leading-none mb-0.5">{label}</span>
        <span className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight leading-none">{value}</span>
      </div>
    </div>
  )
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "group relative flex items-center space-x-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 outline-none",
        isActive
          ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[var(--color-accent)] rounded-r-full" />
          )}
          <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]")} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
