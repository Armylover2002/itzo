import React from 'react';

const ITEMS = [
  '🍕 Pizza', '🍔 Burgers', '🍛 Biryani', '🥟 Momos', '🌯 Rolls',
  '🍰 Desserts', '🥡 Chinese', '🥘 South Indian', '🍜 Noodles', '🥗 Healthy',
];

/**
 * Infinitely auto-scrolling strip of food-category pills, sitting right below
 * the hero. Purely decorative motion — gives the page a distinct, "alive" band
 * between the hero and the content sections instead of a flat seam.
 */
const MarqueeStrip = React.memo(function MarqueeStrip() {
  // Render the list twice back-to-back so the CSS animation can loop seamlessly.
  const loop = [...ITEMS, ...ITEMS];

  return (
    <div className="relative w-full bg-[#150a05] py-4 overflow-hidden">
      <div className="flex w-max classic-marquee-track hover:[animation-play-state:paused]">
        {loop.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-2 px-6 text-white/70 text-base md:text-lg font-semibold whitespace-nowrap"
          >
            {item}
            <span className="text-[#FE5502] ml-6">•</span>
          </span>
        ))}
      </div>
    </div>
  );
});

export default MarqueeStrip;
