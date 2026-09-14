import { useDispatch, useSelector } from 'react-redux'
import { getStoreState } from './store'

export const useAppDispatch = () => useDispatch()
export const useAppSelector = useSelector

// Global
export const selectApp = (state = getStoreState()) => state.app
export const selectAuth = (state = getStoreState()) => state.auth

// Per-vertical slices
export const selectFood = (state = getStoreState()) => state.food

export const selectQuick = (state = getStoreState()) => state.quick

// Convenience: food cart (for migration from CartContext)
export const selectFoodCart = (state = getStoreState()) => state.food?.cart ?? { items: [] }

