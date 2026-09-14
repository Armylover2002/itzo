import { createSlice } from '@reduxjs/toolkit'
import { isModuleAuthenticated, getCurrentUserRole } from '@food/utils/auth'

const initialState = {
  // module: 'user' | 'restaurant' | 'delivery' | 'admin'
  module: 'user',
  isAuthenticated: false,
  role: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState(state, action) {
      const { module = 'user', isAuthenticated, role } = action.payload || {}
      state.module = module
      state.isAuthenticated =
        typeof isAuthenticated === 'boolean'
          ? isAuthenticated
          : isModuleAuthenticated(module)
      state.role = role || getCurrentUserRole(module)
    },
    clearAuthState(state) {
      state.module = 'user'
      state.isAuthenticated = false
      state.role = null
    },
  },
})

export const { setAuthState, clearAuthState } = authSlice.actions
export default authSlice.reducer

