import { useCallback, useEffect, useRef, useState } from "react";
import type {
  QuaggaJSConfigObject,
  QuaggaJSResultCallbackFunction,
  QuaggaJSResultObject,
  QuaggaJSStatic,
} from "@ericblade/quagga2";
import { Button } from "@/components/ui/button";
import { normalizeScannedIsbn } from "@/lib/isbnScan";

interface BarcodeScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

type ScannerStatus = "starting" | "scanning" | "detected" | "hint";

const NO_DETECTION_HINT_DELAY_MS = 7000;

function buildScannerConfig(
  target: HTMLDivElement,
  constraints: MediaTrackConstraints,
): QuaggaJSConfigObject {
  return {
    inputStream: {
      type: "LiveStream",
      target,
      constraints,
      area: {
        top: "25%",
        right: "5%",
        bottom: "25%",
        left: "5%",
      },
      willReadFrequently: true,
    },
    locate: true,
    frequency: 10,
    numOfWorkers: navigator.hardwareConcurrency
      ? Math.min(4, Math.max(1, navigator.hardwareConcurrency - 1))
      : 2,
    decoder: {
      readers: ["ean_reader"],
      multiple: false,
    },
    locator: {
      halfSample: true,
      patchSize: "small",
      willReadFrequently: true,
    },
  };
}

async function stopScanner(
  quagga: QuaggaJSStatic | null,
  onDetected: QuaggaJSResultCallbackFunction | null,
): Promise<void> {
  if (!quagga) return;

  try {
    if (onDetected) {
      quagga.offDetected(onDetected);
    }
    await quagga.stop();
  } catch {
    // Stopping is best-effort because Quagga can throw if initialization failed.
  }
}

function getCameraErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/permission|denied|notallowed/i.test(message)) {
    return "Camera permission was denied. Please allow camera access and try again.";
  }

  return "Could not access camera. You can enter the ISBN manually instead.";
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quaggaRef = useRef<QuaggaJSStatic | null>(null);
  const detectedCallbackRef = useRef<QuaggaJSResultCallbackFunction | null>(null);
  const scannedRef = useRef(false);
  const hintTimerRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("starting");
  const [scanMessage, setScanMessage] = useState("Starting camera...");

  onScanRef.current = onScan;

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  const scheduleNoDetectionHint = useCallback(() => {
    clearHintTimer();
    hintTimerRef.current = window.setTimeout(() => {
      if (!scannedRef.current) {
        setStatus("hint");
        setScanMessage(
          "No ISBN barcode yet. Try better light, hold steady, and fit the barcode inside the frame.",
        );
      }
    }, NO_DETECTION_HINT_DELAY_MS);
  }, [clearHintTimer]);

  const startScanner = useCallback(
    async (stopped: () => boolean) => {
      setStatus("starting");
      setScanMessage("Starting camera...");
      setError(null);

      const { default: Quagga } = await import("@ericblade/quagga2");

      if (stopped() || !containerRef.current) return;

      quaggaRef.current = Quagga;
      const onDetected = async (result: QuaggaJSResultObject) => {
        if (scannedRef.current) return;

        const code = result.codeResult?.code ?? "";
        const isbn = normalizeScannedIsbn(code);

        if (!isbn) {
          setStatus("hint");
          setScanMessage(
            "Barcode detected, but it is not a book ISBN. Look for an EAN-13 barcode starting with 978 or 979.",
          );
          scheduleNoDetectionHint();
          return;
        }

        scannedRef.current = true;
        clearHintTimer();
        setStatus("detected");
        setScanMessage("ISBN barcode detected. Looking up book...");

        await stopScanner(Quagga, onDetected);
        onScanRef.current(isbn);
      };

      detectedCallbackRef.current = onDetected;

      try {
        await Quagga.start(
          buildScannerConfig(containerRef.current, {
            facingMode: { exact: "environment" },
          }),
        );
      } catch {
        try {
          if (stopped() || !containerRef.current) return;
          await Quagga.start(
            buildScannerConfig(containerRef.current, {
              facingMode: "environment",
            }),
          );
        } catch (err) {
          if (!stopped()) {
            setError(getCameraErrorMessage(err));
          }
          return;
        }
      }

      if (stopped()) {
        await stopScanner(Quagga, onDetected);
        return;
      }

      Quagga.onDetected(onDetected);
      setStatus("scanning");
      setScanMessage("Looking for an ISBN barcode...");
      scheduleNoDetectionHint();
    },
    [clearHintTimer, scheduleNoDetectionHint],
  );

  useEffect(() => {
    let isStopped = false;
    scannedRef.current = false;

    startScanner(() => isStopped).catch((err: unknown) => {
      if (!isStopped) {
        setError(getCameraErrorMessage(err));
      }
    });

    return () => {
      isStopped = true;
      clearHintTimer();
      void stopScanner(quaggaRef.current, detectedCallbackRef.current);
    };
  }, [clearHintTimer, startScanner]);

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 [&_canvas]:hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        <div className="pointer-events-none absolute inset-x-[8%] top-1/2 h-32 -translate-y-1/2 rounded-md border-2 border-primary/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
      </div>

      {error ? (
        <p className="text-sm text-destructive text-center">{error}</p>
      ) : (
        <p
          className={
            status === "hint"
              ? "text-sm text-amber-600 dark:text-amber-400 text-center"
              : "text-sm text-muted-foreground text-center"
          }
        >
          {scanMessage}
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
