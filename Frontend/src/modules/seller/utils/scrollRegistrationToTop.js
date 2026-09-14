export function scrollRegistrationToTop() {
  if (typeof window === "undefined") return;

  const reset = (node) => {
    if (!node) return;
    if (typeof node.scrollTo === "function") {
      node.scrollTo(0, 0);
    }
    node.scrollTop = 0;
  };

  reset(window);
  reset(document.documentElement);
  reset(document.body);
  reset(document.getElementById("seller-onboarding-page"));
  reset(document.getElementById("onboarding-main-scroll"));

  let parent = document.getElementById("onboarding-main-scroll")?.parentElement;
  while (parent && parent !== document.body) {
    reset(parent);
    parent = parent.parentElement;
  }
}
