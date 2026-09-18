// Reads device contacts through the native WebView bridge, mirroring the
// window.flutter_inappwebview.callHandler(...) pattern already used for FCM
// tokens in OTP.jsx. Plain web browsers cannot access the OS contact list,
// so every function here is a silent no-op outside a wrapped native shell.

const HANDLER_NAMES = ["getDeviceContacts", "getContacts", "readContacts"];
const CALL_TIMEOUT_MS = 8000;
const CHUNK_SIZE = 500; // matches the backend's per-batch import limit

export const isNativeContactsBridgeAvailable = () =>
  typeof window !== "undefined" && Boolean(window.flutter_inappwebview);

/**
 * Asks the native shell for the device's contact list.
 * Returns an array of { name, phone } (phone required, name may be blank),
 * an empty array if the user has no contacts, or null if the bridge is
 * unavailable / every handler failed or timed out.
 */
export async function requestDeviceContacts() {
  if (!isNativeContactsBridgeAvailable()) return null;

  for (const handlerName of HANDLER_NAMES) {
    try {
      const result = await Promise.race([
        window.flutter_inappwebview.callHandler(handlerName, {}),
        new Promise((resolve) => setTimeout(() => resolve(undefined), CALL_TIMEOUT_MS)),
      ]);
      if (result === undefined || result === null) continue;

      const list = typeof result === "string" ? JSON.parse(result) : result;
      if (!Array.isArray(list)) continue;

      return list
        .map((c) => ({
          // Backend requires a non-empty name per contact; fall back when the
          // device contact has none set.
          name: String(c?.name || c?.displayName || "").trim() || "Unknown",
          phone: String(c?.phone || c?.number || c?.phoneNumber || "").trim(),
        }))
        .filter((c) => c.phone);
    } catch (e) {
      // Try the next candidate handler name
    }
  }
  return null;
}

/** Splits a non-empty contacts array into <=500-item batches for the import API. */
export function chunkContacts(contacts) {
  const chunks = [];
  for (let i = 0; i < contacts.length; i += CHUNK_SIZE) {
    chunks.push(contacts.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}
