/**
 * Shared type scale for every landing-page section (except the Hero, which is
 * its own full-bleed moment, and the GoldSection PRO wordmark, which is a
 * deliberate one-off brand treatment). Keeping every other section's eyebrow /
 * heading / body on these three classes is what makes the page read as one
 * consistent design instead of each section inventing its own sizes/colors.
 */
export const EYEBROW =
  'inline-flex items-center gap-2 rounded-full bg-[#FE5502]/10 px-4 py-1.5 text-[#FE5502] text-xs sm:text-sm font-bold tracking-[0.18em] uppercase';

export const HEADING =
  'text-4xl sm:text-5xl md:text-6xl font-black leading-[1.08] tracking-tight text-slate-900';

export const BODY =
  'text-base sm:text-lg md:text-xl text-slate-500 font-medium leading-relaxed';
