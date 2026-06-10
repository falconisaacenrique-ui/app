import { useEffect, useRef, useState } from 'react';
import { Download, ShieldCheck, Upload } from 'lucide-react';
import { exportData, importData, requestPersistence } from '../storage';
import type { Settings } from '../types';

interface Props {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'MXN', 'BRL', 'INR', 'PHP', 'CNY'];

export default function SettingsView({ settings, setSettings }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    void requestPersistence().then(setPersisted);
  }, []);

  function downloadBackup() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifehub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    const error = importData(await file.text());
    if (error) {
      setImportMessage(error);
    } else {
      // Reload so every view picks up the imported data.
      window.location.reload();
    }
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Settings</h1>
      </header>

      <section className="card">
        <h2>Currency</h2>
        <select
          value={settings.currency}
          onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
        >
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted small">
          Your data lives only on this device. Download a backup regularly, and import it to move
          your data to another device or restore it.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="primary row" onClick={downloadBackup}>
            <Download size={15} strokeWidth={1.5} /> Export backup
          </button>
          <button className="chip row" onClick={() => fileRef.current?.click()}>
            <Upload size={14} strokeWidth={1.5} /> Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
        {importMessage && <p className="warn small">{importMessage}</p>}
        <p className="muted small">
          Importing replaces the data on this device with the backup's contents.
        </p>
      </section>

      <section className="card">
        <h2>Storage</h2>
        <p className="row small muted">
          <ShieldCheck size={15} strokeWidth={1.5} />
          {persisted === null
            ? 'Checking storage protection…'
            : persisted
              ? 'Storage is protected — the browser will not evict your data under storage pressure.'
              : 'Storage protection not granted yet — it is usually granted automatically once the app is installed to your home screen. Export backups regularly.'}
        </p>
      </section>

      <section className="card">
        <h2>About</h2>
        <p className="muted small">
          LifeHub — a private, offline-first life management app. All data stays in this browser;
          nothing is ever sent to a server.
        </p>
      </section>
    </div>
  );
}
