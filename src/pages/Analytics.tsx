import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBooksContext } from "@/context/BooksContext";

export default function Analytics() {
  const { books } = useBooksContext();
  const finishedBooks = books.filter((book) => book.status === "Finished").length;
  const readingBooks = books.filter((book) => book.status === "Reading").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>Global reading insights are coming soon</CardTitle>
            <CardDescription>
              This tab is now available and will soon include trends, pace tracking, and deeper analytics from all your books.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Total books</p>
              <p className="mt-1 text-2xl font-semibold">{books.length}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Currently reading</p>
              <p className="mt-1 text-2xl font-semibold">{readingBooks}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Finished</p>
              <p className="mt-1 text-2xl font-semibold">{finishedBooks}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
