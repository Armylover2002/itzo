import React from 'react';
import { MapPin, ChefHat, Package, Clock, Phone } from 'lucide-react';
import { formatDeliveryAddressText, isMixedOrder, normalizePickupPoints, isReturnPickupTrip, getReturnPickupStopLabels, resolveDeliveryCustomerName } from '@/modules/DeliveryV2/utils/orderRouting';

const BaseOrderHeader = ({ title, subtitle, badges, earnings, timeLeft, bgColor = 'bg-[#FF0000]', orderId }) => (
  <div className={`${bgColor} p-5 flex justify-between items-center text-white border-b border-black/10`}>
    <div>
      <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-0.5">{title}</p>
      {orderId && (
        <div className="mb-2 inline-flex items-center rounded-lg bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white font-mono shadow-sm">
          ID: {orderId}
        </div>
      )}
      {subtitle && (
        <div className="mb-2 ml-2 inline-flex items-center rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          {subtitle}
        </div>
      )}
      {badges && badges.map((badge, idx) => (
        <div key={idx} className="mb-2 ml-1 inline-flex items-center rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          {badge}
        </div>
      ))}
      <h2 className="text-3xl font-extrabold tracking-tight">₹{Number(earnings || 0).toFixed(2)}</h2>
    </div>
    <div className="bg-white/20 border border-white/30 rounded-2xl px-4 py-2 text-white font-bold text-xl shadow-inner tabular-nums">
      {timeLeft}s
    </div>
  </div>
);

