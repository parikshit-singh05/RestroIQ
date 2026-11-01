import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../context/AuthContext'
import { useAppContext, type BufferValue } from '../../context/AppContext'
import {
  LayoutDashboard,
  UploadCloud,
  LineChart,
  Package,
  BarChart3,
  Building2,
  MapPin,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Sparkles,
  ExternalLink
} from 'lucide-react'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function TenantShell() {
  const {
    user,
    profile,
    restaurants,
    currentRestaurant,
    branches,
    currentBranch,
    userRole,
    signOut,
    selectRestaurant,
    selectBranch
  } = useAuth()

  const { buffer, setBuffer, theme, setTheme } = useAppContext()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setMobileMenuOpen(false)
    setUserDropdownOpen(false)
  }, [location.pathname])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  const NavContent = () => (
    <>
      <div className="px-6 mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm font-heading font-black text-lg">
            R
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-xl tracking-tight text-[var(--color-text)]">RestroIQ</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                SaaS
              </span>
            </div>
            <span className="block text-[10px] font-semibold text-[var(--color-text-tertiary)] truncate max-w-[130px]">
              {currentRestaurant?.name || 'My Restaurant'}
            </span>
          </div>
        </div>
      </div>

      {/* Switch to Demo Mode pill */}
      <div className="px-4 mb-4">
        <Link
          to="/overview"
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[12px] font-medium transition-all group"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Kaggle Demo</span>
          </div>
          <ExternalLink className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>

      <div className="px-4 mb-2">
        <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider px-3">
          Operations
        </span>
      </div>

      <nav className="space-y-1 px-3">
        <TenantNavItem to="/app/overview" icon={LayoutDashboard} label="Overview" />
        <TenantNavItem to="/app/upload" icon={UploadCloud} label="Upload POS Data" badge="Step 1" />
        <TenantNavItem to="/app/forecasts" icon={LineChart} label="Demand Forecasts" />
        <TenantNavItem to="/app/inventory" icon={Package} label="Prep & Buffers" />
        <TenantNavItem to="/app/analytics" icon={BarChart3} label="Analytics" />
      </nav>

      <div className="px-4 mt-6 mb-2">
        <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider px-3">
          Configuration
        </span>
      </div>

      <nav className="space-y-1 px-3">
        <TenantNavItem to="/app/onboarding" icon={Building2} label="Add Outlet / Branch" />
      </nav>

      <div className="mt-auto px-4 pt-6">
        <div className="p-3 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] text-[11px]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-[var(--color-text)]">Active Outlet</span>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              {userRole || 'owner'}
            </span>
          </div>
          <div className="text-[var(--color-text-secondary)] font-medium truncate">
            {currentBranch?.branch_name || 'All Outlets'}
          </div>
          <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
            Currency: {currentRestaurant?.currency || 'INR'} ({currentRestaurant?.currency_symbol || '₹'})
          </div>
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <nav className="relative flex flex-col w-72 max-w-[85%] bg-[var(--color-surface)] h-full shadow-2xl z-10">
            <div className="flex justify-end p-4">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col flex-grow py-4 overflow-y-auto">
              <NavContent />
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-grow min-w-0 bg-[var(--color-bg)] relative">
        {/* Top Header */}
        <header className="h-16 border-b border-[var(--color-border)] flex items-center px-4 lg:px-8 justify-between flex-shrink-0 bg-[var(--color-surface)]/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Restaurant Switcher */}
            {restaurants.length > 1 && (
              <div className="hidden sm:flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <select
                  value={currentRestaurant?.id || ''}
                  onChange={(e) => selectRestaurant(e.target.value)}
                  className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text)] outline-none cursor-pointer hover:border-[var(--color-accent)] transition-colors max-w-[170px] truncate"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Branch Switcher */}
            {branches.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <select
                  value={currentBranch?.id || ''}
                  onChange={(e) => selectBranch(e.target.value || null)}
                  className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text)] outline-none cursor-pointer hover:border-[var(--color-accent)] transition-colors max-w-[190px] truncate"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Prep Buffer Selector */}
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Buffer
              </span>
              <div className="flex items-center bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
                {([0, 10, 15, 20] as BufferValue[]).map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setBuffer(pct)}
                    className={cn(
                      "px-2.5 py-1 text-[12px] font-semibold rounded-md transition-all duration-150 outline-none cursor-pointer",
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
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors outline-none cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* User Profile / Menu */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[12px] font-bold">
                  {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline-block text-[12px] font-semibold text-[var(--color-text)] max-w-[120px] truncate">
                  {profile?.full_name || user?.email?.split('@')[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-[var(--color-border-subtle)]">
                    <p className="text-[13px] font-bold text-[var(--color-text)] truncate">
                      {profile?.full_name || 'Restaurant Manager'}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                      {user?.email}
                    </p>
                    <div className="mt-1.5 inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Role: {userRole || 'owner'}
                    </div>
                  </div>

                  <Link
                    to="/overview"
                    className="flex items-center gap-2 px-4 py-2 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>View Demo Workspace</span>
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Routed Page Outlet */}
        <main className="flex-grow overflow-auto custom-scrollbar relative w-full">
          <div className="p-4 lg:p-8 min-h-full flex flex-col max-w-[1280px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function TenantNavItem({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
          isActive
            ? "bg-[var(--color-surface-alt)] text-emerald-400 border border-[var(--color-border)] shadow-xs"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]/50"
        )
      }
    >
      <div className="flex items-center space-x-3">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </div>
      {badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          {badge}
        </span>
      )}
    </NavLink>
  )
}
