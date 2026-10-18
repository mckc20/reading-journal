import { Star } from 'lucide-react';

export default function BookRating({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  return (
    <span className="mt-1 flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(value => (
        <Star
          key={value}
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${value <= rating ? 'fill-rating text-rating' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}
