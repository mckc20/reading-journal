import { useState, type ReactNode } from 'react';
import { Link, Mail, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookCover } from '@/components/reading-journal/BookCover';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { HomePost } from './HomeCards';
import './redesign.css';

export type ShareDestination = 'chat' | 'link' | 'email';

const destinations = [
  { value: 'chat', label: 'Share in a chat', icon: MessageCircle },
  { value: 'link', label: 'Copy a link', icon: Link },
  { value: 'email', label: 'Share by email', icon: Mail },
] as const;

function SharePostForm({ post, onShare, onClose, onPendingChange }: {
  post: HomePost;
  onShare: (destination: ShareDestination) => Promise<void>;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [destination, setDestination] = useState<ShareDestination | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  return <form className="rj-share-form" onSubmit={async event => {
    event.preventDefault();
    if (!destination || sharing) return;
    try {
      setSharing(true); onPendingChange(true); setError('');
      await onShare(destination);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The post could not be shared. Try again.');
    } finally {
      setSharing(false); onPendingChange(false);
    }
  }}>
    <p className="rj-share-author">Posted by: <span>{post.author}</span></p>
    <div className="rj-share-preview">
      <div><p className="rj-picker-label">Content</p><p className="rj-share-excerpt">{post.content}</p></div>
      <BookCover src={post.book.cover} title={post.book.title} />
    </div>
    <div className="rj-share-destinations" role="group" aria-label="Share destination">
      {destinations.map(({ value, label, icon: Icon }) => <Button key={value} type="button" variant="secondary" size="icon-lg" aria-label={label} aria-pressed={destination === value} disabled={sharing} onClick={() => setDestination(value)}><Icon aria-hidden="true" /></Button>)}
      {/* The fourth circle has no destination in the PDF. Keep it decorative. */}
      <span className="rj-share-destination-placeholder" aria-hidden="true" />
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="rj-progress-footer"><Button variant="outline" type="button" disabled={sharing} onClick={onClose}>Cancel</Button><Button type="submit" disabled={!destination || sharing}>{sharing ? 'Sharing…' : 'Share'}</Button></div>
  </form>;
}

/** The caller chooses the sharing behavior; Storybook never sends or copies real content. */
export function SharePostDialog({ post, onShare, initiallyOpen = false, open: controlledOpen, onOpenChange, trigger, returnFocusTo }: {
  post: HomePost;
  onShare: (destination: ShareDestination) => Promise<void>;
  initiallyOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  returnFocusTo?: HTMLElement | null;
}) {
  const [localOpen, setLocalOpen] = useState(initiallyOpen);
  const [sharing, setSharing] = useState(false);
  const open = controlledOpen ?? localOpen;
  function setOpen(next: boolean) { setLocalOpen(next); onOpenChange?.(next); }

  return <Dialog open={open} onOpenChange={next => { if (!sharing) setOpen(next); }}>
    {trigger !== null && <DialogTrigger asChild>{trigger ?? <Button variant="outline"><Share2 />Share post</Button>}</DialogTrigger>}
    <DialogContent className="rj-redesign rj-share-dialog" showCloseButton={!sharing} onCloseAutoFocus={event => { if (returnFocusTo) { event.preventDefault(); returnFocusTo.focus(); } }} onEscapeKeyDown={event => { if (sharing) event.preventDefault(); }} onPointerDownOutside={event => { if (sharing) event.preventDefault(); }}>
      <DialogTitle>Share this post</DialogTitle>
      <DialogDescription className="sr-only">Choose how to share this post, then confirm with Share.</DialogDescription>
      <SharePostForm post={post} onShare={onShare} onClose={() => setOpen(false)} onPendingChange={setSharing} />
    </DialogContent>
  </Dialog>;
}
