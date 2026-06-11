import { useEffect, useRef, useState } from 'react';
import { Download, Link2, Lock, ShieldCheck, Upload, Wand2 } from 'lucide-react';
import { decryptText, encryptText, isEncryptedBackup } from '../crypto';
import { parseRules } from '../dsl';
import { exportData, importData, mergeRemoteData, requestPersistence } from '../storage';
import { joinHost, startHost, type HostStart, type SyncSession } from '../sync';
import type { Settings } from '../types';

/** "when … then …" rules with live parse feedback. */
function RulesCard({
  rulesText,
  setRulesText,
}: {
  rulesText: string;
  setRulesText: (v: string) => void;
}) {
  const { rules, errors } = parseRules(rulesText);
  return (
    <section className="card">
      <h2>
        <Wand2 size={15} strokeWidth={1.5} /> Rules
      </h2>
      <p className="muted small">
        Program your life — one rule per line, checked daily. Conditions:{' '}
        <em>habit "name" streak &gt;= N</em> · <em>tasks overdue &gt;= N</em> ·{' '}
        <em>spent &gt; N</em> · <em>all habits done</em>. Actions: <em>add task "…"</em> ·{' '}
        <em>add note "…"</em> · <em>add reminder "…"</em>
      </p>
      <textarea
        className="rules-editor"
        value={rulesText}
        onChange={(e) => setRulesText(e.target.value)}
        placeholder={'when habit "gym" streak >= 7 then add task "buy protein"'}
        rows={4}
        spellCheck={false}
      />
      {errors.length > 0 ? (
        <p className="warn small">
          Line {errors[0].line}: {errors[0].message}
        </p>
      ) : (
        rulesText.trim() && (
          <p className="muted small">
            {rules.length} rule{rules.length === 1 ? '' : 's'} active.
          </p>
        )
      )}
    </section>
  );
}

type SyncPhase =
  | { step: 'idle' }
  | { step: 'hosting'; code: string }
  | { step: 'joined'; code: string }
  | { step: 'working'; message: string }
  | { step: 'done'; message: string }
  | { step: 'error'; message: string };

/** Serverless WebRTC sync with manual pairing codes. */
function SyncCard() {
  const [phase, setPhase] = useState<SyncPhase>({ step: 'idle' });
  const [pasted, setPasted] = useState('');
  const hostRef = useRef<HostStart | null>(null);
  const joinSessionRef = useRef<Promise<SyncSession> | null>(null);

  async function runExchange(session: SyncSession) {
    setPhase({ step: 'working', message: 'Connected — exchanging data…' });
    const remote = await session.exchange(exportData());
    const error = await mergeRemoteData(remote);
    session.close();
    if (error) {
      setPhase({ step: 'error', message: error });
    } else {
      setPhase({ step: 'done', message: 'Synced. Reloading…' });
      setTimeout(() => window.location.reload(), 800);
    }
  }

  async function host() {
    try {
      setPhase({ step: 'working', message: 'Creating pairing code…' });
      hostRef.current = await startHost();
      setPhase({ step: 'hosting', code: hostRef.current.code });
      setPasted('');
    } catch (e) {
      setPhase({ step: 'error', message: String(e) });
    }
  }

  async function acceptAnswer() {
    if (!hostRef.current || !pasted.trim()) return;
    try {
      setPhase({ step: 'working', message: 'Connecting…' });
      const session = await hostRef.current.acceptAnswer(pasted);
      await runExchange(session);
    } catch (e) {
      setPhase({ step: 'error', message: String(e) });
    }
  }

  async function join() {
    if (!pasted.trim()) return;
    try {
      setPhase({ step: 'working', message: 'Answering…' });
      const { code, session } = await joinHost(pasted);
      joinSessionRef.current = session;
      setPhase({ step: 'joined', code });
      setPasted('');
      const s = await session;
      await runExchange(s);
    } catch (e) {
      setPhase({ step: 'error', message: String(e) });
    }
  }

  return (
    <section className="card">
      <h2>
        <Link2 size={15} strokeWidth={1.5} /> Device sync — no server
      </h2>
      <p className="muted small">
        Your devices connect <em>directly</em> to each other (WebRTC, same network) and merge
        changes — newest edit wins, deletions carry across. Exchange the pairing codes through
        any channel.
      </p>
      {phase.step === 'idle' && (
        <>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="chip" onClick={host}>
              Start on this device
            </button>
            <span className="muted small">or paste the other device's code:</span>
          </div>
          <textarea
            className="sync-code"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Pairing code from the other device…"
            rows={2}
          />
          <button className="primary" onClick={join} disabled={!pasted.trim()}>
            Join with code
          </button>
        </>
      )}
      {phase.step === 'hosting' && (
        <>
          <p className="muted small">1 — Send this code to your other device:</p>
          <textarea className="sync-code" readOnly value={phase.code} rows={3} onFocus={(e) => e.target.select()} />
          <p className="muted small">2 — Paste its reply code here:</p>
          <textarea
            className="sync-code"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Reply code…"
            rows={2}
          />
          <button className="primary" onClick={acceptAnswer} disabled={!pasted.trim()}>
            Connect & sync
          </button>
        </>
      )}
      {phase.step === 'joined' && (
        <>
          <p className="muted small">Send this reply code back, then wait — sync starts automatically:</p>
          <textarea className="sync-code" readOnly value={phase.code} rows={3} onFocus={(e) => e.target.select()} />
        </>
      )}
      {(phase.step === 'working' || phase.step === 'done') && <p className="muted small">{phase.message}</p>}
      {phase.step === 'error' && (
        <>
          <p className="warn small">{phase.message}</p>
          <button className="chip" onClick={() => setPhase({ step: 'idle' })}>
            Try again
          </button>
        </>
      )}
    </section>
  );
}

interface Props {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  rulesText: string;
  setRulesText: (v: string) => void;
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

export default function SettingsView({ settings, setSettings, rulesText, setRulesText }: Props) {
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
        <h2>Appearance</h2>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              className={`chip ${(settings.theme ?? 'system') === t ? 'active' : ''}`}
              onClick={() => setSettings((s) => ({ ...s, theme: t }))}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

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

      <RulesCard rulesText={rulesText} setRulesText={setRulesText} />

      <SyncCard />

      <section className="card">
        <h2>Keyboard shortcuts</h2>
        <div className="shortcut-grid small">
          <span><kbd>n</kbd></span> <span className="muted">Quick add anything</span>
          <span><kbd>/</kbd></span> <span className="muted">Search</span>
          <span><kbd>g</kbd> then <kbd>d</kbd>/<kbd>c</kbd>/<kbd>t</kbd>/<kbd>h</kbd></span>
          <span className="muted">Go to Today / Calendar / Tasks / Habits</span>
          <span><kbd>g</kbd> then <kbd>n</kbd>/<kbd>r</kbd>/<kbd>b</kbd>/<kbd>w</kbd>/<kbd>s</kbd></span>
          <span className="muted">Notes / Reminders / Budget / Review / Settings</span>
          <span><kbd>Esc</kbd></span> <span className="muted">Close dialogs</span>
        </div>
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
