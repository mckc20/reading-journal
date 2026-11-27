import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCustomCollections } from "@/hooks/useCustomCollections";
import { runBulkOperation } from "@/lib/bulkManagement";
import { compareCollectionNames, myCollectionsPath } from "@/lib/libraryCollections";
import type { Book } from "@/types";
import { CollectionDialogContent } from "./CollectionDialogs";

export function ManageCollectionsDialog({ book, onClose, onCloseAutoFocus }: {
  book: Pick<Book, "id" | "title">;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const custom = useCustomCollections(book.id);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const savedIds = new Set(custom.memberships.map(item => item.collection_id));
  const collections = [...custom.collections].sort(compareCollectionNames);
  const updates = collections.filter(collection => collection.id in changes);

  function toggle(id: string, checked: boolean) {
    setChanges(current => {
      const next = { ...current };
      if (checked === savedIds.has(id)) delete next[id];
      else next[id] = checked;
      return next;
    });
    setFailures([]);
  }

  async function save() {
    if (pending || !updates.length) return;
    setPending(true);
    setFailures([]);
    const result = await runBulkOperation(
      updates,
      collection => ({
        id: collection.id,
        label: changes[collection.id] ? `Couldn’t add to “${collection.name}”.` : `Couldn’t remove from “${collection.name}”.`,
      }),
      collection => custom.setMembership(collection.id, book.id, changes[collection.id]),
    );
    if (!result.failures.length) {
      onClose();
      return;
    }
    setChanges(Object.fromEntries(result.failures.map(({ id }) => [id, changes[id]])));
    setFailures(result.failures.map(({ label }) => label));
    setPending(false);
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <CollectionDialogContent className="sm:max-w-lg" showCloseButton={!pending} onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <DialogTitle info={<>Choose the collections for “{book.title}”.</>}>Manage collections</DialogTitle>
      </DialogHeader>
      {custom.loading ? <p role="status">Loading your collections…</p>
        : custom.error ? <div className="grid justify-items-start gap-2">
          <p role="alert">Your collections couldn’t load.</p>
          <Button variant="outline" onClick={custom.retry}>Try again</Button>
        </div>
        : collections.length ? <ul className="rj-collection-picker-list" aria-label="Your collections">
          {collections.map(collection => <li key={collection.id}>
            <label>
              <input type="checkbox" checked={changes[collection.id] ?? savedIds.has(collection.id)} disabled={pending}
                onChange={event => toggle(collection.id, event.target.checked)} />
              <span className="break-all">{collection.name}</span>
            </label>
          </li>)}
        </ul> : <div className="grid justify-items-start gap-2">
          <p>You haven’t made any collections yet.</p>
          <Button asChild variant="outline"><Link to={myCollectionsPath}>Go to Your collections</Link></Button>
        </div>}
      {failures.length > 0 && <div role="alert" className="text-destructive">
        <ul>{failures.map(failure => <li key={failure}>{failure}</li>)}</ul>
        <p>You can retry these changes.</p>
      </div>}
      <DialogFooter className={collections.length > 0 ? "rj-collection-picker-footer" : undefined}>
        <Button variant="outline" disabled={pending} onClick={onClose}>{collections.length ? "Cancel" : "Close"}</Button>
        {collections.length > 0 && <Button disabled={pending || !updates.length} onClick={() => void save()}>
          {pending ? "Saving…" : failures.length ? "Retry changes" : "Save changes"}
        </Button>}
      </DialogFooter>
    </CollectionDialogContent>
  </Dialog>;
}
