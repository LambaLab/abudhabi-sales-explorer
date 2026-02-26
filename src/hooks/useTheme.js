import { useState, useEffect } from 'react'

/**
 * Light/dark theme toggle. Light is the default.
 * Persists to localStorage under 'theme'.
 * Toggles the 'dark' class on <html>.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') ?? 'light' } catch { return 'light' }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return { theme, toggle }
}
