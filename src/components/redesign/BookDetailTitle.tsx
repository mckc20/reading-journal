import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BookDetailTitleProps {
  id: string;
  title: string;
  favorite: boolean;
  onToggleFavorite: () => void;
}

export function BookDetailTitle({ id, title, favorite, onToggleFavorite }: BookDetailTitleProps) {
  const text = title.trimEnd();
  const lastWordStart = Math.max(0, text.search(/\S+$/));

  return (
    <h1 id={id} aria-label={title} className="rj-detail-title">
      {text.slice(0, lastWordStart)}
      <span className="rj-detail-title-ending">
        <span>{text.slice(lastWordStart)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={favorite}
          onClick={onToggleFavorite}
        >
          <Heart aria-hidden="true" className={cn("size-[22px]", favorite && "fill-favorite text-favorite")} />
        </Button>
      </span>
    </h1>
  );
}
