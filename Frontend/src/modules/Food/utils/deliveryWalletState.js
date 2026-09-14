const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/**
 * Delivery Wallet State Management Utility
 * Fetches wallet data from API instead of using localStorage/default data
 */

import { deliveryAPI } from '@food/api'

// Empty wallet state structure (no default data)
const EMPTY_WALLET_STATE = {
  totalBalance: 0,
  cashInHand: 0,
  totalWithdrawn: 0,
  totalEarned: 0,
  transactions: [],
  joiningBonusClaimed: false,
  joiningBonusAmount: 0
}

/**
 * Fetch wallet data from API
 * @returns {Promise<Object>} - Wallet state object
 */
export const fetchDeliveryWallet = async () => {
  try {
    debugLog('?? Starting wallet fetch...')
    const response = await deliveryAPI.getWallet()
    debugLog('?? Full API Response:', JSON.stringify(response, null, 2))
    debugLog('?? Response Status:', response?.status)
    debugLog('?? Response Data:', response?.data)
    debugLog('?? Response Data Type:', typeof response?.data)
    
    // Check multiple possible response structures
    let walletData = null
    
    if (response?.data?.success && response?.data?.data?.wallet) {
      walletData = response.data.data.wallet
      debugLog('? Found wallet in: response.data.data.wallet')
    } else if (response?.data?.wallet) {
      walletData = response.data.wallet
      debugLog('? Found wallet in: response.data.wallet')
    } else if (response?.data?.data) {
      walletData = response.data.data
      debugLog('? Found wallet in: response.data.data')
    } else if (response?.data) {
      walletData = response.data
      debugLog('? Found wallet in: response.data')
    }
    
    if (walletData) {
      debugLog('?? Wallet Data from API:', JSON.stringify(walletData, null, 2))
      debugLog('?? Total Balance:', walletData.totalBalance)
      debugLog('?? Cash In Hand:', walletData.cashInHand)
      debugLog('?? Total Earned:', walletData.totalEarned)
      debugLog('?? Transactions Count:', walletData.transactions?.length || walletData.recentTransactions?.length || 0)
      debugLog('?? Transactions:', walletData.transactions || walletData.recentTransactions || [])
      
      // Transform API response to match expected format (support both camelCase and snake_case)
      const transformedData = {
        totalBalance: Number(walletData.totalBalance) || 0,
        cashInHand: Number(walletData.cashInHand ?? walletData.cash_in_hand) || 0,
        totalWithdrawn: Number(walletData.totalWithdrawn) || 0,
        totalEarned: Number(walletData.totalEarned) || 0,
        totalCashLimit: Number(walletData.totalCashLimit) || 0,
        availableCashLimit: Number(walletData.availableCashLimit) || 0,
        deliveryWithdrawalLimit: Number(walletData.deliveryWithdrawalLimit ?? walletData.delivery_withdrawal_limit) || 100,
        // Pocket balance = total balance (includes bonus)
        pocketBalance: walletData.pocketBalance !== undefined ? Number(walletData.pocketBalance) : (Number(walletData.totalBalance) || 0),
        pendingWithdrawals: walletData.pendingWithdrawals || 0,
        joiningBonusClaimed: walletData.joiningBonusClaimed || false,
        joiningBonusAmount: walletData.joiningBonusAmount || 0,
        // Use 'transactions' field (all transactions) for weekly calculations, fallback to recentTransactions for backward compatibility
        transactions: walletData.transactions || walletData.recentTransactions || [],
        totalTransactions: walletData.totalTransactions || 0
      }
      
      debugLog('? Transformed Wallet Data:', JSON.stringify(transformedData, null, 2))
      return transformedData
    } else {
      debugWarn('?? No wallet data found in response')
      debugWarn('?? Response structure:', Object.keys(response?.data || {}))
      debugWarn('?? Full response:', response)
    }
    
    debugLog('?? Returning empty wallet state')
    return EMPTY_WALLET_STATE
  } catch (error) {
    // Skip logging network errors - they're handled by axios interceptor
    // Network errors mean backend is not running, which is expected in some scenarios
    if (error.code !== 'ERR_NETWORK' && error.message !== 'Network Error') {
      debugError('? Error fetching wallet data:', error)
      debugError('? Error response:', error.response)
      debugError('? Error response data:', error.response?.data)
      debugError('? Error message:', error.message)
    }
    return EMPTY_WALLET_STATE
  }
}

/**
 * Get delivery wallet state (deprecated - use fetchDeliveryWallet instead)
 * Kept for backward compatibility but returns empty state
 * @returns {Object} - Wallet state object
 */
