const PROFILE_SESSION_TTL_MS = 3 * 60 * 1000;
const ADDRESSES_SESSION_TTL_MS = 3 * 60 * 1000;

let profileCache = { data: null, token: null, fetchedAt: 0 };
let addressesCache = { data: null, token: null, fetchedAt: 0 };

const getToken = () =>
  localStorage.getItem("user_accessToken") ||
  localStorage.getItem("auth_customer") ||
  localStorage.getItem("accessToken") ||
  null;

export const getCachedUserProfile = () => {
  const token = getToken();
  if (!token || profileCache.token !== token) return null;
  if (Date.now() - profileCache.fetchedAt > PROFILE_SESSION_TTL_MS) return null;
  return profileCache.data;
};

export const setCachedUserProfile = (profile) => {
  const token = getToken();
  if (!token || !profile) return;
  profileCache = { data: profile, token, fetchedAt: Date.now() };
};

export const getCachedUserAddresses = () => {
  const token = getToken();
  if (!token || addressesCache.token !== token) return null;
  if (Date.now() - addressesCache.fetchedAt > ADDRESSES_SESSION_TTL_MS) return null;
  return addressesCache.data;
};

export const setCachedUserAddresses = (addresses) => {
  const token = getToken();
  if (!token) return;
  addressesCache = {
    data: Array.isArray(addresses) ? addresses : [],
    token,
    fetchedAt: Date.now(),
  };
};

export const invalidateUserSessionCache = () => {
  profileCache = { data: null, token: null, fetchedAt: 0 };
  addressesCache = { data: null, token: null, fetchedAt: 0 };
};

export const getUserIdFromStorage = () => {
  try {
    const raw = localStorage.getItem("user_user") || localStorage.getItem("userProfile");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?._id?.toString() || user?.userId || user?.id || null;
  } catch {
    return null;
  }
};
