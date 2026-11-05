import { useSyncExternalStore } from "react"

// "current" = follow the user's live GPS location, "saved" = follow the default saved address.
// The value lives in localStorage so it survives reloads, but every writer must go through
// setDeliveryAddressMode() so subscribed components re-render immediately instead of only
// picking up the new mode on the next unrelated render (that was the "shows after refresh" bug).
export const DELIVERY_ADDRESS_MODE_KEY = "deliveryAddressMode"
export const DELIVERY_ADDRESS_MODE_EVENT = "deliveryAddressModeChanged"

const DEFAULT_MODE = "saved"

export const getDeliveryAddressMode = () => {
  if (typeof window === "undefined") return DEFAULT_MODE
  try {
    return window.localStorage.getItem(DELIVERY_ADDRESS_MODE_KEY) || DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

export const setDeliveryAddressMode = (mode) => {
  if (typeof window === "undefined") return
  const next = mode === "current" ? "current" : "saved"
  let changed = true
  try {
    changed = window.localStorage.getItem(DELIVERY_ADDRESS_MODE_KEY) !== next
    window.localStorage.setItem(DELIVERY_ADDRESS_MODE_KEY, next)
  } catch {
    // Private mode / quota: still notify subscribers so the session stays consistent.
  }
  if (!changed) return
  window.dispatchEvent(
    new CustomEvent(DELIVERY_ADDRESS_MODE_EVENT, { detail: { mode: next } })
  )
}

const subscribe = (onStoreChange) => {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(DELIVERY_ADDRESS_MODE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(DELIVERY_ADDRESS_MODE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

export const useDeliveryAddressMode = () =>
  useSyncExternalStore(subscribe, getDeliveryAddressMode, () => DEFAULT_MODE)
