import { Card, Deck, Note, Task } from '../models';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CSS = `body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1B1B2E;padding:24px}
h1{color:#6C5CE7;margin:0 0 4px}h2{margin:18px 0 4px}.muted{color:#6B7280;font-size:12px}
.item{border-left:4px solid #6C5CE7;padding:8px 12px;margin:10px 0;background:#F4F2FC;border-radius:6px}
.HIGH{border-color:#E0607A}.MEDIUM{border-color:#E8A33D}.LOW{border-color:#4CAF7D}.done{text-decoration:line-through;color:#6B7280}`;

const page = (title: string, subtitle: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><h1>${escapeHtml(title)}</h1><div class="muted">${escapeHtml(subtitle)}</div>${body}</body></html>`;

export function buildNotesHtml(notes: Note[], generatedAt: string): string {
  const body = notes.length
    ? notes.map(n => `<div class="item"><strong>${escapeHtml(n.title)}</strong><div>${escapeHtml(n.content).replace(/\n/g, '<br>')}</div></div>`).join('')
    : '<p>No notes.</p>';
  return page('FocusFox notes', `Exported ${generatedAt} · ${notes.length} notes`, body);
}

export function buildTasksHtml(tasks: Task[], generatedAt: string, fmtDate: (ms: number) => string): string {
  const body = tasks.length
    ? tasks.map(t => `<div class="item ${t.priority}"><strong class="${t.completed ? 'done' : ''}">${escapeHtml(t.title)}</strong>
<div class="muted">${t.priority} · due ${escapeHtml(fmtDate(t.deadlineMs))} · ${t.completed ? 'completed' : 'open'}</div>
${t.description ? `<div>${escapeHtml(t.description)}</div>` : ''}</div>`).join('')
    : '<p>No tasks.</p>';
  return page('FocusFox tasks', `Exported ${generatedAt} · ${tasks.length} tasks`, body);
}

// ---- deck file ----
export const DECK_FILE_VERSION = 1;
export interface DeckFile { app: 'focusfox'; version: number; name: string; exportedAtMs: number; cards: Array<{ question: string; answer: string; mastered: boolean }> }

export function serializeDeck(deck: Pick<Deck, 'name'>, cards: Array<Pick<Card, 'question' | 'answer' | 'mastered'>>, nowMs: number): string {
  const file: DeckFile = { app: 'focusfox', version: DECK_FILE_VERSION, name: deck.name, exportedAtMs: nowMs, cards: cards.map(c => ({ question: c.question, answer: c.answer, mastered: c.mastered })) };
  return JSON.stringify(file, null, 2);
}

export function parseDeckFile(text: string): DeckFile {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Not a FocusFox deck file'); }
  const f = raw as Partial<DeckFile>;
  if (!f || f.app !== 'focusfox' || typeof f.name !== 'string' || !Array.isArray(f.cards)) throw new Error('Not a FocusFox deck file');
  if ((f.version ?? 0) > DECK_FILE_VERSION) throw new Error('Deck file is from a newer version of FocusFox');
  const cards = f.cards.filter(c => c && typeof c.question === 'string' && typeof c.answer === 'string')
    .map(c => ({ question: c.question, answer: c.answer, mastered: !!c.mastered }));
  return { app: 'focusfox', version: f.version ?? 1, name: f.name, exportedAtMs: f.exportedAtMs ?? 0, cards };
}
