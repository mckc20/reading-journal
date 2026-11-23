import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverUploadFieldProps {
  id: string;
  label: string;
  preview: string | null;
  fileName?: string;
  shape: "cover" | "banner";
  disabled?: boolean;
  onFileChange: (file: File) => void;
}

export function CoverUploadField({ id, label, preview, fileName, shape, disabled, onFileChange }: CoverUploadFieldProps) {
  const descriptionId = `${id}-description`;

  return (
    <div className="min-w-0 space-y-2">
      <label className={cn(
        "rj-creation-upload group relative flex cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-primary/60",
        shape === "cover" ? "aspect-[2/3]" : "aspect-[16/7]",
      )}>
        <input id={id} type="file" accept="image/*" className="sr-only" aria-label={label} aria-describedby={descriptionId} disabled={disabled}
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            onFileChange(file);
            event.currentTarget.value = "";
          }} />
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 px-2 text-center text-muted-foreground" aria-hidden="true">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Click to upload</span>
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
          <ImagePlus className="h-5 w-5 text-white" />
        </span>
      </label>
      <p id={descriptionId} className={cn("text-xs text-muted-foreground", fileName && "truncate")} title={fileName}>
        {fileName || "PNG, JPG, WEBP, or AVIF."}
      </p>
    </div>
  );
}
