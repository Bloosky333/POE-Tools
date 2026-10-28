import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SettingsContext } from './useSettings.ts';
import {
  applySettings,
  applyTheme,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings.ts';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
    applyTheme(settings.theme);
  }, [settings]);

  // "System" follows later OS theme changes too.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [settings.theme]);

  const value = useMemo(
    () => ({
      settings,
      update: (patch: Partial<Settings>) => setSettings((prev) => applySettings(prev, patch)),
    }),
    [settings],
  );

  return <SettingsContext value={value}>{children}</SettingsContext>;
}