export const getDeliveryWalletState = () => {
  // Return empty state - should use fetchDeliveryWallet() instead
  debugWarn('getDeliveryWalletState is deprecated. Use fetchDeliveryWallet() instead.')
  return EMPTY_WALLET_STATE
}

/**
 * Save delivery wallet state (deprecated - data is managed by backend)
 * @param {Object} state - Wallet state object
 */
export const setDeliveryWalletState = (state) => {
  // No-op - data is managed by backend
  debugWarn('setDeliveryWalletState is deprecated. Wallet data is managed by backend.')
}

/**
 * Calculate all balances dynamically
 * @param {Object} state - Wallet state
 * @returns {Object} - Calculated balances
 */
export const calculateDeliveryBalances = (state) => {
  debugLog('?? calculateDeliveryBalances called with state:', state)
  
  if (!state) {
    debugWarn('?? No state provided to calculateDeliveryBalances')
    return {
      totalBalance: 0,
      cashInHand: 0,
      totalWithdrawn: 0,
      pendingWithdrawals: 0,
      totalEarnings: 0
    }
  }
  
  // ALWAYS use totalBalance directly from state (backend calculated value)
  // Don't recalculate from transactions as backend is source of truth
  const totalBalance = state.totalBalance || 0
  const cashInHand = state.cashInHand || 0
  const totalWithdrawn = state.totalWithdrawn || 0
  const totalEarned = state.totalEarned || 0
  
  debugLog('?? Balance values:', { totalBalance, cashInHand, totalWithdrawn, totalEarned })
  
  // Calculate pending withdrawals from transactions if available
  let pendingWithdrawals = state.pendingWithdrawals || 0
  if (state.transactions && Array.isArray(state.transactions)) {
    const pendingFromTransactions = state.transactions
      .filter(t => t.type === 'withdrawal' && t.status === 'Pending')
      .reduce((sum, t) => sum + (t.amount || 0), 0)
    if (pendingFromTransactions > 0) {
      pendingWithdrawals = pendingFromTransactions
    }
  }
  
  // Calculate total earnings from transactions for display purposes
  let totalEarningsFromTransactions = totalEarned
  if (state.transactions && Array.isArray(state.transactions)) {
    const earningsFromTransactions = state.transactions
      .filter(t => t.type === 'payment' && t.status === 'Completed') // Exclude bonus from earnings
      .reduce((sum, t) => sum + (t.amount || 0), 0)
    if (earningsFromTransactions > 0) {
      totalEarningsFromTransactions = earningsFromTransactions
    }
  }
  
  const balances = {
    totalBalance: totalBalance,
    cashInHand: cashInHand,
    totalWithdrawn: totalWithdrawn,
    pendingWithdrawals: pendingWithdrawals,
    totalEarnings: totalEarningsFromTransactions || totalEarned || totalBalance || 0
  }
  
  debugLog('?? Calculated balances:', balances)
  return balances
}

/**
 * Calculate earnings for a specific time period
 * @param {Object} state - Wallet state
 * @param {string} period - Period: 'today', 'week', 'month'
 * @returns {number} - Earnings for the period
 */
export const calculatePeriodEarnings = (state, period) => {
  if (!state || !state.transactions || !Array.isArray(state.transactions)) {
    return 0
  }

  const now = new Date()
  let startDate = new Date()
  
  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0)
      break
    case 'week':
      startDate.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
      startDate.setDate(1) // First day of month
      startDate.setHours(0, 0, 0, 0)
      break
    default:
      return 0
  }
  
  return state.transactions
    .filter(t => {
      // Include both payment and earning_addon transactions in earnings
      if (t.type !== 'payment' && t.type !== 'earning_addon') return false
      if (t.status !== 'Completed') return false
      
      const transactionDate = t.date ? new Date(t.date) : (t.createdAt ? new Date(t.createdAt) : null)
      if (!transactionDate) return false
      
      return transactionDate >= startDate && transactionDate <= now
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0)
}

/**
 * Fetch wallet transactions from API
 * @param {Object} params - Query params (type, status, page, limit)
 * @returns {Promise<Array>} - Array of transactions
 */
export const fetchWalletTransactions = async (params = {}) => {
  try {
    const response = await deliveryAPI.getWalletTransactions(params)
    if (response?.data?.success && response?.data?.data?.transactions) {
      return response.data.data.transactions
    }
    return []
  } catch (error) {
    debugError('Error fetching wallet transactions:', error)
    return []
  }
}

