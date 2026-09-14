const GENERIC_CUSTOMER_NAMES = new Set(['', 'customer', 'unknown', 'guest', 'user']);

export const isGenericCustomerLabel = (value) =>
  GENERIC_CUSTOMER_NAMES.has(String(value || '').trim().toLowerCase());

const pickCustomerField = (...candidates) => {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value && !isGenericCustomerLabel(value)) return value;
  }
  return '';
};

export const resolveQuickOrderCustomer = (order, sellerOrder = null) => {
  const populatedUser =
    order?.userId && typeof order.userId === 'object' ? order.userId : null;

  const name =
    pickCustomerField(
      order?.deliveryAddress?.name,
      populatedUser?.name,
      populatedUser?.fullName,
      order?.customer?.name,
      order?.customerName,
      order?.userName,
      order?.shippingAddress?.name,
      sellerOrder?.customer?.name,
    ) || 'Customer';

  const phone = String(
    order?.deliveryAddress?.phone ||
      order?.customer?.phone ||
      sellerOrder?.customer?.phone ||
      populatedUser?.phone ||
      '',
  ).trim();

  const email = String(
    order?.customer?.email || populatedUser?.email || '',
  ).trim();

  const id =
    populatedUser?._id ||
    populatedUser?.id ||
    (order?.userId && typeof order.userId !== 'object' ? order.userId : null) ||
    null;

  return {
    _id: id,
    id,
    name,
    phone,
    email,
  };
};
