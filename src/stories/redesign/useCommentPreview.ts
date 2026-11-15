import { useState } from 'react';
import type { PostComment } from '@/components/redesign/CommentsPanel';
import { previewCommentAuthor, sampleComments } from './fixtures';

/** Storybook memory only: closing the dialog preserves comments; reloading resets them. */
export function useCommentPreview() {
  const [comments, setComments] = useState<Record<string, PostComment[]>>(sampleComments);
  async function addComment(postId: string, content: string) {
    const comment: PostComment = { id: crypto.randomUUID(), author: previewCommentAuthor, postedAt: 'Just now', content };
    setComments(current => ({ ...current, [postId]: [...(current[postId] ?? []), comment] }));
  }
  return { comments, addComment };
}
