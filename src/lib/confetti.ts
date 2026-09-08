import confetti from "canvas-confetti";

export const BOOK_FINISHED_EVENT = "reading-journal:book-finished";

export function notifyBookFinished(bookId: string) {
  window.dispatchEvent(new CustomEvent<{ bookId: string }>(BOOK_FINISHED_EVENT, { detail: { bookId } }));
}

export function launchBookFinishedConfetti() {
  const commonOptions = {
    disableForReducedMotion: true,
    origin: { y: 0.7 },
    zIndex: 60,
  };

  confetti({
    ...commonOptions,
    particleCount: 80,
    spread: 70,
    startVelocity: 55,
  });

  confetti({
    ...commonOptions,
    particleCount: 45,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.75 },
  });

  confetti({
    ...commonOptions,
    particleCount: 45,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.75 },
  });
}
