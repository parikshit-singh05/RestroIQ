import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type BufferValue = 0 | 10 | 15 | 20
type ThemeValue = 'light' | 'dark'

interface AppContextType {
  buffer: BufferValue
  setBuffer: (b: BufferValue) => void
  theme: ThemeValue
  setTheme: (t: ThemeValue) => void
}

const AppContext = createContext<AppContextType>({
  buffer: 10,
  setBuffer: () => {},
  theme: 'light',
  setTheme: () => {}
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [buffer, setBuffer] = useState<BufferValue>(10)
  
  const [theme, setThemeState] = useState<ThemeValue>(() => {
    const saved = localStorage.getItem('restroiq_theme') as ThemeValue
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('restroiq_theme', theme)
  }, [theme])

  const setTheme = (t: ThemeValue) => setThemeState(t)

  return (
    <AppContext.Provider value={{ buffer, setBuffer, theme, setTheme }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  return useContext(AppContext)
}

export type { BufferValue, ThemeValue }