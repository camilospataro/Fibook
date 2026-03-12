import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ThemeId = 1 | 2 | 3;

const STORAGE_KEY = 'fibook-theme';

const themes: Record<ThemeId, { name: string; description: string; preview: string[]; vars: Record<string, string> }> = {
  1: {
    name: 'Cyber Fintech',
    description: 'Neon teal, sharp dark panels',
    preview: ['#00D4AA', '#4F8EF7', '#FF6B6B'],
    vars: {
      '--radius': '0.625rem',
      '--background': '#0A0F1E',
      '--foreground': '#E8ECF4',
      '--card': '#111827',
      '--card-foreground': '#E8ECF4',
      '--popover': '#111827',
      '--popover-foreground': '#E8ECF4',
      '--primary': '#00D4AA',
      '--primary-foreground': '#0A0F1E',
      '--secondary': '#1E293B',
      '--secondary-foreground': '#E8ECF4',
      '--muted': '#1E293B',
      '--muted-foreground': '#94A3B8',
      '--accent': '#4F8EF7',
      '--accent-foreground': '#E8ECF4',
      '--destructive': '#FF6B6B',
      '--destructive-foreground': '#E8ECF4',
      '--border': '#1E293B',
      '--input': '#1E293B',
      '--ring': '#00D4AA',
      '--chart-1': '#00D4AA',
      '--chart-2': '#4F8EF7',
      '--chart-3': '#FF6B6B',
      '--chart-4': '#FBBF24',
      '--chart-5': '#A78BFA',
      '--sidebar': '#0D1321',
      '--sidebar-foreground': '#94A3B8',
      '--sidebar-primary': '#00D4AA',
      '--sidebar-primary-foreground': '#0A0F1E',
      '--sidebar-accent': '#1E293B',
      '--sidebar-accent-foreground': '#E8ECF4',
      '--sidebar-border': '#1E293B',
      '--sidebar-ring': '#00D4AA',
      '--income': '#00D4AA',
      '--expense': '#FF6B6B',
      '--warning': '#FBBF24',
      '--info': '#4F8EF7',
    },
  },
  2: {
    name: 'Glass Luxe',
    description: 'Frosted glass, soft gradients, purple tones',
    preview: ['#A78BFA', '#F472B6', '#34D399'],
    vars: {
      '--radius': '1rem',
      '--background': '#0C0A1D',
      '--foreground': '#EDE9FE',
      '--card': 'rgba(139, 92, 246, 0.08)',
      '--card-foreground': '#EDE9FE',
      '--popover': 'rgba(139, 92, 246, 0.12)',
      '--popover-foreground': '#EDE9FE',
      '--primary': '#A78BFA',
      '--primary-foreground': '#0C0A1D',
      '--secondary': 'rgba(139, 92, 246, 0.12)',
      '--secondary-foreground': '#C4B5FD',
      '--muted': 'rgba(139, 92, 246, 0.08)',
      '--muted-foreground': '#8B8AA0',
      '--accent': '#F472B6',
      '--accent-foreground': '#EDE9FE',
      '--destructive': '#FB7185',
      '--destructive-foreground': '#EDE9FE',
      '--border': 'rgba(139, 92, 246, 0.18)',
      '--input': 'rgba(139, 92, 246, 0.12)',
      '--ring': '#A78BFA',
      '--chart-1': '#A78BFA',
      '--chart-2': '#F472B6',
      '--chart-3': '#FB7185',
      '--chart-4': '#FBBF24',
      '--chart-5': '#34D399',
      '--sidebar': 'rgba(12, 10, 29, 0.95)',
      '--sidebar-foreground': '#8B8AA0',
      '--sidebar-primary': '#A78BFA',
      '--sidebar-primary-foreground': '#0C0A1D',
      '--sidebar-accent': 'rgba(139, 92, 246, 0.15)',
      '--sidebar-accent-foreground': '#EDE9FE',
      '--sidebar-border': 'rgba(139, 92, 246, 0.15)',
      '--sidebar-ring': '#A78BFA',
      '--income': '#34D399',
      '--expense': '#FB7185',
      '--warning': '#FBBF24',
      '--info': '#A78BFA',
    },
  },
  3: {
    name: 'Midnight Mono',
    description: 'Crisp minimal, high contrast, monospace feel',
    preview: ['#F59E0B', '#22D3EE', '#EF4444'],
    vars: {
      '--radius': '0.375rem',
      '--background': '#09090B',
      '--foreground': '#FAFAFA',
      '--card': '#18181B',
      '--card-foreground': '#FAFAFA',
      '--popover': '#18181B',
      '--popover-foreground': '#FAFAFA',
      '--primary': '#F59E0B',
      '--primary-foreground': '#09090B',
      '--secondary': '#27272A',
      '--secondary-foreground': '#A1A1AA',
      '--muted': '#27272A',
      '--muted-foreground': '#71717A',
      '--accent': '#22D3EE',
      '--accent-foreground': '#09090B',
      '--destructive': '#EF4444',
      '--destructive-foreground': '#FAFAFA',
      '--border': '#3F3F46',
      '--input': '#27272A',
      '--ring': '#F59E0B',
      '--chart-1': '#F59E0B',
      '--chart-2': '#22D3EE',
      '--chart-3': '#EF4444',
      '--chart-4': '#A3E635',
      '--chart-5': '#E879F9',
      '--sidebar': '#0A0A0C',
      '--sidebar-foreground': '#71717A',
      '--sidebar-primary': '#F59E0B',
      '--sidebar-primary-foreground': '#09090B',
      '--sidebar-accent': '#27272A',
      '--sidebar-accent-foreground': '#FAFAFA',
      '--sidebar-border': '#3F3F46',
      '--sidebar-ring': '#F59E0B',
      '--income': '#22C55E',
      '--expense': '#EF4444',
      '--warning': '#F59E0B',
      '--info': '#22D3EE',
    },
  },
};

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  const vars = themes[id].vars;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  const body = document.body;
  body.classList.remove('theme-cyber', 'theme-glass', 'theme-mono');
  if (id === 1) body.classList.add('theme-cyber');
  if (id === 2) body.classList.add('theme-glass');
  if (id === 3) body.classList.add('theme-mono');
}

/** Apply saved theme on app load (call once from AppLayout) */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && [1, 2, 3].includes(Number(saved))) {
    applyTheme(Number(saved) as ThemeId);
  }
}

/** Settings section component */
export default function ThemeSettings() {
  const [active, setActive] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && [1, 2, 3].includes(Number(saved)) ? (Number(saved) as ThemeId) : 1;
  });

  useEffect(() => {
    applyTheme(active);
    localStorage.setItem(STORAGE_KEY, String(active));
  }, [active]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Theme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {([1, 2, 3] as ThemeId[]).map(id => {
          const t = themes[id];
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-secondary/30 hover:bg-secondary/60'
              }`}
            >
              <div className="flex gap-1">
                {t.preview.map((c, i) => (
                  <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{t.description}</p>
              </div>
              {isActive && (
                <span className="text-xs text-primary font-medium">Active</span>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
