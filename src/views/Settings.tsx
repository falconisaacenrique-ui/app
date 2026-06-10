import { useEffect, useRef, useState } from 'react';
import { Download, Lock, ShieldCheck, Upload } from 'lucide-react';
import { decryptText, encryptText, isEncryptedBackup } from '../crypto';
import { exportData, importData, requestPersistence } from '../storage';
import type { Settings } from '../types';

interface Props {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'MXN', 'BRL', 'INR', 'PHP', 'CNY'];

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsView({ settings, setSettings }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void requestPersistence().then(setPersisted);
  }, []);

  const stamp = () => new Date().toISOString().slice(0, 10);

  function exportPlain() {
    download(exportData(), `lifehub-backup-${stamp()}.json`, 'application/json');
    setMessage(null);
  }

  async function exportEncrypted() {
    if (!password) {
      setMessage('Set a password below first to export an encrypted backup.');
      return;
    }
    download(
      await encryptText(exportData(), password),
      `lifehub-backup-${stamp()}.encrypted.json`,
      'application/json',
    );
    setMessage('Encrypted backup exported. You will need the same password to import it.');
  }

  async function handleImport(file: File) {
    let text = await file.text();
    if (isEncryptedBackup(text)) {
      if (!password) {
        setMessage('This backup is encrypted — enter its password below, then import again.');
        return;
      }
      const decrypted = await decryptText(text, password);
      if (decrypted === null) {
        setMessage('Wrong password for this encrypted backup.');
        return;
      }
      text = decrypted;
    }
    const error = importData(text);
    if (error) {
      setMessage(error);
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
        <h2>Backup & device transfer</h2>
        <p className="muted small">
          Your data lives only on this device. Export a backup regularly; import it on another
          device to move your data there. Encrypted backups can travel safely through email,
          cloud drives, or messaging — only the password can open them.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="primary row" onClick={exportPlain}>
            <Download size={15} strokeWidth={1.5} /> Export backup
          </button>
          <button className="chip row" onClick={() => void exportEncrypted()}>
            <Lock size={14} strokeWidth={1.5} /> Export encrypted
          </button>
          <button className="chip row" onClick={() => fileRef.current?.click()}>
            <Upload size={14} strokeWidth={1.5} /> Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="row" style={{ marginTop: '0.6rem' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password for encrypted backups"
            style={{
              padding: '0.5rem 0.7rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg)',
              flex: 1,
            }}
          />
        </div>
        {message && <p className="warn small">{message}</p>}
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
