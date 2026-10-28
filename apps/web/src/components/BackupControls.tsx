import { useRef, useState } from 'react';
import { createBackup, downloadJson, parseBackup, restoreBackup } from '../lib/backup.ts';

/** Footer links: save everything stored in this browser to a file, or restore one. */
export function BackupControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      const ok = window.confirm(
        `Restore the backup of ${new Date(backup.exportedAt).toLocaleString()}? It replaces this browser's settings, recipes and saved items.`,
      );
      if (!ok) return;
      restoreBackup(backup);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const linkClass = 'text-muted hover:text-accent';
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <button
        type="button"
        className={linkClass}
        title="Settings, crafting recipes and saved items, as a JSON file"
        onClick={() =>
          downloadJson(
            `poe-tools-backup-${new Date().toISOString().slice(0, 10)}.json`,
            createBackup(),
          )
        }
      >
        Back up my data
      </button>
      ·
      <button type="button" className={linkClass} onClick={() => fileRef.current?.click()}>
        Restore
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void restore(file);
        }}
      />
      {message && <span className="text-warn">{message}</span>}
    </span>
  );
}
