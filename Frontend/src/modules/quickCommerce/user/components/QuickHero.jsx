import cardBanner from '../assets/CardBanner.jpg';

export default function QuickHero() {
  return (
    <section className="mx-auto mt-3 max-w-7xl px-3 md:px-6">
      <div className="overflow-hidden rounded-2xl border border-[#ececec] bg-white shadow-sm">
        <img src={cardBanner} alt="Quick Commerce Banner" className="h-[170px] w-full object-cover md:h-[220px]" />
      </div>
    </section>
  );
}
