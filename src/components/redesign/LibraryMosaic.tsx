import type { CSSProperties } from "react";
import { BookOpen } from "lucide-react";
import { BookCover } from "@/components/reading-journal/BookCover";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import "./collections-preview.css";

export function LibraryMosaic({ books }: { books: { id: string; title: string; cover?: string | null }[] }) {
  const covers = books.filter(book => book.cover).slice(0, 3);
  const color = useBookHeroColor(covers[0]?.cover);

  return (
    <div className="rj-collection-art" aria-hidden="true"
      style={covers.length ? { "--book-detail-hero-color": color } as CSSProperties : undefined}>
      <div className="rj-collection-covers" data-count={covers.length}>
        {covers.length
          ? covers.map(book => <BookCover key={book.id} src={book.cover} title={book.title} decorative />)
          : <BookOpen size={38} strokeWidth={1.2} />}
      </div>
    </div>
  );
}
