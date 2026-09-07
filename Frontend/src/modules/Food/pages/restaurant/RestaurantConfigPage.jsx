import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { ArrowLeft, X, Plus } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Card, CardContent } from "@food/components/ui/card"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function RestaurantConfigPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [showMenu, setShowMenu] = useState(false)

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Order Setup
  const [homeDelivery, setHomeDelivery] = useState(true)
  const [takeAway, setTakeAway] = useState(true)
  const [instanceOrder, setInstanceOrder] = useState(true)
  const [scheduleOrder, setScheduleOrder] = useState(true)
  const [subscriptionOrder, setSubscriptionOrder] = useState(false)
  const [minOrderAmount, setMinOrderAmount] = useState("0.0")

  // Restaurant Types & Tag
  const [cuisines, setCuisines] = useState(["Italian", "Spanish"])
  const [cuisineInput, setCuisineInput] = useState("")
  const [characteristics, setCharacteristics] = useState(["Bengali", "Indian", "Pizza", "Pasta"])
  const [characteristicInput, setCharacteristicInput] = useState("")
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState("")
  const [halalTagStatus, setHalalTagStatus] = useState(true)

  // Other Setup
  const [foodType, setFoodType] = useState({ veg: true, nonVeg: true })
  const [cutleryOnDelivery, setCutleryOnDelivery] = useState(true)

  // GST
  const [activeGST, setActiveGST] = useState(false)
  const [gstAmount, setGstAmount] = useState("")

  // Extra Package Charge
  const [activeExtraPackageCharge, setActiveExtraPackageCharge] = useState(true)
  const [chargeType, setChargeType] = useState("optional")
  const [extraPackagingAmount, setExtraPackagingAmount] = useState("2.0")

  // Daily Schedule Time
  const [schedule, setSchedule] = useState({
    sunday: [{ start: "12:01 AM", end: "11:59 PM" }],
    monday: [{ start: "12:00 AM", end: "04:00 AM" }, { start: "06:00 AM", end: "11:59 PM" }],
    tuesday: [{ start: "12:00 AM", end: "05:00 AM" }, { start: "06:00 AM", end: "11:59 PM" }],
    wednesday: [{ start: "06:17 AM", end: "11:30 PM" }],
    thursday: [{ start: "12:00 AM", end: "04:00 AM" }, { start: "05:00 AM", end: "11:59 PM" }],
    friday: [{ start: "12:00 AM", end: "11:59 PM" }],
    saturday: [{ start: "12:01 AM", end: "11:59 PM" }]
  })

  const days = [
    { key: "sunday", label: "Sunday" },
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" }
  ]

  const addCuisine = () => {
    if (cuisineInput.trim()) {
      setCuisines([...cuisines, cuisineInput.trim()])
      setCuisineInput("")
    }
  }

  const removeCuisine = (index) => {
    setCuisines(cuisines.filter((_, i) => i !== index))
  }

  const addCharacteristic = () => {
    if (characteristicInput.trim()) {
      setCharacteristics([...characteristics, characteristicInput.trim()])
      setCharacteristicInput("")
    }
  }

  const removeCharacteristic = (index) => {
    setCharacteristics(characteristics.filter((_, i) => i !== index))
  }

  const addTag = () => {
    if (tagInput.trim()) {
      setTags([...tags, tagInput.trim()])
      setTagInput("")
    }
  }

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index))
  }

  const addTimeSlot = (day) => {
    setSchedule({
      ...schedule,
      [day]: [...schedule[day], { start: "12:00 AM", end: "11:59 PM" }]
    })
  }

  const removeTimeSlot = (day, index) => {
    setSchedule({
      ...schedule,
      [day]: schedule[day].filter((_, i) => i !== index)
    })
  }

  const ToggleSwitch = ({ enabled, onChange }) => (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff8100] focus:ring-offset-2 ${
        enabled ? "bg-[#ff8100]" : "bg-gray-300"
      }`}
    >
      <motion.span
        animate={{ x: enabled ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-block h-4 w-4 rounded-full bg-white"
      />
    </motion.button>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </motion.button>
          <h1 className="text-lg md:text-xl font-semibold text-gray-900">Restaurant Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Order Setup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Order Setup</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Home Delivery</span>
                <ToggleSwitch enabled={homeDelivery} onChange={setHomeDelivery} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Take Away</span>
                <ToggleSwitch enabled={takeAway} onChange={setTakeAway} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Instance Order</span>
                <ToggleSwitch enabled={instanceOrder} onChange={setInstanceOrder} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Schedule Order</span>
                <ToggleSwitch enabled={scheduleOrder} onChange={setScheduleOrder} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Subscription Order</span>
                <ToggleSwitch enabled={subscriptionOrder} onChange={setSubscriptionOrder} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm md:text-base text-gray-700 flex-shrink-0">Minimum Order Amount (?):</span>
                <Input
                  type="number"
                  step="0.1"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Restaurant Types & Tag */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Restaurant Types & Tag</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm md:text-base text-gray-700 mb-2">Cuisines</label>
                <Input
                  type="text"
                  value={cuisineInput}
                  onChange={(e) => setCuisineInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCuisine()}
                  placeholder="Add cuisine"
                  className="mb-2"
                />
                <div className="flex flex-wrap gap-2">
                  {cuisines.map((cuisine, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      {cuisine}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeCuisine(index)}
                        className="hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm md:text-base text-gray-700 mb-2">Characteristics</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="text"
                    value={characteristicInput}
                    onChange={(e) => setCharacteristicInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addCharacteristic()}
                    placeholder="Add characteristic"
                    className="flex-1"
                  />
                  <Button
                    onClick={addCharacteristic}
                    className="bg-primary hover:bg-primary text-white px-4"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {characteristics.map((char, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      {char}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeCharacteristic(index)}
                        className="hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm md:text-base text-gray-700 mb-2">Tag</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addTag()}
                    placeholder="Add tag"
                    className="flex-1"
                  />
                  <Button
                    onClick={addTag}
                    className="bg-primary hover:bg-primary text-white px-4"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      {tag}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeTag(index)}
                        className="hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Halal Tag Status</span>
                <ToggleSwitch enabled={halalTagStatus} onChange={setHalalTagStatus} />
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Other Setup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Other Setup</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm md:text-base text-gray-700 mb-2">Food Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={foodType.veg}
                      onChange={(e) => setFoodType({ ...foodType, veg: e.target.checked })}
                      className="w-4 h-4 text-[#ff8100] border-gray-300 rounded focus:ring-[#ff8100]"
                    />
                    <span className="text-sm md:text-base text-gray-700">Veg</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={foodType.nonVeg}
                      onChange={(e) => setFoodType({ ...foodType, nonVeg: e.target.checked })}
                      className="w-4 h-4 text-[#ff8100] border-gray-300 rounded focus:ring-[#ff8100]"
                    />
                    <span className="text-sm md:text-base text-gray-700">Non-Veg</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Cutlery On Delivery</span>
                <ToggleSwitch enabled={cutleryOnDelivery} onChange={setCutleryOnDelivery} />
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* GST */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">GST</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Active GST</span>
                <ToggleSwitch enabled={activeGST} onChange={setActiveGST} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm md:text-base text-gray-700 flex-shrink-0">GST Amount (?):</span>
                <Input
                  type="number"
                  step="0.1"
                  value={gstAmount}
                  onChange={(e) => setGstAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Extra Package Charge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Extra Package Charge</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm md:text-base text-gray-700">Active Extra Package Charge</span>
                <ToggleSwitch enabled={activeExtraPackageCharge} onChange={setActiveExtraPackageCharge} />
              </div>
              <div>
                <label className="block text-sm md:text-base text-gray-700 mb-2">Charge Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="chargeType"
                      value="optional"
                      checked={chargeType === "optional"}
                      onChange={(e) => setChargeType(e.target.value)}
                      className="w-4 h-4 text-[#ff8100] border-gray-300 focus:ring-[#ff8100]"
                    />
                    <span className="text-sm md:text-base text-gray-700">Optional</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="chargeType"
                      value="mandatory"
                      checked={chargeType === "mandatory"}
                      onChange={(e) => setChargeType(e.target.value)}
                      className="w-4 h-4 text-[#ff8100] border-gray-300 focus:ring-[#ff8100]"
                    />
                    <span className="text-sm md:text-base text-gray-700">Mandatory</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm md:text-base text-gray-700 flex-shrink-0">Extra Packaging Amount (?):</span>
                <Input
                  type="number"
                  step="0.1"
                  value={extraPackagingAmount}
                  onChange={(e) => setExtraPackagingAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Daily Schedule Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Daily Schedule Time</h2>
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.key} className="space-y-2">
                  <label className="block text-sm md:text-base font-medium text-gray-700">{day.label}</label>
                  {schedule[day.key].map((slot, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={`${slot.start} - ${slot.end}`}
                        readOnly
                        className="flex-1"
                      />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeTimeSlot(day.key, index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                  ))}
                  <Button
                    onClick={() => addTimeSlot(day.key)}
                    className="bg-primary hover:bg-primary text-white"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Slot
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Update Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 md:mx-0 md:border-t-0 md:p-0 md:mt-6"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={() => {
                // Handle update logic here
                debugLog("Settings updated")
              }}
              className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 md:py-4 rounded-lg text-base md:text-lg"
            >
              Update
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}


