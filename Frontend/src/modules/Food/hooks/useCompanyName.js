import { useBusinessSettingsCache } from '@common/hooks/useBusinessSettingsCache';
import { getCompanyName } from '@common/utils/businessSettings';

/**
 * Custom hook to get company name from business settings cache
 * @returns {string} Company name with fallback to "Appzeto"
 */
export const useCompanyName = () => {
  const settings = useBusinessSettingsCache();
  return settings?.companyName || getCompanyName();
};
