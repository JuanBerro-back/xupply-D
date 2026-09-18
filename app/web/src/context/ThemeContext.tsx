import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  isHighContrast: boolean;
  toggleDarkMode: () => void;
  toggleHighContrast: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('xupply_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('xupply_high_contrast') === 'true';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('xupply_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('xupply_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (isHighContrast) {
      root.classList.add('high-contrast');
      localStorage.setItem('xupply_high_contrast', 'true');
    } else {
      root.classList.remove('high-contrast');
      localStorage.setItem('xupply_high_contrast', 'false');
    }
  }, [isHighContrast]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const toggleHighContrast = () => setIsHighContrast((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDarkMode, isHighContrast, toggleDarkMode, toggleHighContrast }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider');
  }
  return context;
}
