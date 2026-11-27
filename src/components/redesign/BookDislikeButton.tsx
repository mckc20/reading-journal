import { ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BookDislikeButton({ pressed, disabled, onClick }: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return <Button type="button" variant="ghost" size="icon-lg" className="size-11"
    aria-label="Dislike" aria-pressed={pressed} disabled={disabled} onClick={onClick}>
    <ThumbsDown aria-hidden="true" fill={pressed ? "currentColor" : "none"} />
  </Button>;
}
