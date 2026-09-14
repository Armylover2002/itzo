const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/**
 * Notifications Utility Functions
 * Centralized management for notifications
 */

import { getTransactionsByType, getTransactionsByStatus } from './walletState'

/**
 * Get unread notification count
 * @returns {number} - Count of unread notifications
 */
export const getUnreadNotificationCount = () => {
  try {
    // Get wallet transactions for notifications
    const paymentTransactions = getTransactionsByType("payment").slice(0, 3)
    const completedWithdrawals = getTransactionsByStatus("Completed").slice(0, 2)
    
    // Count unread wallet notifications
    let unreadCount = 0
    if (paymentTransactions.length > 0) {
      unreadCount += 1 // First payment notification is unread
    }
    
    return unreadCount
  } catch (error) {
    debugError('Error getting unread notification count:', error)
    return 0
  }
}


