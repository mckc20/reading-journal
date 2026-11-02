import { Button } from "@/components/ui/button";

export default function CollectionEmptyState({ title, description, onShowAll }: {
  title: string;
  description: string;
  onShowAll?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed px-5 py-12 text-center">
      <p className="font-heading text-lg">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {onShowAll && <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onShowAll}>Show all</Button>}
    </div>
  );
}
