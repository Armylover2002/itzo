import { memo } from "react";
import { BadgeCheck, Bike, Heart } from "lucide-react";

const DEFAULT_PERKS = [
  "Offline Menu Price Match",
  "₹0 Platform Fee",
  "₹0 Packaging Fee",
];

// Scalloped top/bottom edge, cut out of the card with a mask so it looks the same
// on any page background (light or dark) without extra wave layers.
const SCALLOP = "radial-gradient(circle at 50% 0, transparent 5px, #000 5.5px)";
const SCALLOP_BOTTOM = "radial-gradient(circle at 50% 100%, transparent 5px, #000 5.5px)";
const scallopMask = `${SCALLOP} top / 22px 51% repeat-x, ${SCALLOP_BOTTOM} bottom / 22px 51% repeat-x`;

function PerksBanner({ perks = DEFAULT_PERKS }) {
  const items = Array.isArray(perks) && perks.length > 0 ? perks : DEFAULT_PERKS;

  return (
    <section className="px-4 py-2 sm:py-3 lg:py-5 max-w-7xl mx-auto" aria-label="Why order with us">
      <div
        className="relative overflow-hidden bg-gradient-to-r from-[#F35B1C] via-[#FB4F01] to-[#FF7A2F] px-5 py-5 sm:px-8 sm:py-6 text-white shadow-md"
        style={{ WebkitMask: scallopMask, mask: scallopMask }}
      >
        {/* soft decorative glow */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center justify-between gap-3">
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2.5">
            {items.map((perk, index) => (
              <li
                key={perk}
                className={`flex items-center gap-1.5 text-[13px] sm:text-base font-bold leading-tight ${
                  index === 0 ? "w-full sm:w-auto" : ""
                }`}
              >
                <BadgeCheck className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-white" strokeWidth={2.5} />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          {/* rider illustration */}
          <div className="relative shrink-0" aria-hidden="true">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
              <Bike className="h-8 w-8 sm:h-10 sm:w-10 text-white" strokeWidth={2} />
            </div>
            <Heart
              className="absolute -right-1 -top-1 h-5 w-5 sm:h-6 sm:w-6 fill-white text-white drop-shadow"
              strokeWidth={0}
            />
          </div>
        </div>

      </div>
    </section>
  );
}

export default memo(PerksBanner);
