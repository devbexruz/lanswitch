import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'default' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('default');

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'default' ? 'light' : 'default'));
    // In a real app we might switch class names on the body or :root here
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
