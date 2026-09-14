/**
 * BottomPopup Usage Examples
 * 
 * This file demonstrates how to use the BottomPopup component
 * in various scenarios within the delivery module.
 */

import { useState } from "react"
import BottomPopup from "./BottomPopup"
import { Button } from "@food/components/ui/button"
import { useDeliveryStore } from "@food/store/deliveryStore"

// Example 1: Basic Usage
export function BasicPopupExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Popup
      </Button>

      <BottomPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      >
        <div className="py-4">
          <p className="text-gray-700">
            This is a basic popup with default settings.
          </p>
        </div>
      </BottomPopup>
    </>
  )
}

// Example 2: With Title and Custom Content
export function TitlePopupExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Popup with Title
      </Button>

      <BottomPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Order Details"
        showCloseButton={true}
      >
        <div className="space-y-4 py-4">
          <div>
            <h4 className="font-semibold text-gray-900">Order #12345</h4>
            <p className="text-sm text-gray-600">Status: In Progress</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Items</h4>
            <ul className="list-disc list-inside text-sm text-gray-600">
              <li>Pizza x2</li>
              <li>Burger x1</li>
            </ul>
          </div>
        </div>
      </BottomPopup>
    </>
  )
}

// Example 3: Without Close Button (swipe only)
export function SwipeOnlyPopupExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Swipe-Only Popup
      </Button>

      <BottomPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        showCloseButton={false}
        closeOnBackdropClick={false}
      >
        <div className="py-4">
          <p className="text-gray-700">
            This popup can only be closed by swiping down.
            Backdrop click is disabled.
          </p>
        </div>
      </BottomPopup>
    </>
  )
}

// Example 4: Custom Height
export function CustomHeightPopupExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Custom Height Popup
      </Button>

      <BottomPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        maxHeight="60vh"
      >
        <div className="py-4">
          <p className="text-gray-700">
            This popup has a maximum height of 60vh.
          </p>
        </div>
      </BottomPopup>
    </>
  )
}

// Example 5: Without Handle
export function NoHandlePopupExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Popup Without Handle
      </Button>

      <BottomPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        showHandle={false}
      >
        <div className="py-4">
          <p className="text-gray-700">
            This popup doesn't show a drag handle.
            You can still swipe from the top area to dismiss.
          </p>
        </div>
      </BottomPopup>
    </>
  )
}

// Example 6: Using with Delivery Store
export function StoreIntegrationExample() {
  const [isOpen, setIsOpen] = useState(false)
  const { preferences, updatePreferences } = useDeliveryStore()

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Settings Popup
      </Button>

      <BottomPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Settings"
      >
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Notifications</span>
            <input
              type="checkbox"
              checked={preferences.notificationsEnabled}
              onChange={(e) => updatePreferences({ 
                notificationsEnabled: e.target.checked 
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Sound</span>
            <input
              type="checkbox"
              checked={preferences.soundEnabled}
              onChange={(e) => updatePreferences({ 
                soundEnabled: e.target.checked 
              })}
            />
          </div>
        </div>
      </BottomPopup>
    </>
  )
}

// Example 7: Complex Content with Scroll
export function ScrollableContentExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Scrollable Popup
      </Button>

      <BottomPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Long Content"
        maxHeight="80vh"
      >
        <div className="space-y-4 py-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold">Item {i + 1}</h4>
              <p className="text-sm text-gray-600">
                This is a scrollable content area. Swipe down to dismiss.
              </p>
            </div>
          ))}
        </div>
      </BottomPopup>
    </>
  )
}

