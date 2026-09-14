export const PAGINATION_CONFIG = {
  defaultPage: 1,
  defaultPageSize: 30,
  /**
   * Allowed page sizes across the app.
   * Components should read from here instead of hardcoding values.
   */
  allowedPageSizeOptions: [10, 20, 30, 50],
  /**
   * UI-side maximum. Backend also enforces an independent maximum.
   */
  maximumPageSize: 1000,
};

export const PAGE_SIZE = {
  FIVE: 5,
  TEN: 10,
  FIFTEEN: 15,
  TWENTY: 20,
  THIRTY: 30,
  FIFTY: 50,
};

