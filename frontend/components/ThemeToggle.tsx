'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => { setTheme((document.documentElement.dataset.theme as 'light' | 'dark') || 'light'); }, []);
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next; try { localStorage.setItem('blushcam-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };
  return <button className="btn-ghost !p-2" onClick={toggle} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>;
}
