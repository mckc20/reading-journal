import type { HomeBook, HomePost } from '@/components/redesign/HomeCards';
import psalm from './assets/psalm.jpg';
import midnight from './assets/midnight-library.jpg';
import hobbit from './assets/hobbit.jpg';
import circus from './assets/night-circus.jpg';
import piranesi from './assets/piranesi.jpg';

// Public book metadata and fictional people/text only. No Supabase imports.
export const books: HomeBook[] = [
  { id: 'psalm', title: 'A Psalm for the Wild-Built', author: 'Becky Chambers', cover: psalm, currentPage: 64, totalPages: 160 },
  { id: 'midnight', title: 'The Midnight Library', author: 'Matt Haig', cover: midnight, currentPage: 246, totalPages: 301 },
  { id: 'circus', title: 'The Night Circus', author: 'Erin Morgenstern', cover: circus, currentPage: 72, totalPages: 387 },
  { id: 'hobbit', title: 'The Hobbit', author: 'J. R. R. Tolkien', cover: hobbit, currentPage: 0, totalPages: 310 },
  { id: 'piranesi', title: 'Piranesi', author: 'Susanna Clarke', cover: piranesi, currentPage: 0, totalPages: 272 },
];

export const posts: HomePost[] = [
  { id: 'post-1', author: 'Alex Rivers', initials: 'AR', postedAt: 'Yesterday at 8:30', content: 'A strange, beautiful world to get lost in. I’m still thinking about the final chapter. Has anyone else read this?', book: books[4], likes: 12, comments: 3 },
  { id: 'post-2', author: 'Sam Brooks', initials: 'SB', postedAt: 'Yesterday at 16:15', quote: true, content: 'A quiet chapter.\nA little time to think.\nA book to come back to.', attribution: 'Sam’s reading journal', book: books[0], likes: 8, comments: 2 },
];

export const previewCommentAuthor = { name: 'Taylor Lane', initials: 'TL' };
export const sampleComments = {
  'post-1': [
    { id: 'comment-1', author: { name: 'Sam Brooks', initials: 'SB' }, postedAt: 'Yesterday at 9:10', content: 'I loved the atmosphere too. Every room felt like a new discovery.' },
    { id: 'comment-2', author: { name: 'Robin Park', initials: 'RP' }, postedAt: 'Yesterday at 10:25', content: 'This has just moved to the top of my reading list!' },
    { id: 'comment-3', author: { name: 'Alex Rivers', initials: 'AR' }, postedAt: 'Yesterday at 11:00', content: 'I would love to hear what you think when you finish it.' },
  ],
  'post-2': [
    { id: 'comment-4', author: { name: 'Robin Park', initials: 'RP' }, postedAt: 'Yesterday at 17:00', content: 'That sounds like a lovely way to spend an afternoon.' },
    { id: 'comment-5', author: { name: 'Alex Rivers', initials: 'AR' }, postedAt: 'Yesterday at 18:20', content: 'A good reminder to slow down and enjoy the chapter.' },
  ],
};
