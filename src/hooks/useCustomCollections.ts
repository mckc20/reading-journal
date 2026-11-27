import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  deleteCustomCollection, fetchCustomCollections, saveCollectionBooks, saveCustomCollection, setCollectionMembership,
  type CollectionBookChanges,
} from "@/lib/customCollections";

type CollectionData = Awaited<ReturnType<typeof fetchCustomCollections>>;
type CollectionUpdate = (data: CollectionData, bookId?: string) => CollectionData;
type CollectionListener = (owner: string, update: CollectionUpdate, bookId?: string) => void;
// The global add dialog and book details can change a collection while its page is still mounted.
const collectionListeners = new Set<CollectionListener>();
const emptyData: CollectionData = { collections: [], memberships: [] };

function getCollectionActions(userId?: string) {
  function notify(update: CollectionUpdate, bookId?: string) {
    if (userId) collectionListeners.forEach(listener => listener(userId, update, bookId));
  }

  return {
    async save(name: string, description: string, id?: string) {
      const collection = await saveCustomCollection(name, description, id);
      notify(data => ({
        ...data, collections: [...data.collections.filter(item => item.id !== collection.id), collection],
      }));
      return collection;
    },
    async remove(id: string) {
      await deleteCustomCollection(id);
      notify(data => ({
        collections: data.collections.filter(item => item.id !== id),
        memberships: data.memberships.filter(item => item.collection_id !== id),
      }));
    },
    async setMembership(collectionId: string, bookId: string, included: boolean) {
      const membership = await setCollectionMembership(collectionId, bookId, included);
      notify(data => {
        const memberships = data.memberships.filter(item => item.collection_id !== collectionId || item.book_id !== bookId);
        if (membership) memberships.push(membership);
        return { ...data, memberships };
      }, bookId);
    },
    async saveBooks(collectionId: string, changes: CollectionBookChanges) {
      await saveCollectionBooks(collectionId, changes);
      const positions = new Map(changes.orderedIds.map((id, index) => [id, index + 1]));
      const removed = new Set(changes.removedIds);
      const addedAt = new Date().toISOString();
      notify((data, bookId) => {
        const memberships = data.memberships.filter(item => item.collection_id !== collectionId || !removed.has(item.book_id))
          .map(item => item.collection_id === collectionId && positions.has(item.book_id)
            ? { ...item, position: positions.get(item.book_id)! } : item);
        const existing = new Set(memberships.filter(item => item.collection_id === collectionId).map(item => item.book_id));
        for (const id of changes.addedIds) {
          if (existing.has(id) || (bookId && bookId !== id)) continue;
          memberships.push({ collection_id: collectionId, book_id: id, position: positions.get(id) ?? null, added_at: addedAt });
        }
        return { ...data, memberships };
      });
    },
  };
}

export function useCustomCollectionActions() {
  const { user } = useAuth();
  return getCollectionActions(user?.id);
}

export function useCustomCollections(bookId?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const key = userId ? `${userId}/${bookId ?? ""}` : "";
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; data?: CollectionData }>();

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let updatesWhileLoading: CollectionUpdate[] | null = [];
    const listener: CollectionListener = (owner, update, changedBookId) => {
      if (owner !== userId || (bookId && changedBookId && bookId !== changedBookId)) return;
      if (updatesWhileLoading) {
        updatesWhileLoading.push(update);
        return;
      }
      setResult(previous => previous?.key === key && previous.attempt === attempt && previous.data
        ? { ...previous, data: update(previous.data, bookId) }
        : previous);
    };
    collectionListeners.add(listener);
    void fetchCustomCollections(userId, bookId).then(
      data => {
        if (!active) return;
        const latest = updatesWhileLoading?.reduce((current, update) => update(current, bookId), data) ?? data;
        updatesWhileLoading = null;
        setResult({ key, attempt, data: latest });
      },
      () => {
        updatesWhileLoading = null;
        if (active) setResult({ key, attempt });
      },
    );
    return () => {
      active = false;
      collectionListeners.delete(listener);
    };
  }, [attempt, bookId, key, userId]);

  const current = result?.key === key && result.attempt === attempt ? result : undefined;
  return {
    ...(current?.data ?? emptyData),
    ...getCollectionActions(userId),
    loading: !current,
    error: Boolean(current && !current.data),
    retry: () => setAttempt(value => value + 1),
  };
}
