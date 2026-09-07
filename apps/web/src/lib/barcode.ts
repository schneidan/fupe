import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const GTIN_RE = /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/;

function createReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.EAN_8,
    BarcodeFormat.EAN_13,
    BarcodeFormat.CODE_128,
    BarcodeFormat.QR_CODE,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

export function normalizeGtin(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!GTIN_RE.test(digits)) return null;
  return digits;
}

/** Try to decode a 1D/2D barcode from an image File. Returns GTIN digits or null. */
export async function decodeBarcodeFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const reader = createReader();
    const result = await reader.decodeFromImageUrl(url);
    return normalizeGtin(result.getText());
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type BarcodeScanHandle = {
  stop: () => void;
};

/** Continuous camera scan into a video element. Calls onDetected once with GTIN. */
export async function startBarcodeCamera(
  video: HTMLVideoElement,
  onDetected: (gtin: string) => void,
  onError?: (message: string) => void,
): Promise<BarcodeScanHandle> {
  const reader = createReader();
  let controls: IScannerControls | undefined;
  let settled = false;

  try {
    controls = await reader.decodeFromVideoDevice(
      undefined,
      video,
      (result, _err, ctrl) => {
        if (!result || settled) return;
        const gtin = normalizeGtin(result.getText());
        if (!gtin) return;
        settled = true;
        ctrl.stop();
        onDetected(gtin);
      },
    );
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : 'Could not access the camera for barcode scan.';
    onError?.(msg);
    throw e;
  }

  return {
    stop: () => {
      settled = true;
      controls?.stop();
    },
  };
}
