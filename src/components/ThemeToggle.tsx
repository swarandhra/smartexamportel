import { Moon, Sun } from 'lucide-react';
import type { Theme } from '../utils/theme';

export default function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" onClick={onToggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
    </button>
  );
}
