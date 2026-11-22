import type { JournalPreviewEntry } from '@/components/redesign/JournalPreview';

// All names and writing are invented for this workshop, including quote passages.
export const journalEntries: JournalPreviewEntry[] = [
  { id: 'window', title: 'A slower kind of morning', type: 'note', date: '2026-11-21', content: 'I left my phone in the other room and read beside the window. Only a few pages, but I noticed the rhythm of every sentence.\n\nI want to make room for more mornings like this, without turning them into another task.', related: { kind: 'Book', id: 'atlas', name: 'The Atlas of Quiet Places' } },
  { id: 'independent', type: 'note', date: '2026-11-20', content: 'Some days I read to find something new. Today I read to return to a feeling I already knew. I do not need every reading day to look the same.' },
  { id: 'quote', title: 'What we carry', type: 'quote', date: '2026-11-19', content: 'A map cannot tell you what to carry. It can only remind you that there is more than one way home.', attribution: 'Mira Vale, The Atlas of Quiet Places', related: { kind: 'Book', id: 'atlas', name: 'The Atlas of Quiet Places' } },
  { id: 'series', title: 'Returning to the coast', type: 'note', date: '2026-11-18', content: 'The second volume changes how I remember the first. The harbor felt like an escape before; now it feels like a place the characters are learning to care for.', related: { kind: 'Series', id: 'tide', name: 'The Tidemark Letters' } },
  { id: 'author', title: 'Listening between the lines', type: 'note', date: '2026-11-17', content: 'Her characters rarely say exactly what they mean. I keep noticing how a small gesture can hold a whole conversation. I want to watch for that in the next book.', related: { kind: 'Author', id: 'mira', name: 'Mira Vale' } },
  { id: 'review', title: 'An ending that leaves room', type: 'review', date: '2026-11-16', content: 'I loved the unhurried first half and the way the garden became a character of its own. The ending arrived a little quickly for me, but I am still thinking about the final conversation.\n\nA book I would return to for its atmosphere.', related: { kind: 'Book', id: 'garden', name: 'The Garden After Rain' } },
];
export const longJournalEntry: JournalPreviewEntry = {
  id: 'long', type: 'note', date: '2026-11-22', title: 'A notebook for all the questions I have not found words for yet',
  content: Array.from({ length: 18 }, (_, index) => `Reflection ${index + 1}. I stopped at the end of the chapter rather than rushing onward. The small details felt different this time: the cup left on the table, the open door, the pause before an answer. I wonder what I will notice when I come back to these pages.`).join('\n\n') + '\n\nThe last line belongs here too.',
};
