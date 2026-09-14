/**
 * Razorpay Payment Integration Utility
 * Handles Razorpay payment initialization and verification
 */

let razorpayLoaded = false;

/**
 * Load Razorpay checkout script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (razorpayLoaded) {
      resolve();
      return;
    }

    if (window.Razorpay) {
      razorpayLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      razorpayLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay script'));
    };
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay payment
 * @param {Object} options - Payment options
 * @param {String} options.key - Razorpay key ID
 * @param {String} options.amount - Amount in paise
 * @param {String} options.currency - Currency code
 * @param {String} options.order_id - Razorpay order ID
 * @param {String} options.name - Company/App name
 * @param {String} options.description - Payment description
 * @param {Object} options.prefill - Customer prefill info
 * @param {Object} options.notes - Additional notes
 * @param {Function} options.handler - Success callback
 * @param {Function} options.onError - Error callback
 * @param {Function} options.onClose - Close callback
 */
export const initRazorpayPayment = async (options) => {
  try {
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not available');
    }

    const razorpayOptions = {
      key: options.key,
      amount: options.amount,
      currency: options.currency || 'INR',
      order_id: options.order_id,
      name: options.name || 'Appzeto Food',
      description: options.description || 'Order Payment',
      image: options.image || '/logo.png',
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || ''
      },
      notes: options.notes || {},
      theme: {
        color: '#FF0000'
      },
      handler: function (response) {
        if (options.handler) {
          options.handler(response);
        }
      },
      modal: {
        ondismiss: function () {
          if (options.onClose) {
            options.onClose();
          }
        },
        escape: true,
        animation: true
      },
      retry: {
        enabled: true,
        max_count: 3
      }
    };

    const razorpay = new window.Razorpay(razorpayOptions);

    razorpay.on('payment.failed', function (response) {
      console.error('Razorpay payment failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Payment failed. Please try again.' });
      }
    });

    razorpay.on('payment.method_selection_failed', function (response) {
      console.error('Razorpay payment method selection failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Please select another payment method.' });
      }
    });

    razorpay.open();

    console.log('✅ Razorpay checkout opened successfully');
    console.log('Razorpay options:', {
      key: razorpayOptions.key ? 'Present' : 'Missing',
      amount: razorpayOptions.amount,
      order_id: razorpayOptions.order_id
    });
    console.log("razor payapp", razorpay)
    return razorpay;
  } catch (error) {
    console.error('Error initializing Razorpay:', error);
    if (options.onError) {
      options.onError(error);
    }
    throw error;
  }
};

/**
 * Initialize Razorpay Subscription checkout
 * @param {Object} options
 */
export const initRazorpaySubscription = async (options) => {
  try {
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not available');
    }

    const razorpayOptions = {
      key: options.key,
      subscription_id: options.subscription_id,
      name: options.name || 'Appzeto Subscriptions',
      description: options.description || 'Plan Subscription',
      image: options.image || '/logo.png',
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || ''
      },
      theme: {
        color: '#FF0000'
      },
      handler: function (response) {
        if (options.handler) {
          options.handler(response);
        }
      },
      modal: {
        ondismiss: function () {
          if (options.onClose) {
            options.onClose();
          }
        }
      },
      retry: {
        enabled: true,
        max_count: 3
      }
    };

    const rzp = new window.Razorpay(razorpayOptions);
    rzp.on('payment.failed', function (response) {
      console.error('Razorpay subscription payment failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Payment failed. Please try again.' });
      }
    });
    rzp.open();
    return rzp;
  } catch (error) {
    if (options.onError) {
      options.onError(error);
    }
    throw error;
  }
};

/**
 * Format amount for display
 * @param {Number} amount - Amount in paise
 * @returns {String} Formatted amount string
 */
