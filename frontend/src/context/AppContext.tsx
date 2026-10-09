import { createContext, useContext, useState, type ReactNode } from 'react'

type BufferValue = 0 | 10 | 15 | 20

interface AppContextType {
  buffer: BufferValue
  setBuffer: (b: BufferValue) => void
}

const AppContext = createContext<AppContextType>({
  buffer: 10,
  setBuffer: () => {},
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [buffer, setBuffer] = useState<BufferValue>(10)
  return (
    <AppContext.Provider value={{ buffer, setBuffer }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  return useContext(AppContext)
}

export type { BufferValue }