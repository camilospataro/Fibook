import { useState, useEffect } from 'react';

type ThemeId = 1 | 2 | 3;

const themes: Record<ThemeId, { name: string; description: string; vars: Record<string, string> }> = {
  1: {
    name: 'Cyber Fintech',
    description: 'Current — neon teal, sharp dark panels',
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
      // Design style tokens
      '--card-shadow': 'none',
      '--card-border-width': '1px',
      '--card-backdrop': 'none',
      '--heading-weight': '700',
      '--card-border-style': 'solid',
    },
  },
  2: {
    name: 'Glass Luxe',
    description: 'Frosted glass, soft gradients, purple tones',
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
      // Design style tokens
      '--card-shadow': '0 8px 32px rgba(139, 92, 246, 0.1)',
      '--card-border-width': '1px',
      '--card-backdrop': 'blur(12px)',
      '--heading-weight': '600',
      '--card-border-style': 'solid',
    },
  },
  3: {
    name: 'Midnight Mono',
    description: 'Crisp minimal, high contrast, monospace feel',
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
      // Design style tokens
      '--card-shadow': 'none',
      '--card-border-width': '1px',
      '--card-backdrop': 'none',
      '--heading-weight': '800',
      '--card-border-style': 'solid',
    },
  },
};

export default function ThemeSwitcher() {
  const [active, setActive] = useState<ThemeId>(1);

  useEffect(() => {
    const root = document.documentElement;
    const vars = themes[active].vars;

    // Apply all CSS variables
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    // Apply design-style classes on body
    const body = document.body;
    body.classList.remove('theme-cyber', 'theme-glass', 'theme-mono');
    if (active === 1) body.classList.add('theme-cyber');
    if (active === 2) body.classList.add('theme-glass');
    if (active === 3) body.classList.add('theme-mono');

    return () => {
      // Cleanup: remove inline styles when unmounted
      for (const key of Object.keys(vars)) {
        root.style.removeProperty(key);
      }
      body.classList.remove('theme-cyber', 'theme-glass', 'theme-mono');
    };
  }, [active]);

  const previewColors: Record<ThemeId, string[]> = {
    1: ['#00D4AA', '#4F8EF7', '#FF6B6B', '#0A0F1E'],
    2: ['#A78BFA', '#F472B6', '#34D399', '#0C0A1D'],
    3: ['#F59E0B', '#22D3EE', '#EF4444', '#09090B'],
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <span className="text-xs text-white/50 mr-2 hidden sm:inline">Theme:</span>
      {([1, 2, 3] as ThemeId[]).map(id => (
        <button
          key={id}
          onClick={() => setActive(id)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: active === id ? 'rgba(255,255,255,0.15)' : 'transparent',
            border: active === id ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
            color: active === id ? '#fff' : 'rgba(255,255,255,0.5)',
          }}
        >
          <div className="flex gap-0.5">
            {previewColors[id].slice(0, 3).map((c, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: c }}
              />
            ))}
          </div>
          <span className="hidden sm:inline">{themes[id].name}</span>
          <span className="sm:hidden">{id}</span>
        </button>
      ))}
    </div>
  );
}
