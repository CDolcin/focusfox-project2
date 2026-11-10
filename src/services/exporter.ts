import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Card, Deck, Note, Task } from '../core/models';
import { buildNotesHtml, buildTasksHtml, serializeDeck } from '../core/export/html';

async function sharePdf(html: string, title: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
  return uri;
}
const stamp = () => new Date().toLocaleString();
export const exportNotesPdf = (notes: Note[]) => sharePdf(buildNotesHtml(notes, stamp()), 'FocusFox notes');
export const exportTasksPdf = (tasks: Task[]) => sharePdf(buildTasksHtml(tasks, stamp(), ms => new Date(ms).toLocaleString()), 'FocusFox tasks');

/** Flashcards -> a .focusfox.json file (re-importable) shared through the system sheet. */
export async function exportDeckFile(deck: Deck, cards: Card[]) {
  const file = new File(Paths.cache, `${deck.name.replace(/[^\w-]+/g, '_') || 'deck'}.focusfox.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(serializeDeck(deck, cards, Date.now()));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export deck' });
  return file.uri;
}
export async function readTextFile(uri: string): Promise<string> { return new File(uri).text(); }
