import React from 'react';
import discountPromoIcon from "@food/assets/category-icons/discount_promo.png";
import vegPromoIcon from "@food/assets/category-icons/veg_promo.png";
import pricePromoIcon from "@food/assets/category-icons/price_promo.png";
import comboPromoIcon from "@food/assets/category-icons/combo_promo.png";
import streetFoodPromoIcon from "@food/assets/category-icons/swadeshi.png";

export default function PromoRow({ handleVegModeChange, navigate, isVegMode, toggleRef, variant = "mobile" }) {
  const promoCardsData = [
    {
      id: 'offers',
      title: "MIN.",
      value: "40% off",
      icon: discountPromoIcon,
      gradient: 'linear-gradient(145deg, #ff4e6a, #c62a47)',
      shadowColor: 'rgba(198,42,71,0.35)',
      textColor: '#ffffff',
      subTextColor: 'rgba(255,255,255,0.80)',
    },
    {
      id: 'pure-veg',
      title: "PURE",
      value: "Veg",
      icon: vegPromoIcon,
      gradient: isVegMode
        ? 'linear-gradient(145deg, #1b5e20, #2e7d32)'
        : 'linear-gradient(145deg, #2e7d32, #43a047)',
      shadowColor: 'rgba(46,125,50,0.40)',
      textColor: '#ffffff',
      subTextColor: 'rgba(255,255,255,0.80)',
    },
    {
      id: 'under-250',
      title: "UNDER",
      value: "₹250",
      icon: pricePromoIcon,
      gradient: 'linear-gradient(145deg, #e65100, #f57c00)',
      shadowColor: 'rgba(230,81,0,0.35)',
      textColor: '#ffffff',
      subTextColor: 'rgba(255,255,255,0.80)',
    },
    {
      id: 'combos',
      title: "BEST",
      value: "Combos",
      icon: comboPromoIcon,
      gradient: 'linear-gradient(145deg, #1565c0, #1976d2)',
      shadowColor: 'rgba(21,101,192,0.35)',
      textColor: '#ffffff',
      subTextColor: 'rgba(255,255,255,0.80)',
    },
    {
      id: 'street-food',
      title: "STREET",
      value: "Food",
      icon: streetFoodPromoIcon,
      gradient: 'linear-gradient(145deg, #6a1b9a, #8e24aa)',
      shadowColor: 'rgba(106,27,154,0.35)',
      textColor: '#ffffff',
      subTextColor: 'rgba(255,255,255,0.80)',
    },
  ];

  const isDesktop = variant === "desktop";

  return (
    <div
      className={
        isDesktop
          ? "grid h-full grid-cols-2 gap-3 p-4"
          : "grid grid-cols-4 gap-2.5 px-3.5 pt-4 pb-8 bg-white"
      }
    >
      {promoCardsData.map((promo) => (
        <div
          key={promo.id}
          ref={promo.id === 'pure-veg' ? toggleRef : null}
          className={`rounded-[22px] flex flex-col items-center overflow-hidden cursor-pointer active:scale-95 group transition-all duration-300 ${isDesktop ? "min-h-[148px]" : ""}`}
          style={{
            background: promo.gradient,
            boxShadow: `0 6px 20px ${promo.shadowColor}, 0 2px 8px rgba(0,0,0,0.12)`,
            minHeight: isDesktop ? "148px" : "168px",
            border: promo.id === 'pure-veg' && isVegMode ? '2.5px solid rgba(165,214,167,0.7)' : '2px solid rgba(255,255,255,0.10)',
          }}
          onClick={() => {
            if (promo.id === 'pure-veg') handleVegModeChange(!isVegMode);
            else if (promo.id === 'offers') navigate('/food/user/offers');
            else if (promo.id === 'under-250') navigate('/food/user/under-250');
            else if (promo.id === 'street-food') navigate('/food/user/street-food');
          }}
        >
          {/* Label Section */}
          <div className="py-3 px-1 flex flex-col items-center text-center">
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: promo.subTextColor,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                lineHeight: 1,
                marginBottom: '3px',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {promo.title}
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 900,
                color: promo.textColor,
                lineHeight: 1.1,
                fontFamily: "'Inter', 'Outfit', sans-serif",
                letterSpacing: '-0.3px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                paddingLeft: '4px',
                paddingRight: '4px',
              }}
            >
              {promo.value}
            </span>
          </div>

          {/* Image Capsule Container */}
          <div className="flex-1 w-full rounded-t-[0px] rounded-b-[20px] flex items-center justify-center overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/10 pointer-events-none" />
            <img
              src={promo.icon}
              alt={promo.value}
              className="w-[90%] h-[90%] object-contain drop-shadow-lg transform group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
