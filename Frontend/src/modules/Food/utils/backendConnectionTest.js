/**
 * Backend Connection Test Utility (MOCKED for Static Mode)
 */

export async function testBackendHealth() {
  return { success: true, data: { status: "MOCKED", mode: "static-only" } };
}

export async function testRestaurantAPI() {
  return { success: true, data: { count: 10, mode: "static-only" } };
}

export async function runConnectionTests() {
  console.log('✅ [Static Mode] Skipping backend connection tests.');
  return {
    health: { success: true },
    restaurantAPI: { success: true }
  };
}

export function displayConnectionStatus() {
  return {
    type: 'success',
    title: 'Static Mode Active',
    message: 'The frontend is running in standalone static mode.'
  };
}
