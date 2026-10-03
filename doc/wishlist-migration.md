# Wishlist stored in books

Wishlist entries are ordinary books with status `Wishlist`. Acquisition changes
that status to `To Read`; it does not copy the record or keep acquisition history.
Price and purchase links remain on the book after acquisition.

`useBooksContext().books` contains library books only. `wishlistBooks` contains
wishes. Use these scoped lists for UI counts and analytics. Moving a library book
to the wishlist keeps its journal, reading logs, progress, and rating, but closes
an active pause period. Acquiring it again sets `To Read`, not its former status.

## Deployment steps

1. Back up the database, including `wishlist_items`, and confirm the backup can be restored.
2. Stop writes from the old frontend (including open browser sessions) during the change.
3. Apply existing migrations through `20261009`, then apply
   `supabase/migrations/20261010_merge_wishlist_into_books.sql` in Supabase SQL Editor.
4. Deploy the matching frontend and API before allowing writes again. The old app
   cannot work after the wishlist table has been removed.
5. Check wishlist counts, acquisition, author/genre links, covers, purchase fields,
   and library counts with a test account before reopening access.

The migration runs in one transaction. It preserves pending wish IDs and creation
dates, creates author/genre links, and validates ownership before removing the
legacy table and functions. Acquired entries keep their existing library book;
missing purchase fields are filled from the latest non-empty wishlist values.
ID collisions or invalid ownership abort the migration rather than losing data.

After success, restoring the old app alone is not a rollback: restore the database
backup too, with writes stopped. Do not reapply old wishlist migrations afterward.

## Verification

Series deletion also requires `20261011_optional_series_book_deletion.sql` before
deploying the updated deletion UI. Its checkbox defaults to unchecked: keep and
detach linked books. Checking it deletes linked library and wishlist books, along
with their journals and reading logs. Each series is deleted in one transaction;
bulk operations report failures per series. No live migration is applied by tests.

`npm test` includes isolated PostgreSQL migration tests using the dev-only PGlite
dependency. They do not connect to Supabase. Run `npm run build` as well.

The REST and MCP book lists/searches default to library books. Request status
`Wishlist` explicitly to list/search wishes. Reading-log creation on wishes is
rejected; existing logs are retained but excluded from library analytics.
