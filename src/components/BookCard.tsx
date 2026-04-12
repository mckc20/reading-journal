import { BookOpen, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { statusVariant } from "@/lib/utils";
import type { Book } from "@/types";

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const progress =
    book.status === "Reading" && book.current_page && book.total_pages
      ? Math.round((book.current_page / book.total_pages) * 100)
      : null;

  return (
    <Card
      className="cursor-pointer overflow-hidden pt-0 hover:ring-2 hover:ring-primary/40 transition-shadow"
      onClick={() => onClick(book)}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] w-full bg-muted">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {book.is_favorite && (
          <Heart
            className="absolute right-1.5 top-1.5 h-4 w-4 fill-rose-500 text-rose-500 drop-shadow"
            aria-label="Favorite"
          />
        )}
      </div>

      <CardContent className="p-2 space-y-1">
        <p className="text-sm font-medium leading-tight line-clamp-2">{book.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
        <Badge variant={statusVariant(book.status)} className="text-xs">
          {book.status}
        </Badge>
        {progress !== null && (
          <Progress value={progress} className="h-1 mt-1" />
        )}
      </CardContent>
    </Card>
  );
}
