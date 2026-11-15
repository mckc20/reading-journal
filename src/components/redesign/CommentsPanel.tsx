import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import './redesign.css';

export interface CommentAuthor {
  name: string;
  initials: string;
  avatar?: string;
}

export interface PostComment {
  id: string;
  author: CommentAuthor;
  postedAt: string;
  content: string;
}

function CommentAvatar({ author }: { author: CommentAuthor }) {
  return <span className="rj-comment-avatar" aria-hidden="true">
    {author.avatar ? <img src={author.avatar} alt="" /> : author.initials}
  </span>;
}

interface CommentsPanelProps {
  comments: PostComment[];
  currentUser: CommentAuthor;
  onAddComment: (content: string) => Promise<void>;
  title?: ReactNode;
  onSavingChange?: (saving: boolean) => void;
  handle?: ReactNode;
}

/** The PDF's comment surface. Data and submission are supplied by its caller. */
export function CommentsPanel({ comments, currentUser, onAddComment, title, onSavingChange, handle }: CommentsPanelProps) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const errorId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollToNewComment = useRef(false);

  useLayoutEffect(() => {
    if (scrollToNewComment.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      scrollToNewComment.current = false;
    }
  }, [comments.length]);

  return <section className="rj-comments-panel" aria-label="Comments">
    <header className="rj-comments-header">
      {handle ?? <span className="rj-comments-handle" aria-hidden="true" />}
      {title ?? <h2>Comments</h2>}
    </header>
    <ol ref={listRef} className="rj-comments-list" aria-label="Post comments" tabIndex={0}>
      {comments.length ? comments.map(comment => <li key={comment.id} className="rj-comment">
        <article>
          <header><CommentAvatar author={comment.author} /><div><strong>{comment.author.name}</strong><span className="rj-muted">{comment.postedAt}</span></div></header>
          <p>{comment.content}</p>
        </article>
      </li>) : <li className="rj-comments-empty">No comments yet. Start the conversation.</li>}
    </ol>
    <form className="rj-comment-composer" onSubmit={async event => {
      event.preventDefault();
      const content = draft.trim();
      if (!content || saving) return;
      setSaving(true); onSavingChange?.(true); setError(''); setNotice('');
      scrollToNewComment.current = true;
      try {
        await onAddComment(content);
        setDraft(''); setNotice('Your comment was added.');
      } catch (cause) {
        scrollToNewComment.current = false;
        setError(cause instanceof Error ? cause.message : 'Your comment could not be added. Please try again.');
      } finally {
        setSaving(false); onSavingChange?.(false);
        // Restore the composer after React enables it again.
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    }}>
      <div className="rj-comment-composer-row">
        <CommentAvatar author={currentUser} />
        <Input ref={inputRef} aria-label="Write your own comment" placeholder="Write your own comment…" value={draft} onChange={event => setDraft(event.target.value)} disabled={saving} aria-describedby={error ? errorId : undefined} />
        {(draft.trim() || saving) && <Button type="submit" size="icon-lg" aria-label={saving ? 'Posting comment' : 'Post comment'} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
        </Button>}
      </div>
      {error && <p className="rj-comment-error" role="alert" id={errorId}>{error}</p>}
      <p className="sr-only" role="status">{notice}</p>
    </form>
  </section>;
}
