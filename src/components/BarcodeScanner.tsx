import { useCallback, useEffect, useRef, useState } from "react";
import type {
  QuaggaJSConfigObject,
  QuaggaJSResultCallbackFunction,
  QuaggaJSResultObject,
  QuaggaJSStatic,
} from "@ericblade/quagga2";
import { Button } from "@/components/ui/button";
import { Flashlight, ZoomIn } from "lucide-react";
import { normalizeScannedIsbn } from "@/lib/isbnScan";

interface BarcodeScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

type ScannerStatus = "starting" | "scanning" | "detected" | "hint";

const NO_DETECTION_HINT_DELAY_MS = 7000;

type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
};

type CameraTrack = MediaStreamTrack & {
  getCapabilities?: () => CameraCapabilities;
};

function getCameraTrack(target: HTMLDivElement): CameraTrack | null {
  const video = target.querySelector("video");
  const stream = video?.srcObject;
  return stream instanceof MediaStream
    ? (stream.getVideoTracks()[0] as CameraTrack | undefined) ?? null
    : null;
}

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
        top: "34%",
        right: "5%",
        bottom: "34%",
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

function getHighQualityConstraints(
  facingMode: MediaTrackConstraints["facingMode"],
): MediaTrackConstraints {
  return {
    facingMode,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30, max: 30 },
  };
}

async function configureCameraTrack(
  target: HTMLDivElement,
  setCapabilities: (capabilities: CameraCapabilities | null) => void,
): Promise<void> {
  const track = getCameraTrack(target);
  const capabilities = track?.getCapabilities
    ? (track.getCapabilities() as CameraCapabilities)
    : null;
  setCapabilities(capabilities);

  if (!track || !capabilities?.focusMode?.includes("continuous")) return;

  try {
    await track.applyConstraints({
      advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
    });
  } catch {
    // Autofocus is optional and some browsers expose the capability but reject the constraint.
  }
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
  const [cameraCapabilities, setCameraCapabilities] =
    useState<CameraCapabilities | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);

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
          buildScannerConfig(
            containerRef.current,
            getHighQualityConstraints({ exact: "environment" }),
          ),
        );
      } catch {
        try {
          if (stopped() || !containerRef.current) return;
          await Quagga.start(
            buildScannerConfig(
              containerRef.current,
              getHighQualityConstraints("environment"),
            ),
          );
        } catch (err) {
          if (!stopped()) {
            setError(getCameraErrorMessage(err));
          }
          return;
        }
      }

      if (stopped() || !containerRef.current) return;
      await configureCameraTrack(containerRef.current, setCameraCapabilities);

      const track = getCameraTrack(containerRef.current);
      const capabilities = track?.getCapabilities
        ? (track.getCapabilities() as CameraCapabilities)
        : null;
      if (capabilities?.zoom) {
        const currentZoom = (track?.getSettings() as MediaTrackSettings & {
          zoom?: number;
        })?.zoom;
        setZoom(currentZoom ?? capabilities.zoom.min);
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
      setCameraCapabilities(null);
      setZoom(null);
      setTorchEnabled(false);
      void stopScanner(quaggaRef.current, detectedCallbackRef.current);
    };
  }, [clearHintTimer, startScanner]);

  const applyCameraConstraint = useCallback(
    async (constraint: MediaTrackConstraintSet) => {
      const target = containerRef.current;
      const track = target ? getCameraTrack(target) : null;
      if (!track) return;

      try {
        await track.applyConstraints({ advanced: [constraint] });
      } catch {
        // Camera controls are progressive enhancements and may not be supported by the browser.
      }
    },
    [],
  );

  const handleZoomChange = useCallback(
    (value: number) => {
      setZoom(value);
      void applyCameraConstraint({ zoom: value } as MediaTrackConstraintSet);
    },
    [applyCameraConstraint],
  );

  const handleTorchToggle = useCallback(() => {
    const nextEnabled = !torchEnabled;
    setTorchEnabled(nextEnabled);
    void applyCameraConstraint({ torch: nextEnabled } as MediaTrackConstraintSet);
  }, [applyCameraConstraint, torchEnabled]);

  const zoomRange = cameraCapabilities?.zoom;

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[4/3] bg-foreground rounded-lg overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 [&_canvas]:hidden [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
        />
        <div className="scanner-mask pointer-events-none absolute inset-x-[5%] top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-primary/80" />
      </div>

      {(zoomRange || cameraCapabilities?.torch) && (
        <div className="flex items-center gap-3">
          {zoomRange && zoom !== null && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                aria-label="Camera zoom"
                className="min-w-0 flex-1 accent-primary"
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step ?? 0.1}
                value={zoom}
                onChange={(event) => handleZoomChange(Number(event.target.value))}
              />
            </div>
          )}
          {cameraCapabilities?.torch && (
            <Button
              type="button"
              variant={torchEnabled ? "default" : "outline"}
              size="icon"
              aria-label={torchEnabled ? "Turn off light" : "Turn on light"}
              onClick={handleTorchToggle}
            >
              <Flashlight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive text-center">{error}</p>
      ) : (
        <p
          className={
            status === "hint"
              ? "text-sm text-insight text-center"
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
