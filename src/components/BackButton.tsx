import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  fallbackTo: string;
  className?: string;
  onClick?: () => void;
};

export default function BackButton({ fallbackTo, className, onClick }: BackButtonProps) {
  const navigate = useNavigate();

  function handleBack() {
    if (onClick) {
      onClick();
      return;
    }

    const historyIndex =
      typeof window !== "undefined" && typeof window.history.state?.idx === "number"
        ? window.history.state.idx
        : 0;

    if (historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo, { replace: true });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        className,
        "h-8 w-8 rounded-full border-0 bg-transparent shadow-none hover:bg-white/25 focus-visible:border-transparent focus-visible:ring-0",
      )}
      onClick={handleBack}
      aria-label="Back"
    >
      <ChevronLeft className="size-7" strokeWidth={1.5} />
    </Button>
  );
}
