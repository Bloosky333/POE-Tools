import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SettingsContext } from './useSettings.ts';
import { applyTheme, loadSettings, saveSettings, type Settings } from './settings.ts';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
    applyTheme(settings.theme);
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      update: (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch })),
    }),
    [settings],
  );

  return <SettingsContext value={value}>{children}</SettingsContext>;
}