export const formatAmount = (amount) => {
  return `₹${(amount / 100).toFixed(2)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Flutter WebView Bridge Utilities
// Shared between SignupStep2, Cart and any other page that needs Razorpay
// inside a flutter_inappwebview WebView.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect if the page is running inside a Flutter InAppWebView.
 * @returns {boolean}
 */
export const isFlutterWebView = () => {
  return (
    typeof window !== 'undefined' &&
    !!window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === 'function'
  );
};

/**
 * Trigger a Razorpay payment via the native Flutter Razorpay SDK.
 *
 * Strategy:
 *  1. Register global JS callbacks so Flutter can call back on success/failure.
 *  2. Listen to window.postMessage for apps that use that channel instead.
 *  3. Try each possible handler name, race against 1500ms timeout.
 *     - If a handler responds quickly → it accepted the call → wait up to 10 min.
 *     - If ALL handlers timeout → no native SDK registered → fall back to web checkout.
 *  4. The web checkout fallback ensures payment always works even if Flutter app
 *     doesn't implement the native Razorpay handler.
 *
 * @param {Object} rzpOptions - Same shape as initRazorpayPayment options
 * @returns {Promise<{razorpay_payment_id, razorpay_order_id, razorpay_signature}>}
 */
export const handleFlutterRazorpayPayment = (rzpOptions) => {
  return new Promise((resolve, reject) => {
    try {
      // Build payload with both snake_case and camelCase keys for Flutter app compatibility
      const payload = {
        key: rzpOptions.key,
        order_id: rzpOptions.order_id,
        keyId: rzpOptions.key,
        orderId: rzpOptions.order_id,
        amount: rzpOptions.amount,
        currency: rzpOptions.currency || 'INR',
        name: rzpOptions.name,
        description: rzpOptions.description,
        prefill: rzpOptions.prefill,
        notes: rzpOptions.notes || {},
      };

      let settled = false;
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        ['onRazorpaySuccess', 'onRazorpayPaymentSuccess', 'onPaymentSuccess', 'razorpayPaymentSuccess']
          .forEach((name) => { if (window[name] === handleSuccess) delete window[name]; });
        ['onRazorpayFailure', 'onRazorpayPaymentFailure', 'onPaymentFailure', 'onPaymentError', 'razorpayPaymentFailure']
          .forEach((name) => { if (window[name] === handleFailure) delete window[name]; });
        window.removeEventListener('message', handleMessage);
      };

      const finishSuccess = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        const paymentId = result?.razorpay_payment_id || result?.paymentId || result?.payment_id;
        const orderId = result?.razorpay_order_id || result?.orderId || result?.order_id || rzpOptions.order_id;
        const signature = result?.razorpay_signature || result?.signature || '';
        if (!paymentId) {
          reject(new Error('Payment succeeded but payment ID missing from Flutter response'));
          return;
        }
        resolve({ razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature });
      };

      const finishFailure = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        const msg = (typeof err === 'string'
          ? err
          : err?.error?.description || err?.description || err?.message) || 'Payment failed or cancelled';
        reject(new Error(msg));
      };

      // Register global callbacks Flutter can call after native payment completes
      const handleSuccess = (result) => finishSuccess(result);
      const handleFailure = (err) => finishFailure(err);
      ['onRazorpaySuccess', 'onRazorpayPaymentSuccess', 'onPaymentSuccess', 'razorpayPaymentSuccess']
        .forEach((name) => { window[name] = handleSuccess; });
      ['onRazorpayFailure', 'onRazorpayPaymentFailure', 'onPaymentFailure', 'onPaymentError', 'razorpayPaymentFailure']
        .forEach((name) => { window[name] = handleFailure; });

      // Also handle apps that use window.postMessage
      const handleMessage = (event) => {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { return; }
        }
        if (!data || typeof data !== 'object') return;
        const type = data.type || data.event || '';
        if (/razorpay/i.test(type) && /success/i.test(type)) {
          finishSuccess(data.payload || data.result || data);
        } else if (/razorpay/i.test(type) && /(fail|error|cancel)/i.test(type)) {
          finishFailure(data.payload || data.result || data);
        } else if (data.razorpay_payment_id || data.paymentId || data.payment_id) {
          finishSuccess(data);
        }
      };
      window.addEventListener('message', handleMessage);

      // List of possible Flutter handler names to try
      const handlerNames = [
        'initRazorpayPayment',
        'initRazorpay',
        'razorpayPayment',
        'startRazorpay',
        'openRazorpayCheckout',
        'openRazorpay',
        'startPayment',
        'razorpayCheckout',
      ];

      const tryHandlers = async () => {
        for (const handlerName of handlerNames) {
          if (settled) return;

          try {
            const callPromise = window.flutter_inappwebview.callHandler(handlerName, payload);

            // Attach listener for handlers that resolve AFTER payment (long-lived promise pattern)
            callPromise.then((res) => {
              if (res && typeof res === 'object') {
                const paymentId = res.razorpay_payment_id || res.paymentId || res.payment_id;
                if (paymentId) finishSuccess(res);
                else if (res.error || res.cancelled) finishFailure(res.error || 'Payment cancelled');
              }
            }).catch(() => { /* handled in loop below */ });

            // Race against 1500ms — if it times out, this handler name is not registered
            const result = await Promise.race([
              callPromise,
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
            ]);

            if (settled) return;

            // Handler responded quickly → it accepted the call
            if (result && typeof result === 'object') {
              const paymentId = result.razorpay_payment_id || result.paymentId || result.payment_id;
              if (paymentId) { finishSuccess(result); return; }
              if (result.error || result.cancelled) { finishFailure(result.error || 'Payment cancelled'); return; }
            }

            // Handler returned void/null → it accepted the payment, native UI is open
            // Wait up to 10 minutes for the payment to complete via callback
            timeoutId = setTimeout(() => {
              finishFailure(new Error('Payment timed out. Please try again.'));
            }, 10 * 60 * 1000);
            return; // Stop trying more handlers

          } catch (err) {
            if (err.message === 'timeout') {
              continue; // handler not registered, try next name
            }
            console.warn(`[Razorpay Flutter] Handler "${handlerName}" rejected:`, err);
          }
        }

        if (settled) return;

        // ─── No Flutter native Razorpay handler found ─────────────────────
        // Fallback: open standard web Razorpay checkout inside the WebView.
        // This is the safe path for Flutter apps without native Razorpay SDK.
        console.warn('[Razorpay Flutter] No native handler found. Falling back to web checkout.');
        cleanup(); // remove global listeners before opening web checkout

        try {
          await loadRazorpayScript();
          if (!window.Razorpay) throw new Error('Razorpay web SDK unavailable');

          const rzp = new window.Razorpay({
            key: rzpOptions.key,
            amount: rzpOptions.amount,
            currency: rzpOptions.currency || 'INR',
            order_id: rzpOptions.order_id,
            name: rzpOptions.name || 'Payment',
            description: rzpOptions.description || '',
            prefill: rzpOptions.prefill || {},
            notes: rzpOptions.notes || {},
            theme: { color: '#FF0000' },
            retry: { enabled: true, max_count: 3 },
            handler: (response) => {
              resolve({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || rzpOptions.order_id,
                razorpay_signature: response.razorpay_signature || '',
              });
            },
            modal: {
              ondismiss: () => reject(new Error('Payment cancelled')),
              escape: true,
              animation: true,
            },
          });
          rzp.on('payment.failed', (resp) => {
            reject(new Error(resp?.error?.description || 'Payment failed'));
          });
          rzp.open();
        } catch (webErr) {
          reject(new Error('Payment unavailable. Please try again.'));
        }
      };

      tryHandlers();
    } catch (e) {
      reject(new Error('Flutter payment bridge unavailable'));
    }
  });
};
