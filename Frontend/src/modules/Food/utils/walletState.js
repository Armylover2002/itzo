const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/**
 * Wallet State Management Utility
 * Centralized management for wallet balances, transactions, and withdrawals
 */

import { usdToInr } from './currency'

// Default wallet state structure (converted to INR)
const DEFAULT_WALLET_STATE = {
  // Balance values (in INR)
  totalEarning: usdToInr(8845.23),
  cashInHand: usdToInr(733.23),
  balanceUnadjusted: usdToInr(3777.23),
  withdrawalBalance: usdToInr(3044.00),
  pendingWithdraw: usdToInr(68.00),
  alreadyWithdraw: usdToInr(5000.00),
  
  // Transactions (in INR)
  transactions: [
    {
      id: 1,
      amount: usdToInr(68.00),
      description: "Transferred to Card",
      status: "Pending",
      date: "01 Jun 2023",
      type: "withdrawal"
    },
    {
      id: 2,
      amount: usdToInr(5000.00),
      description: "Transferred to Account",
      status: "Pending",
      date: "07 Feb 2023",
      type: "withdrawal"
    }
  ],
  
  // Withdraw requests
  withdrawRequests: []
}

const WALLET_STORAGE_KEY = 'restaurant_wallet_state'

/**
 * Get wallet state from localStorage
 * @returns {Object} - Wallet state object
 */
export const getWalletState = () => {
  try {
    const saved = localStorage.getItem(WALLET_STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
    // Initialize with default state
    setWalletState(DEFAULT_WALLET_STATE)
    return DEFAULT_WALLET_STATE
  } catch (error) {
    debugError('Error reading wallet state from localStorage:', error)
    return DEFAULT_WALLET_STATE
  }
}

/**
 * Save wallet state to localStorage
 * @param {Object} state - Wallet state object
 */
export const setWalletState = (state) => {
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(state))
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('walletStateUpdated'))
  } catch (error) {
    debugError('Error saving wallet state to localStorage:', error)
  }
}

/**
 * Calculate withdrawable balance
 * @param {Object} state - Wallet state
 * @returns {number} - Withdrawable balance
 */
export const calculateWithdrawableBalance = (state) => {
  return state.totalEarning - state.alreadyWithdraw - state.pendingWithdraw
}

/**
 * Calculate all balances dynamically
 * @param {Object} state - Wallet state
 * @returns {Object} - Calculated balances
 */
export const calculateBalances = (state) => {
  const withdrawableBalance = calculateWithdrawableBalance(state)
  
  // Calculate pending withdraw from transactions
  const pendingWithdrawFromTransactions = state.transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'Pending')
    .reduce((sum, t) => sum + t.amount, 0)
  
  // Calculate already withdraw from transactions
  const alreadyWithdrawFromTransactions = state.transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0)
  
  return {
    totalEarning: state.totalEarning,
    cashInHand: state.cashInHand,
    balanceUnadjusted: state.balanceUnadjusted,
    withdrawalBalance: withdrawableBalance,
    pendingWithdraw: pendingWithdrawFromTransactions,
    alreadyWithdraw: alreadyWithdrawFromTransactions
  }
}

/**
 * Add a transaction
 * @param {Object} transaction - Transaction object
 */
