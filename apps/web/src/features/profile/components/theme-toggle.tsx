import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemePreference } from '@/services/theme.service';

const OPTIONS: { value: ThemePreference; label: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-fx-surface border border-fx-border rounded-2xl p-4">
      <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
        Appearance
      </p>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex-1 h-10 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                isActive
                  ? 'bg-fx-orange/10 border-fx-orange/40 text-fx-orange'
                  : 'bg-fx-surface-2 border-fx-border text-fx-text-dim hover:border-zinc-600'
              }`}
            >
              <Icon size={14} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
