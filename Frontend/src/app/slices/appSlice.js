import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  initialized: false,
  theme: 'light',
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setInitialized(state, action) {
      state.initialized = action.payload ?? true
    },
    setTheme(state, action) {
      state.theme = action.payload === 'dark' ? 'dark' : 'light'
    },
  },
})

export const { setInitialized, setTheme } = appSlice.actions
export default appSlice.reducer

