import { useRef, useState, type ReactNode } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CommentsPanel, type CommentAuthor, type PostComment } from './CommentsPanel';
import type { HomePost } from './HomeCards';

export function CommentsDialog({ post, comments, currentUser, onAddComment, initiallyOpen = false, open: controlledOpen, onOpenChange, trigger, returnFocusTo }: {
  post: HomePost;
  comments: PostComment[];
  currentUser: CommentAuthor;
  onAddComment: (content: string) => Promise<void>;
  initiallyOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  returnFocusTo?: HTMLElement | null;
}) {
  const [localOpen, setLocalOpen] = useState(initiallyOpen);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const drag = useRef<{ pointerId: number; y: number; time: number; offset: number; height: number; ceiling: number } | null>(null);
  const suppressClick = useRef(false);
  const open = controlledOpen ?? localOpen;
  function setOpen(next: boolean) { setExpanded(false); setLocalOpen(next); onOpenChange?.(next); }

  function resetDrag() {
    panelRef.current?.removeAttribute('data-dragging');
    panelRef.current?.style.removeProperty('--rj-comments-height-limit');
    panelRef.current?.style.setProperty('--rj-comment-drag', '0px');
  }

  async function dismiss() {
    if (saving || closing.current) return;
    closing.current = true;
    const panel = panelRef.current;
    if (panel) {
      // Finish the slide before notifying a caller that may unmount the dialog.
      const animation = panel.animate([
        { transform: getComputedStyle(panel).transform },
        { transform: 'translateY(calc(100% + 32px))' },
      ], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      await animation.finished.catch(() => {});
    }
    setOpen(false);
    closing.current = false;
  }

  return <Dialog open={open} onOpenChange={next => { if (next) setOpen(true); else void dismiss(); }}>
    {trigger !== null && <DialogTrigger asChild>{trigger ?? <Button variant="outline"><MessageCircle />View comments</Button>}</DialogTrigger>}
    <DialogContent
      ref={panelRef}
      className="rj-redesign rj-comments-dialog"
      data-expanded={expanded}
      overlayClassName="rj-comments-overlay"
      showCloseButton={false}
      onOpenAutoFocus={event => { event.preventDefault(); titleRef.current?.focus(); }}
      onCloseAutoFocus={event => { if (returnFocusTo) { event.preventDefault(); returnFocusTo.focus(); } }}
      onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}
      onPointerDownOutside={event => { if (saving) event.preventDefault(); }}
    >
      <DialogDescription className="sr-only">Comments on {post.author}’s post about {post.book.title}. Write a comment and press Enter or Post comment to submit. On mobile, drag the handle up to expand or down to close. Focus the handle and press Arrow Up to expand, or activate it to close.</DialogDescription>
      <Button type="button" variant="ghost" size="icon-lg" className="rj-comments-close" aria-label="Close comments" disabled={saving} onClick={() => void dismiss()}><X aria-hidden="true" /></Button>
      <CommentsPanel comments={comments} currentUser={currentUser} onAddComment={onAddComment} onSavingChange={setSaving} title={<DialogTitle ref={titleRef} tabIndex={-1}>Comments</DialogTitle>} handle={<button
        type="button" className="rj-comments-drag-handle" aria-label="Close comments; drag up to expand or down to close" disabled={saving}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') suppressClick.current = false;
          if (event.key === 'ArrowUp' && !saving) { event.preventDefault(); setExpanded(true); }
        }}
        onClick={event => {
          // A touch swipe can produce a click too; it must not also close the sheet.
          if (suppressClick.current) { event.preventDefault(); return; }
          void dismiss();
        }}
        onPointerDown={event => {
          if (saving || closing.current || !event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          const panel = panelRef.current;
          if (!panel) return;
          // Settle an unfinished entrance without toggling its CSS animation.
          // Toggling animation off/on would replay it when the gesture ends.
          panel.getAnimations().forEach(animation => {
            if ('animationName' in animation && animation.animationName === 'rj-comments-slide-up') animation.cancel();
          });
          // Read the CSS ceiling so viewport/safe-area changes use the same limit.
          const ceiling = window.innerHeight - parseFloat(getComputedStyle(panel).getPropertyValue('--rj-comments-top-gap'));
          drag.current = { pointerId: event.pointerId, y: event.clientY, time: performance.now(), offset: 0, height: panel.offsetHeight, ceiling };
          event.currentTarget.setPointerCapture(event.pointerId);
          panelRef.current?.setAttribute('data-dragging', 'true');
        }}
        onPointerMove={event => {
          const gesture = drag.current;
          if (!gesture || event.pointerId !== gesture.pointerId) return;
          gesture.offset = event.clientY - gesture.y;
          if (Math.abs(event.clientY - gesture.y) > 5) suppressClick.current = true;
          panelRef.current?.style.setProperty('--rj-comment-drag', `${Math.max(0, gesture.offset)}px`);
          if (gesture.offset < 0) panelRef.current?.style.setProperty('--rj-comments-height-limit', `${Math.min(gesture.ceiling, gesture.height - gesture.offset)}px`);
          else panelRef.current?.style.removeProperty('--rj-comments-height-limit');
        }}
        onPointerUp={event => {
          const gesture = drag.current;
          if (!gesture || event.pointerId !== gesture.pointerId) return;
          drag.current = null;
          const distance = gesture.offset;
          const velocity = distance / Math.max(1, performance.now() - gesture.time);
          const threshold = Math.min(120, Math.max(60, (panelRef.current?.offsetHeight ?? 320) * .25));
          if (distance >= threshold || (distance > 24 && velocity > .5)) {
            void dismiss();
            panelRef.current?.removeAttribute('data-dragging');
          } else {
            if (distance < -24) setExpanded(true);
            resetDrag();
          }
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => {
          if (!drag.current) return;
          drag.current = null;
          suppressClick.current = true;
          resetDrag();
        }}
      ><span className="rj-comments-handle" aria-hidden="true" /></button>} />
    </DialogContent>
  </Dialog>;
}
