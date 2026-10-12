import { useEffect, useRef } from "react";

/**
 * Pulls the OTP digits out of whatever a browser/keyboard autofill handed us
 * (e.g. "1234", "1234 ", or a whole SMS body) and caps it at `length` digits.
 */
export const extractOtpDigits = (value, length = 4) =>
  String(value ?? "").replace(/\D/g, "").slice(0, length);

/**
 * Listens for the incoming login SMS via the WebOTP API and hands the code to
 * `onCode` as soon as the browser reads it, so the user never has to type it.
 *
 * WebOTP (Chrome on Android) only fires for SMS bodies that end with
 * "@<site-domain> #<code>"; for any other SMS format it silently does nothing,
 * which is why the OTP inputs also carry autoComplete="one-time-code" (the
 * keyboard then offers the code from the SMS with one tap). Unsupported
 * browsers, iOS and native WebViews fall through without any side effect.
 */
export function useSmsOtpAutofill(onCode, { enabled = true, length = 4 } = {}) {
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    if (!("OTPCredential" in window) || !navigator.credentials?.get) return undefined;

    const controller = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: controller.signal })
      .then((credential) => {
        const code = extractOtpDigits(credential?.code, length);
        if (code.length === length) onCodeRef.current?.(code);
      })
      .catch(() => {
        // Aborted, dismissed, or SMS not in WebOTP format - manual entry still works.
      });

    return () => controller.abort();
  }, [enabled, length]);
}
