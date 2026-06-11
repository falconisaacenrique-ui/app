import { useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { dueFacts, review, type Fact, type Quality } from '../sm2';
import type { UndoToast } from '../App';
import { todayStr, uid } from '../utils';

interface Props {
  facts: Fact[];
  setFacts: React.Dispatch<React.SetStateAction<Fact[]>>;
  showUndo: (message: string, undo: NonNullable<UndoToast['undo']>) => void;
}

export default function Remember({ facts, setFacts, showUndo }: Props) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [revealed, setRevealed] = useState(false);
  const today = todayStr();

  const due = dueFacts(facts, today);
  const current = due[0];

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    setFacts((prev) => [
      ...prev,
      {
        id: uid(),
        front: front.trim(),
        back: back.trim(),
        ease: 2.5,
        interval: 0,
        reps: 0,
        due: today,
        createdAt: Date.now(),
      },
    ]);
    setFront('');
    setBack('');
  }

  function grade(quality: Quality) {
    if (!current) return;
    setFacts((prev) => prev.map((f) => (f.id === current.id ? review(f, quality) : f)));
    setRevealed(false);
  }

  function remove(fact: Fact) {
    setFacts((prev) => prev.filter((f) => f.id !== fact.id));
    showUndo(`Deleted "${fact.front}"`, () => setFacts((prev) => [...prev, fact]));
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Remember</h1>
        <p className="muted">
          Spaced repetition (the SM-2 algorithm) — save things worth keeping and they resurface
          right before you'd forget them.
        </p>
      </header>

      {current ? (
        <section className="card recall-card">
          <h2>
            <GraduationCap size={15} strokeWidth={1.5} /> {due.length} to review
          </h2>
          <p className="recall-front">{current.front}</p>
          {revealed ? (
            <>
              <p className="recall-back">{current.back}</p>
              <div className="row">
                <button className="chip danger" onClick={() => grade('again')}>
                  Again
                </button>
                <button className="chip" onClick={() => grade('good')}>
                  Good
                </button>
                <button className="chip" onClick={() => grade('easy')}>
                  Easy
                </button>
              </div>
            </>
          ) : (
            <button className="primary" onClick={() => setRevealed(true)}>
              Reveal
            </button>
          )}
        </section>
      ) : (
        facts.length > 0 && (
          <p className="muted empty-note">Nothing due today — the algorithm has it covered.</p>
        )
      )}

      <form className="smart-add card" onSubmit={add}>
        <div className="row">
          <input
            className="grow"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="What to remember (the prompt)…"
            aria-label="Fact front"
          />
        </div>
        <div className="row">
          <input
            className="grow"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="…and the answer"
            aria-label="Fact back"
          />
          <button type="submit" className="primary">
            Add
          </button>
        </div>
        <p className="hint muted small">
          Names, codes, birthdays, lessons learned — anything worth keeping.
        </p>
      </form>

      {facts.length > 0 && (
        <section className="card">
          <h2>All facts</h2>
          <ul className="plain-list">
            {[...facts]
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((f) => (
                <li key={f.id} className="row small">
                  <span className="grow">
                    {f.front}
                    <span className="badge">due {f.due <= today ? 'now' : f.due}</span>
                  </span>
                  <button className="icon-btn" aria-label="Delete fact" onClick={() => remove(f)}>
                    <X size={15} strokeWidth={1.5} />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
