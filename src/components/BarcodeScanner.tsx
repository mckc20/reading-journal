import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

function stopScanner(scanner: any): Promise<void> {
  try {
    const result = scanner.stop();
    if (result && typeof result.catch === "function") {
      return result.catch(() => {});
    }
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stable ref so the effect doesn't re-run when onScan changes identity
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const startScanner = useCallback(async (stopped: () => boolean) => {
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
      "html5-qrcode"
    );

    if (stopped() || !containerRef.current) return;

    const scannerId = containerRef.current.id;
    const scanner = new Html5Qrcode(scannerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
      ],
      verbose: false,
    });
    scannerRef.current = scanner;

    const config = { fps: 10, qrbox: { width: 280, height: 160 } };

    const onSuccess = async (decodedText: string) => {
      // Guard against multiple firings
      if (scannedRef.current) return;
      scannedRef.current = true;

      await stopScanner(scanner);
      onScanRef.current(decodedText);
    };

    try {
      await scanner.start(
        { facingMode: { exact: "environment" } },
        config,
        onSuccess,
        () => {},
      );
    } catch {
      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          onSuccess,
          () => {},
        );
      } catch (err) {
        if (!stopped()) {
          setError(
            err instanceof Error && err.message.includes("Permission")
              ? "Camera permission was denied. Please allow camera access and try again."
              : "Could not access camera. You can enter the ISBN manually instead.",
          );
        }
      }
    }

    if (!stopped()) setLoading(false);
  }, []);

  useEffect(() => {
    let isStopped = false;
    scannedRef.current = false;

    startScanner(() => isStopped);

    return () => {
      isStopped = true;
      if (scannerRef.current) {
        stopScanner(scannerRef.current);
      }
    };
  }, [startScanner]);

  return (
    <div className="space-y-3">
      <div
        id="isbn-scanner"
        ref={containerRef}
        className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden"
      />

      {loading && !error && (
        <p className="text-sm text-muted-foreground text-center">
          Starting camera…
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {!loading && !error && (
        <p className="text-xs text-muted-foreground text-center">
          Point your camera at the book's barcode
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onClose}
      >
        Cancel
      </Button>
    </div>
  );
}
