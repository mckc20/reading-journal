import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddAuthorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddAuthorDialog({ open, onOpenChange }: AddAuthorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Author</DialogTitle>
          <DialogDescription>
            Author storage is not connected yet. The form is visible so the flow is ready when the database exists.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="author-name">Author name *</Label>
            <Input id="author-name" disabled placeholder="Not available yet" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="author-photo">Photo</Label>
            <Input id="author-photo" disabled placeholder="Not available yet" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="author-birth">Birth year</Label>
              <Input id="author-birth" disabled placeholder="Not available yet" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="author-death">Death year</Label>
              <Input id="author-death" disabled placeholder="Not available yet" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="author-nationality">Nationality</Label>
            <Input id="author-nationality" disabled placeholder="Not available yet" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="author-website">Website</Label>
            <Input id="author-website" disabled placeholder="Not available yet" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="author-biography">Biography</Label>
            <Textarea id="author-biography" rows={5} disabled placeholder="Not available yet" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled>
            Add Author
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
