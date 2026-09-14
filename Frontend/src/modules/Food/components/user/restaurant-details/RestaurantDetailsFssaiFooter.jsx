import fssaiLogo from "@food/assets/fssai.png";

export default function RestaurantDetailsFssaiFooter({ registrationNumber }) {
  if (!registrationNumber) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-28">
      <div className="px-4 py-4 mt-2 border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-20 flex items-center justify-center bg-white rounded-lg p-1.5 shadow-sm border border-gray-100">
            <img src={fssaiLogo} alt="FSSAI" className="h-full w-auto object-contain" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1">
              License No.
            </p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 font-mono tracking-wide">
              {registrationNumber}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
