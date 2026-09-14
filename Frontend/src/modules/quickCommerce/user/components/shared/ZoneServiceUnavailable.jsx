import React from 'react';
import { MapPinOff, MapPin } from 'lucide-react';

const DEFAULT_MESSAGE = 'Services not available in your area';

/**
 * Empty state when user location is outside a QC zone or the zone has no sellers/products.
 */
const ZoneServiceUnavailable = ({
  message = DEFAULT_MESSAGE,
  title = 'Services not available',
  className = '',
  actionLabel = 'Select delivery location',
  onAction,
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center px-6 py-16 ${className}`}
    role="status"
    aria-live="polite"
  >
    <div className="h-16 w-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4 ring-1 ring-rose-100">
      <MapPinOff className="h-7 w-7" />
    </div>
    <h3 className="text-base font-black text-slate-900 tracking-tight">{title}</h3>
    <p className="mt-2 text-sm font-medium text-slate-500 max-w-sm leading-relaxed">
      {message || DEFAULT_MESSAGE}
    </p>
    {typeof onAction === 'function' ? (
      <button
        type="button"
        onClick={onAction}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FF0000] px-5 py-2.5 text-sm font-bold text-white shadow-sm active:scale-95 transition-transform"
      >
        <MapPin className="h-4 w-4" />
        {actionLabel}
      </button>
    ) : null}
  </div>
);

export default ZoneServiceUnavailable;
export { DEFAULT_MESSAGE as ZONE_SERVICE_UNAVAILABLE_MESSAGE };
