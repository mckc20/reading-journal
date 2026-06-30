import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  fallbackTo: string;
  className?: string;
};

export default function BackButton({ fallbackTo, className }: BackButtonProps) {
  const navigate = useNavigate();

  function handleBack() {
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
    <Button type="button" variant="ghost" size="sm" className={cn("px-2", className)} onClick={handleBack}>
      <ArrowLeft className="mr-1.5 h-4 w-4" />
      Back
    </Button>
  );
}
