import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('wk_theme') || 'light');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(mode);
    localStorage.setItem('wk_theme', mode);
  }, [mode]);

  function toggle() {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ mode, toggle, isDark: mode === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
