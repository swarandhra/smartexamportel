import { useRef, useState } from 'react';
import type { KeyboardEvent, UIEvent } from 'react';
import { Check, Flag, X, Keyboard, Loader2, CloudCheck, CloudOff, AlertTriangle } from 'lucide-react';
import type { Question } from '../../utils/db';

export type SaveStatus = { s: 'idle' | 'saving' | 'saved' | 'offline'; at?: number };
export type PaletteFilter = 'all' | 'answered' | 'unanswered' | 'marked';

export function SaveChip({ status, now }: { status: SaveStatus; now: number }) {
  let label = 'Autosave on';
  let cls = 'ui-badge--info';
  let icon = <CloudCheck size={14} strokeWidth={1.75} />;
  if (status.s === 'saving') { label = 'Saving…'; icon = <Loader2 size={14} className="ui-spinner" />; }
  else if (status.s === 'saved') {
    const secs = Math.max(0, Math.floor((now - (status.at || now)) / 1000));
    label = `Saved · ${secs < 10 ? 'just now' : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`}`;
    cls = 'ui-badge--success';
  } else if (status.s === 'offline') { label = 'Offline — saved locally'; cls = 'ui-badge--warning'; icon = <CloudOff size={14} strokeWidth={1.75} />; }
  return <span className={`ui-badge xm-save ${cls}`} role="status" aria-live="polite">{icon}{label}</span>;
}

export function ShortcutsPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div className="xm-pop">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label="Keyboard shortcuts" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Keyboard size={18} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="xm-pop__card" role="dialog" aria-label="Keyboard shortcuts">
          <b>Keyboard shortcuts</b>
          <dl>
            <dt><kbd>1</kbd>–<kbd>4</kbd> / <kbd>A</kbd>–<kbd>D</kbd></dt><dd>Select option</dd>
            <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Previous / next</dd>
            <dt><kbd>M</kbd></dt><dd>Mark for review</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

interface PaletteProps {
  questions: Question[];
  activeIdx: number;
  answers: Record<string, string>;
  visited: Record<string, boolean>;
  marked: Record<string, boolean>;
  filter: PaletteFilter;
  onFilter: (f: PaletteFilter) => void;
  onSelect: (idx: number) => void;
}

export function Palette({ questions, activeIdx, answers, visited, marked, filter, onFilter, onSelect }: PaletteProps) {
  const isAnswered = (q: Question) => answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
  const groups = [
    { title: 'MCQ', items: questions.filter(q => q.type !== 'coding' && !q.type.startsWith('practical')), prefix: '' },
    { title: 'Coding & practical', items: questions.filter(q => q.type === 'coding' || q.type.startsWith('practical')), prefix: 'c' },
  ];
  const filters: [PaletteFilter, string][] = [['all', 'All'], ['answered', 'Answered'], ['unanswered', 'Unanswered'], ['marked', 'Marked']];
  const show = (q: Question) =>
    filter === 'all' || (filter === 'answered' && isAnswered(q)) || (filter === 'unanswered' && !isAnswered(q)) || (filter === 'marked' && marked[q.id]);

  return (
    <>
      <div className="xm-filters" role="group" aria-label="Filter questions">
        {filters.map(([k, label]) => (
          <button key={k} type="button" className={`xm-fchip ${filter === k ? 'is-on' : ''}`} aria-pressed={filter === k} onClick={() => onFilter(k)}>{label}</button>
        ))}
      </div>
      {groups.map(g => g.items.length > 0 && (
        <section key={g.title} className="xm-group">
          <h4>{g.title}</h4>
          <div className="xm-grid">
            {g.items.map((q, idx) => {
              if (!show(q)) return null;
              const qi = questions.indexOf(q);
              const answered = isAnswered(q);
              let label = String(idx + 1);
              if (g.prefix) label = q.type === 'coding' ? `C${idx + 1}` : `P${idx + 1}`;
              const state = answered ? 'answered' : visited[q.id] ? 'visited' : 'new';
              const text = `Question ${label}: ${answered ? 'answered' : visited[q.id] ? 'not answered' : 'not visited'}${marked[q.id] ? ', marked for review' : ''}`;
              return (
                <button key={q.id} type="button" className={`xm-cell is-${state} ${marked[q.id] ? 'is-marked' : ''} ${qi === activeIdx ? 'is-current' : ''}`}
                  aria-label={text} aria-current={qi === activeIdx ? 'true' : undefined} onClick={() => onSelect(qi)}>
                  {label}
                  {marked[q.id] && <Flag size={10} strokeWidth={2.5} className="xm-cell__flag" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <ul className="xm-legend" aria-label="Legend">
        <li><i className="xm-cell is-new" /> Not visited</li>
        <li><i className="xm-cell is-visited" /> Unanswered</li>
        <li><i className="xm-cell is-answered" /> Answered</li>
        <li><i className="xm-cell is-new is-marked"><Flag size={9} strokeWidth={2.5} className="xm-cell__flag" /></i> Marked</li>
        <li><i className="xm-cell is-answered is-marked"><Flag size={9} strokeWidth={2.5} className="xm-cell__flag" /></i> Answered + marked</li>
      </ul>
    </>
  );
}

interface SubmitModalProps { answered: number; unanswered: number; marked: number; busy: boolean; onConfirm: () => void; onCancel: () => void; }
export function SubmitModal({ answered, unanswered, marked, busy, onConfirm, onCancel }: SubmitModalProps) {
  return (
    <div className="xm-modal" role="dialog" aria-modal="true" aria-labelledby="xm-submit-title">
      <div className="xm-modal__card">
        <h3 id="xm-submit-title">Submit exam?</h3>
        <p>This action cannot be undone.</p>
        <div className="xm-counts">
          <div><b className="ui-mono">{answered}</b><span>Answered</span></div>
          <div className={unanswered ? 'is-warn' : ''}><b className="ui-mono">{unanswered}</b><span>Unanswered</span></div>
          <div><b className="ui-mono">{marked}</b><span>Marked</span></div>
        </div>
        {(unanswered > 0 || marked > 0) && (
          <p className="xm-modal__warn"><AlertTriangle size={16} strokeWidth={1.75} /> You still have {unanswered} unanswered and {marked} marked question(s).</p>
        )}
        <div className="xm-modal__actions">
          <button className="ui-btn ui-btn--secondary" onClick={onCancel} disabled={busy} autoFocus>Continue exam</button>
          <button className="ui-btn ui-btn--primary" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 size={18} className="ui-spinner" /> : <Check size={18} strokeWidth={1.75} />} Submit now
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditorProps {
  name: string; value: string; placeholder?: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}
export function CodeEditor({ name, value, placeholder, onChange, onKeyDown }: EditorProps) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = Math.max(1, value.split('\n').length);
  const sync = (e: UIEvent<HTMLTextAreaElement>) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; };
  return (
    <div className="xm-editor">
      <div className="xm-editor__gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea className="xm-editor__area" name={name} value={value} placeholder={placeholder} spellCheck={false} autoComplete="off"
        onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} onScroll={sync} wrap="off" />
    </div>
  );
}

export function CloseBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" onClick={onClick} aria-label={label}><X size={18} strokeWidth={1.75} /></button>;
}