/**
 * Create withdrawal request
 * @param {number} amount - Withdrawal amount
 * @param {string} paymentMethod - Payment method (bank_transfer, upi, card)
 * @param {Object} details - Additional details (bankDetails, upiId, etc.)
 * @returns {Promise<Object>} - Created transaction
 */
export const createWithdrawalRequest = async (amount, paymentMethod, details = {}) => {
  try {
    const response = await deliveryAPI.createWithdrawalRequest({
      amount,
      paymentMethod,
      ...details
    })
    if (response?.data?.success) {
      return response.data.data
    }
    throw new Error(response?.data?.message || 'Failed to create withdrawal request')
  } catch (error) {
    debugError('Error creating withdrawal request:', error)
    throw error
  }
}

/**
 * Collect payment (mark COD payment as collected)
 * @param {string} orderId - Order ID
 * @param {number} amount - Payment amount (optional)
 * @returns {Promise<Object>} - Updated transaction
 */
export const collectPayment = async (orderId, amount = null) => {
  try {
    const response = await deliveryAPI.collectPayment({
      orderId,
      amount
    })
    if (response?.data?.success) {
      return response.data.data
    }
    throw new Error(response?.data?.message || 'Failed to collect payment')
  } catch (error) {
    debugError('Error collecting payment:', error)
    throw error
  }
}

/**
 * Get transactions by type (deprecated - use fetchWalletTransactions instead)
 * @param {string} type - Transaction type (withdrawal, payment, all)
 * @returns {Array} - Filtered transactions
 */
export const getDeliveryTransactionsByType = (type = 'all') => {
  debugWarn('getDeliveryTransactionsByType is deprecated. Use fetchWalletTransactions() instead.')
  return []
}

/**
 * Get transactions by status (deprecated - use fetchWalletTransactions instead)
 * @param {string} status - Transaction status (Pending, Completed, Failed)
 * @returns {Array} - Filtered transactions
 */
export const getDeliveryTransactionsByStatus = (status) => {
  debugWarn('getDeliveryTransactionsByStatus is deprecated. Use fetchWalletTransactions() instead.')
  return []
}

/**
 * Get order payment amount from wallet transactions (deprecated - use API)
 * @param {string|number} orderId - Order ID
 * @returns {number|null} - Payment amount if found, null otherwise
 */
export const getDeliveryOrderPaymentAmount = (orderId) => {
  debugWarn('getDeliveryOrderPaymentAmount is deprecated. Use API to fetch transactions instead.')
  return null
}

/**
 * Get payment status for an order (deprecated - use API)
 * @param {string|number} orderId - Order ID
 * @returns {string} - Payment status ("Paid" or "Unpaid")
 */
export const getDeliveryOrderPaymentStatus = (orderId) => {
  debugWarn('getDeliveryOrderPaymentStatus is deprecated. Use API to fetch transactions instead.')
  return "Unpaid"
}

/**
 * Check if payment is collected for an order (deprecated - use API)
 * @param {string|number} orderId - Order ID
 * @returns {boolean} - Whether payment is collected
 */
export const isPaymentCollected = (orderId) => {
  debugWarn('isPaymentCollected is deprecated. Use API to fetch transactions instead.')
  return false
}

/**
 * Add delivery transaction (deprecated - use API instead)
 * @param {Object} transaction - Transaction object
 */
export const addDeliveryTransaction = (transaction) => {
  debugWarn('addDeliveryTransaction is deprecated. Use API endpoints instead.')
  return null
}

/**
 * Create a withdraw request (deprecated - use createWithdrawalRequest instead)
 * @param {number} amount - Withdrawal amount
 * @param {string} paymentMethod - Payment method
 * @returns {Object} - Created transaction
 */
export const createDeliveryWithdrawRequest = (amount, paymentMethod) => {
  debugWarn('createDeliveryWithdrawRequest is deprecated. Use createWithdrawalRequest() instead.')
  return createWithdrawalRequest(amount, paymentMethod)
}

/**
 * Add delivery earnings from completed order (deprecated - use API instead)
 * @param {number} amount - Delivery earnings amount
 * @param {string} orderId - Order ID
 * @param {string} description - Payment description
 * @param {boolean} paymentCollected - Whether payment is collected (for COD)
 */
export const addDeliveryEarnings = (amount, orderId, description, paymentCollected = false) => {
  debugWarn('addDeliveryEarnings is deprecated. Use deliveryAPI.addEarning() instead.')
  return deliveryAPI.addEarning({
    amount,
    orderId,
    description,
    paymentCollected
  })
}