export const addTransaction = (transaction) => {
  const state = getWalletState()
  const newTransaction = {
    id: Date.now(),
    ...transaction,
    date: transaction.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  
  state.transactions.unshift(newTransaction)
  
  // Update balances based on transaction
  if (transaction.type === 'withdrawal' && transaction.status === 'Pending') {
    state.pendingWithdraw = calculateBalances(state).pendingWithdraw
    state.withdrawalBalance = calculateWithdrawableBalance(state)
  } else if (transaction.type === 'withdrawal' && transaction.status === 'Completed') {
    state.alreadyWithdraw = calculateBalances(state).alreadyWithdraw
    state.withdrawalBalance = calculateWithdrawableBalance(state)
    state.pendingWithdraw = calculateBalances(state).pendingWithdraw
  } else if (transaction.type === 'payment' && transaction.status === 'Completed') {
    state.totalEarning += transaction.amount
    state.withdrawalBalance = calculateWithdrawableBalance(state)
  }
  
  setWalletState(state)
  return newTransaction
}

/**
 * Create a withdraw request
 * @param {number} amount - Withdrawal amount
 * @param {string} paymentMethod - Payment method
 * @returns {Object} - Created transaction
 */
export const createWithdrawRequest = (amount, paymentMethod) => {
  const transaction = {
    amount: parseFloat(amount),
    description: `Withdrawal via ${paymentMethod}`,
    status: "Pending",
    type: "withdrawal",
    paymentMethod: paymentMethod
  }
  
  return addTransaction(transaction)
}

/**
 * Update transaction status
 * @param {number} transactionId - Transaction ID
 * @param {string} newStatus - New status (Pending, Completed, Failed)
 */
export const updateTransactionStatus = (transactionId, newStatus) => {
  const state = getWalletState()
  const transaction = state.transactions.find(t => t.id === transactionId)
  
  if (transaction) {
    const oldStatus = transaction.status
    transaction.status = newStatus
    
    // Recalculate balances
    const balances = calculateBalances(state)
    state.pendingWithdraw = balances.pendingWithdraw
    state.alreadyWithdraw = balances.alreadyWithdraw
    state.withdrawalBalance = balances.withdrawalBalance
    
    setWalletState(state)
    return transaction
  }
  
  return null
}

/**
 * Add payment from order
 * @param {number} amount - Payment amount
 * @param {string} orderId - Order ID
 * @param {string} description - Payment description
 */
export const addOrderPayment = (amount, orderId, description) => {
  const transaction = {
    amount: parseFloat(amount),
    description: description || `Payment received for Order #${orderId}`,
    status: "Completed",
    type: "payment",
    orderId: orderId
  }
  
  return addTransaction(transaction)
}

/**
 * Update balance adjustment status
 * @param {boolean} isAdjusted - Whether balance is adjusted
 */
export const setBalanceAdjusted = (isAdjusted) => {
  const state = getWalletState()
  state.isBalanceAdjusted = isAdjusted
  setWalletState(state)
}

/**
 * Get balance adjustment status
 * @returns {boolean} - Whether balance is adjusted
 */
export const getBalanceAdjusted = () => {
  const state = getWalletState()
  return state.isBalanceAdjusted || false
}

/**
 * Get transactions by type
 * @param {string} type - Transaction type (withdrawal, payment, all)
 * @returns {Array} - Filtered transactions
 */
export const getTransactionsByType = (type = 'all') => {
  const state = getWalletState()
  if (type === 'all') {
    return state.transactions
  }
  return state.transactions.filter(t => t.type === type)
}

/**
 * Get transactions by status
 * @param {string} status - Transaction status (Pending, Completed, Failed)
 * @returns {Array} - Filtered transactions
 */
export const getTransactionsByStatus = (status) => {
  const state = getWalletState()
  return state.transactions.filter(t => t.status === status)
}

/**
 * Get order payment amount from wallet transactions
 * @param {string|number} orderId - Order ID
 * @returns {number|null} - Payment amount if found, null otherwise
 */
export const getOrderPaymentAmount = (orderId) => {
  const state = getWalletState()
  const paymentTransaction = state.transactions.find(
    t => t.type === 'payment' && t.orderId === String(orderId)
  )
  return paymentTransaction ? paymentTransaction.amount : null
}

/**
 * Get payment status for an order
 * @param {string|number} orderId - Order ID
 * @returns {string} - Payment status ("Paid" or "Unpaid")
 */
export const getOrderPaymentStatus = (orderId) => {
  const state = getWalletState()
  const paymentTransaction = state.transactions.find(
    t => t.type === 'payment' && t.orderId === String(orderId) && t.status === 'Completed'
  )
  return paymentTransaction ? "Paid" : "Unpaid"
}

/**
 * Get all order IDs that have payments
 * @returns {Array} - Array of order IDs with payments
 */
export const getPaidOrderIds = () => {
  const state = getWalletState()
  return state.transactions
    .filter(t => t.type === 'payment' && t.status === 'Completed' && t.orderId)
    .map(t => t.orderId)
}


