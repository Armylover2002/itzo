import { useLayoutEffect } from "react";
import QuickCommerceHomePage from "../../../quickCommerce/user/pages/Home";
import { LocationProvider as QuickLocationProvider } from "../../../quickCommerce/user/context/LocationContext";
import { ProductDetailProvider as QuickProductDetailProvider } from "../../../quickCommerce/user/context/ProductDetailContext";
import { WishlistProvider as QuickWishlistProvider } from "../../../quickCommerce/user/context/WishlistContext";
import { CartAnimationProvider as QuickCartAnimationProvider } from "../../../quickCommerce/user/context/CartAnimationContext";
import { CartProvider as QuickCartProvider } from "../../../quickCommerce/user/context/CartContext";

export default function Quick({ onThemeChange, embeddedHeaderColor }) {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    const previousScrollRestoration =
      "scrollRestoration" in window.history
        ? window.history.scrollRestoration
        : null;

    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    resetScroll();

    let nestedFrameId = null;
    const frameId = window.requestAnimationFrame(() => {
      resetScroll();
      nestedFrameId = window.requestAnimationFrame(resetScroll);
    });
    const timeoutId = window.setTimeout(resetScroll, 250);

    return () => {
      window.cancelAnimationFrame(frameId);
      if (nestedFrameId !== null) {
        window.cancelAnimationFrame(nestedFrameId);
      }
      window.clearTimeout(timeoutId);

      if (
        previousScrollRestoration &&
        "scrollRestoration" in window.history
      ) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <QuickLocationProvider>
        <QuickCartProvider>
          <QuickWishlistProvider>
            <QuickCartAnimationProvider>
              <QuickProductDetailProvider>
                <QuickCommerceHomePage
                  embedded
                  onThemeChange={onThemeChange}
                  embeddedHeaderColor={embeddedHeaderColor}
                />
              </QuickProductDetailProvider>
            </QuickCartAnimationProvider>
          </QuickWishlistProvider>
        </QuickCartProvider>
      </QuickLocationProvider>
    </div>
  );
}
