import { Fragment, useId, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import LoadingIndicator from "@/components/LoadingIndicator";
import { AboutSection } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import { buildAuthorDetailPath, MetadataLink } from "@/components/LinkedMetadata";
import { BookCover } from "@/components/reading-journal/BookCover";
import { EmptyState } from "@/components/reading-journal/EmptyState";
import { externalBookUrl } from "@/components/redesign/BookDetailAbout";
import { BookDislikeButton } from "@/components/redesign/BookDislikeButton";
import { DetailGenreTags, DetailHero } from "@/components/redesign/DetailHero";
import { DetailBack, DetailSheet } from "@/components/redesign/DetailSheet";
import { Button } from "@/components/ui/button";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useRecommendations } from "@/context/RecommendationsContext";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { findAuthorSummary } from "@/lib/authorShelf";
import { wishlistCollectionPath } from "@/lib/libraryCollections";
import { recommendationCandidateKey, recommendationShelfPath } from "@/lib/recommendationIdentity";
import type { RecommendationItem } from "@/types/recommendations";

const detailLabel = "Book details";

export default function RecommendationDetails() {
  const { candidateKey } = useParams();
  const recommendations = useRecommendations();
  const item = recommendations.findDetail(candidateKey);

  return <DetailSheet key={candidateKey} label={detailLabel} fallbackTo={recommendationShelfPath}>
    {(close) => {
      if (item) return <RecommendationBook item={item} onClose={close} />;
      return <div className="rj-detail-page">
        <DetailBack label={detailLabel} fallbackTo={recommendationShelfPath} onClose={close} />
        {recommendations.loading ? <LoadingIndicator variant="page" label="Loading recommendation…" />
          : <EmptyState title="Recommendation unavailable"
            message={recommendations.error ?? "You can find current recommendations on Home."}
            action={recommendations.error
              ? <Button variant="outline" onClick={recommendations.retry}>Try again</Button>
              : <Button variant="outline" onClick={close}>Go back</Button>} />}
      </div>;
    }}
  </DetailSheet>;
}

function RecommendationBook({ item, onClose }: { item: RecommendationItem; onClose: () => void }) {
  const headingId = useId();
  const navigate = useNavigate();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const { authors } = useAuthorsContext();
  const { disliked, feedbackReady, dismiss, toggleDislike } = useRecommendations();
  const color = useBookHeroColor(item.coverUrl);
  const source = externalBookUrl(item.sourceUrl);
  const isDisliked = disliked.has(recommendationCandidateKey(item));
  const [pending, setPending] = useState<"dislike" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addBook(toWishlist: boolean, trigger: HTMLButtonElement) {
    openAddBook({
      initialRecommendation: item,
      initiallyAddToWishlist: toWishlist,
      onSaved: book => navigate(`/books/${encodeURIComponent(book.id)}`, { replace: true }),
      onWishlistSaved: () => navigate(wishlistCollectionPath, { replace: true }),
    }, trigger);
  }

  async function saveFeedback(action: "dislike" | "remove") {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      if (action === "remove") {
        await dismiss(item);
        navigate(recommendationShelfPath, { replace: true });
      } else {
        await toggleDislike(item);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this recommendation.");
    } finally {
      setPending(null);
    }
  }

  return <div className="rj-detail-page">
    <DetailHero titleId={headingId} color={color}
      navigation={<DetailBack label={detailLabel} fallbackTo={recommendationShelfPath} onClose={onClose} />}
      artwork={<BookCover src={item.coverUrl} title={item.title} className="rj-detail-cover" showFallbackTitle />}
      actions={<DetailActionsMenu kind="book" label={item.title} showShare={false}
        sourceUrl={source} deleteMenuLabel="Remove book"
        onRemove={() => void saveFeedback("remove")}
        beforeMore={<BookDislikeButton pressed={isDisliked} disabled={!feedbackReady || pending !== null}
          onClick={() => void saveFeedback("dislike")} />} />}>
      <h1 id={headingId} className="rj-detail-title rj-detail-title-italic">{item.title}</h1>
      {item.authors.length > 0 && <p className="rj-detail-author break-words">
        {item.authors.map((name, index) => {
          const author = findAuthorSummary(authors, name);
          return <Fragment key={name}>
            {index > 0 && ", "}
            {author ? <MetadataLink to={buildAuthorDetailPath(author.id)}>{name}</MetadataLink> : name}
          </Fragment>;
        })}
      </p>}
      <div className="rj-detail-actions">
        <Button type="button" variant="outline" onClick={event => addBook(true, event.currentTarget)}>Add to Wishlist</Button>
        <Button type="button" onClick={event => addBook(false, event.currentTarget)}>Add to library</Button>
      </div>
      {error && <p className="rj-detail-notice text-sm text-destructive" role="alert">{error}</p>}
    </DetailHero>

    <div className="rj-detail-body">
      <AboutSection title="About this book" text={item.description} className="rj-detail-description"
        titleContent={<DetailGenreTags genres={item.genres} linked={false} />} />
    </div>
  </div>;
}