const BaseOrderBody = ({ pickupStops, dropPoint, customerAddress, mapsLink, distanceKm, dropDistanceKm, etaMins, isReturnPickup, returnLabels, pickupIcon: PickupIcon = ChefHat }) => (
  <div className="p-5 space-y-6">
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-1 mt-1.5 py-0.5">
        <div className="w-4 h-4 rounded-full bg-black border-[3px] border-gray-100 shadow-lg" />
        <div className={`w-0.5 ${pickupStops.length > 1 ? 'h-24' : 'h-14'} bg-dashed border-l-2 border-gray-100`} />
        <div className="w-4 h-4 rounded-full bg-blue-500 border-[3px] border-blue-50 shadow-lg shadow-blue-500/20" />
      </div>
      <div className="flex-1 space-y-6">
        <div className="space-y-4">
          {pickupStops.map((pickup, index) => (
            <div key={pickup.id || index}>
              <div className={`flex items-center gap-2 mb-1.5 font-bold text-[9px] uppercase tracking-widest text-gray-500`}>
                <PickupIcon className="w-3.5 h-3.5" />
                <span>{pickupStops.length > 1 ? `Pickup ${index + 1}` : 'Pickup Location'}</span>
              </div>
              <p className="text-gray-950 font-bold text-lg leading-tight">{pickup.sourceName}</p>
              {pickup.phone && <p className="text-gray-600 text-xs font-semibold">{pickup.phone}</p>}
              <p className="text-gray-500 text-xs font-medium leading-relaxed">{pickup.address}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-bold text-[9px] uppercase tracking-widest text-blue-600">
            <MapPin className="w-3.5 h-3.5" />
            <span>{isReturnPickup ? returnLabels.dropLabel : 'Customer Drop'}</span>
          </div>
          <p className="text-gray-950 font-bold text-lg leading-tight">{dropPoint.name}</p>
          {dropPoint.phone && <p className="text-gray-600 text-xs font-semibold">{dropPoint.phone}</p>}
          <p className="text-gray-500 text-xs font-medium">{customerAddress}</p>
          {mapsLink && (
            <a href={mapsLink} target="_blank" rel="noreferrer" className="inline-flex mt-1 text-[9px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700">
              Open in Google Maps
            </a>
          )}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-1 items-center justify-center text-center">
        <Clock className="w-4 h-4 text-gray-500" />
        <div className="flex flex-col">
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Time</span>
          <span className="text-xs font-bold text-gray-900">{etaMins} MINS</span>
        </div>
      </div>
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-1 items-center justify-center text-center">
        <MapPin className="w-4 h-4 text-blue-500" />
        <div className="flex flex-col">
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Pickup</span>
          <span className="text-xs font-bold text-gray-900">{distanceKm} KM</span>
        </div>
      </div>
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-1 items-center justify-center text-center">
        <MapPin className="w-4 h-4 text-emerald-500" />
        <div className="flex flex-col">
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Drop</span>
          <span className="text-xs font-bold text-gray-900">{dropDistanceKm} KM</span>
        </div>
      </div>
    </div>
  </div>
);

// ----------------------
// RENDERERS
// ----------------------

const FoodOrderRenderer = ({ order, distanceKm, dropDistanceKm, etaMins, timeLeft }) => {
  const isReturnPickup = isReturnPickupTrip(order);
  const returnLabels = getReturnPickupStopLabels();
  const pickupPoints = normalizePickupPoints(order);
  const earnings = order.earnings || order.riderEarning || order.tripEarning || order.walletEarning || 0;
  const isFoodQuick =
    order?.isFoodQuickDelivery === true ||
    String(order?.deliveryMode || '').toLowerCase() === 'quick';
  const quickBonus = Number(order?.quickRiderBonus || 0) || 0;
  
  const restaurantName = order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant';
  const restaurantAddress = order?.restaurantAddress || order?.restaurant_address || order?.restaurantId?.location?.address || 'Address not available';
  
  const pickupStops = pickupPoints.length ? pickupPoints : [{
    id: 'food:primary',
    pickupType: 'food',
    sourceName: isReturnPickup ? resolveDeliveryCustomerName(order) : restaurantName,
    address: isReturnPickup
      ? formatDeliveryAddressText(order?.deliveryAddress || {}, order?.customerAddress || restaurantAddress)
      : restaurantAddress,
  }];

  const deliveryAddress = order?.deliveryAddress || {};
  const customerAddress = formatDeliveryAddressText(deliveryAddress, order.customerAddress || order.customer_address || '') || 'Location not available';
  const badges = [];
  if (isMixedOrder(order)) badges.push('Mixed Order');
  if (isFoodQuick) {
    badges.push('Food Quick');
    if (quickBonus > 0) badges.push(`+₹${Math.round(quickBonus)} Quick Bonus`);
  }
  
  return (
    <>
      <BaseOrderHeader 
        title={isReturnPickup ? (order.tripLabel || 'Return Pickup') : (isFoodQuick ? 'Quick Food Order' : 'Incoming Food Order')} 
        subtitle={isReturnPickup ? 'Customer → Seller' : (isFoodQuick ? 'Priority Offer' : null)}
        badges={badges}
        earnings={earnings} 
        timeLeft={timeLeft} 
        bgColor={isFoodQuick ? 'bg-emerald-600' : 'bg-[#FF0000]'}
        orderId={order?.orderId || order?._id}
      />
      <BaseOrderBody 
        pickupStops={pickupStops}
        dropPoint={{
          name: isReturnPickup ? order?.storeName || 'Seller' : resolveDeliveryCustomerName(order, 'Customer Location'),
          phone: isReturnPickup ? order?.storePhone || order?.sellerPhone : order?.customerPhone || order?.userPhone
        }}
        customerAddress={customerAddress}
        distanceKm={distanceKm}
        dropDistanceKm={dropDistanceKm}
        etaMins={etaMins}
        isReturnPickup={isReturnPickup}
        returnLabels={returnLabels}
        pickupIcon={ChefHat}
      />
    </>
  );
};

const QuickCommerceOrderRenderer = ({ order, distanceKm, dropDistanceKm, etaMins, timeLeft }) => {
  const pickupPoints = normalizePickupPoints(order);
  const earnings = order.earnings || order.riderEarning || order.tripEarning || order.walletEarning || 0;
  const storeName = order?.storeName || order?.sellerName || order?.seller?.shopName || 'Seller Store';
  const storeAddress = order?.storeAddress || order?.sellerAddress || order?.seller?.location?.address || 'Address not available';
  
  const pickupStops = pickupPoints.length ? pickupPoints : [{
    id: 'quick:primary',
    pickupType: 'quick',
    sourceName: storeName,
    address: storeAddress,
  }];

  const deliveryAddress = order?.deliveryAddress || {};
  const customerAddress = formatDeliveryAddressText(deliveryAddress, order.customerAddress || order.customer_address || '') || 'Location not available';
  
  return (
    <>
      <BaseOrderHeader 
        title="Quick Commerce Order"
        earnings={earnings} 
        timeLeft={timeLeft} 
        bgColor="bg-blue-600"
        orderId={order?.orderId || order?._id}
      />
      <BaseOrderBody 
        pickupStops={pickupStops}
        dropPoint={{
          name: resolveDeliveryCustomerName(order, 'Customer Location'),
          phone: order?.customerPhone || order?.userPhone
        }}
        customerAddress={customerAddress}
        distanceKm={distanceKm}
        dropDistanceKm={dropDistanceKm}
        etaMins={etaMins}
        pickupIcon={Package}
      />
    </>
  );
};

export const RenderNewOrder = (props) => {
  const { order } = props;
  const moduleType = String(order?.module || order?.orderType || order?.serviceType || order?.type || '').toLowerCase();

  if (moduleType === 'quick' || moduleType === 'quick_commerce') return <QuickCommerceOrderRenderer {...props} />;
  return <FoodOrderRenderer {...props} />;
};
