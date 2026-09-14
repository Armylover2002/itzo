import { createSlice } from '@reduxjs/toolkit'

const findBasketItemIndex = (items, id, vendorId) =>
  items.findIndex(
    (item) =>
      item.id === id && (vendorId == null || item.vendorId === vendorId)
  )

const initialState = {
  // Basket: quick-commerce items
  basket: {
    items: [], // [{ id, vendorId, name, price, quantity, ... }]
  },
  // Vendors list / selected (for UI state)
  vendors: {
    list: [],
    selectedVendorId: null,
  },
}

const quickSlice = createSlice({
  name: 'quick',
  initialState,
  reducers: {
    // —— Basket ——
    addToBasket(state, action) {
      const { id, vendorId, quantity = 1, ...rest } = action.payload || {}
      if (!id) return
      const items = state.basket.items
      const idx = findBasketItemIndex(items, id, vendorId)
      if (idx === -1) {
        state.basket.items.push({ id, vendorId, quantity, ...rest })
      } else {
        state.basket.items[idx].quantity += quantity
      }
    },
    removeFromBasket(state, action) {
      const { id, vendorId } = action.payload || {}
      state.basket.items = state.basket.items.filter(
        (item) =>
          !(
            item.id === id &&
            (vendorId == null || item.vendorId === vendorId)
          )
      )
    },
    clearBasket(state) {
      state.basket.items = []
    },
    setBasket(state, action) {
      state.basket.items = Array.isArray(action.payload) ? action.payload : []
    },

    // —— Vendors ——
    setVendorsList(state, action) {
      state.vendors.list = Array.isArray(action.payload) ? action.payload : []
    },
    setSelectedVendor(state, action) {
      state.vendors.selectedVendorId = action.payload ?? null
    },

    // Reset quick slice (e.g. on logout)
    resetQuick(state) {
      state.basket.items = []
      state.vendors.list = []
      state.vendors.selectedVendorId = null
    },
  },
})

export const {
  addToBasket,
  removeFromBasket,
  clearBasket,
  setBasket,
  setVendorsList,
  setSelectedVendor,
  resetQuick,
} = quickSlice.actions
export default quickSlice.reducer
