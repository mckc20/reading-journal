# Issue 104: ISBN Barcode Scanner

The scanner now uses `@ericblade/quagga2` instead of `html5-qrcode`.

Quagga2 is a better match for the current Add Book workflow because the app only needs realtime 1D ISBN barcode scanning. The scanner is configured for EAN decoding only, throttled to 10 scans per second, and tuned with `halfSample` plus a small locator patch size for mobile ISBN barcodes.

Scanned results are accepted only when they are valid Bookland EAN-13 ISBN values:

- 13 digits
- prefix `978` or `979`
- valid EAN-13 checksum

Manual ISBN entry remains unchanged so users can still enter ISBN values directly if camera scanning fails.

Issue #24 is covered as an MVP feedback layer. The scanner now reports camera startup, active scanning, successful ISBN detection, non-ISBN barcode detection, permission/camera errors, and a delayed hint when no barcode has been found. Detailed frame-quality diagnosis such as "too dark" or "out of focus" remains out of scope because browser camera APIs and Quagga2 do not expose reliable semantic reasons for failed detection.

STRICH remains a possible future fallback if field testing shows Quagga2 is not reliable enough on target devices, but it is commercial and was not introduced here. The native `BarcodeDetector` API was not used as the main path because MDN still marks it experimental and limited availability.
