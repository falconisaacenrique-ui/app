import { useState } from 'react';
import { ChevronLeft, Pin, Plus, Trash2 } from 'lucide-react';
import type { Note } from '../types';
import { uid } from '../utils';

import type { UndoToast } from '../App';

interface Props {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  showUndo: (message: string, undo: NonNullable<UndoToast['undo']>) => void;
}

export default function Notes({ notes, setNotes, showUndo }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const open = notes.find((n) => n.id === openId) ?? null;

  function createNote() {
    const note: Note = {
      id: uid(),
      title: '',
      content: '',
      updatedAt: Date.now(),
      pinned: false,
    };
    setNotes((prev) => [note, ...prev]);
    setOpenId(note.id);
  }

  function update(id: string, patch: Partial<Note>) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    );
  }

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  if (open) {
    return (
      <div className="view">
        <header className="view-header row">
          <button className="chip row" onClick={() => setOpenId(null)}>
            <ChevronLeft size={14} strokeWidth={1.5} /> Back
          </button>
          <button
            className={`chip row ${open.pinned ? 'active' : ''}`}
            onClick={() => update(open.id, { pinned: !open.pinned })}
          >
            <Pin size={14} strokeWidth={1.5} /> {open.pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            className="chip row danger"
            onClick={() => {
              const deleted = open;
              setNotes((prev) => prev.filter((n) => n.id !== deleted.id));
              setOpenId(null);
              showUndo(`Deleted "${deleted.title || 'Untitled'}"`, () =>
                setNotes((prev) => [deleted, ...prev]),
              );
            }}
          >
            <Trash2 size={14} strokeWidth={1.5} /> Delete
          </button>
        </header>
        <input
          className="note-title"
          value={open.title}
          onChange={(e) => update(open.id, { title: e.target.value })}
          placeholder="Title"
          autoFocus
        />
        <textarea
          className="note-body"
          value={open.content}
          onChange={(e) => update(open.id, { content: e.target.value })}
          placeholder="Start writing…"
        />
      </div>
    );
  }

  return (
    <div className="view">
      <header className="view-header row">
        <h1 className="grow">Notes</h1>
        <button className="primary row" onClick={createNote}>
          <Plus size={15} strokeWidth={1.5} /> New note
        </button>
      </header>

      {sorted.length === 0 && <p className="muted">No notes yet — create one.</p>}
      <div className="notes-grid">
        {sorted.map((n) => (
          <button key={n.id} className="card note-card" onClick={() => setOpenId(n.id)}>
            <h3 className="row">
              {n.pinned && <Pin size={13} strokeWidth={1.5} />}
              {n.title || 'Untitled'}
            </h3>
            <p>{n.content.slice(0, 120) || 'Empty note'}</p>
            <span className="muted small">
              {new Date(n.updatedAt).toLocaleDateString()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
