import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { X, Search, Clock, Loader2, Mic } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { restaurantAPI, searchAPI } from "@food/api"

const SEARCH_HISTORY_KEY = "user_recent_searches_v1"

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [filteredFoods, setFilteredFoods] = useState([])
  const [recentSuggestions, setRecentSuggestions] = useState([])
  const [loadingFoods, setLoadingFoods] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState(searchValue)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchValue)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchValue])

  useEffect(() => {
    if (!isOpen) return

    const loadRecentSuggestions = () => {
      try {
        const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        if (Array.isArray(parsed)) {
          setRecentSuggestions(parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, 8))
          return
        }
      } catch {
        // Ignore parse errors.
      }
      setRecentSuggestions([])
    }
    loadRecentSuggestions()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const getImageUrl = (value) => {
      if (!value) return ""
      if (typeof value === "string") return value
      if (typeof value === "object") {
        return value.url || value.secure_url || value.imageUrl || value.image || value.src || ""
      }
      return ""
    }

    const fetchSearch = async () => {
      setLoadingFoods(true)
      try {
        const res = await searchAPI.unifiedSearch({ q: debouncedSearch, limit: 30 })
        const data = res.data?.data?.restaurants || []
        
        const formatted = []
        data.forEach(item => {
          if (item.matchType === 'food' || item.matchType === 'dish' || item.matchedDish) {
             formatted.push({
               id: item.matchedDishId || `food-${item._id}`,
               name: String(item.matchedDish || item.restaurantName).trim(),
               image: getImageUrl(item.matchedDishImage) || getImageUrl(item.profileImage?.url),
               type: 'dish',
             })
          } else {
             formatted.push({
               id: item._id || item.restaurantId,
               name: String(item.restaurantName || item.name).trim(),
               image: getImageUrl(item.profileImage?.url) || getImageUrl(item.coverImages?.[0]),
               type: 'restaurant',
             })
          }
        })
        
        const unique = []
        const names = new Set()
        for (const item of formatted) {
           const lowerName = item.name.toLowerCase()
           if (!names.has(lowerName)) {
              names.add(lowerName)
              unique.push(item)
           }
        }
        
        setFilteredFoods(unique)
      } catch {
        setFilteredFoods([])
      } finally {
        setLoadingFoods(false)
      }
    }

    fetchSearch()
  }, [debouncedSearch, isOpen])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  const saveRecentSearch = (term) => {
    const value = String(term || "").trim()
    if (!value) return

    setRecentSuggestions((prev) => {
      const next = [value, ...prev.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 8)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion)
    inputRef.current?.focus()
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      saveRecentSearch(searchValue)
      navigate(`/food/user/search?q=${encodeURIComponent(searchValue.trim())}`)
      onClose()
      onSearchChange("")
    }
  }

  const handleFoodClick = (food) => {
    saveRecentSearch(food.name)
    navigate(`/food/user/search?q=${encodeURIComponent(food.name)}`)
    onClose()
    onSearchChange("")
  }

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onSearchChange(transcript);
        saveRecentSearch(transcript);
      }
    };
    recognition.start();
  };

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Header with Search Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for food, restaurants..."
                className="pl-12 pr-12 h-12 w-full bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 focus:border-[#FF0000] dark:focus:border-[#FF0000] rounded-full text-lg dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'text-[#FF0000] scale-110 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Mic className="h-5 w-5" />
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a]">
        {/* Suggestions Row */}
        <div
          className="mb-6"
          style={{
            animation: 'slideDown 0.3s ease-out 0.1s both'
          }}
        >
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#FF0000]" />
            Recent Searches
          </h3>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            {recentSuggestions.slice(0, 8).map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 text-gray-700 dark:text-gray-300 hover:text-[#FF0000] dark:hover:text-red-400 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md"
                style={{
                  animation: `scaleIn 0.3s ease-out ${0.1 + index * 0.02}s both`
                }}
              >
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-[#FF0000] flex-shrink-0" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Food Grid */}
        <div
          style={{
            animation: 'fadeIn 0.3s ease-out 0.2s both'
          }}
        >
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
            {searchValue.trim() === "" ? "All Dishes" : `Search Results (${filteredFoods.length})`}
          </h3>
          {filteredFoods.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              {filteredFoods.map((food, index) => (
                <div
                  key={food.id}
                  className="flex flex-col items-center gap-2 sm:gap-3 cursor-pointer group"
                  style={{
                    animation: `slideUp 0.3s ease-out ${0.25 + 0.05 * (index % 12)}s both`
                  }}
                  onClick={() => handleFoodClick(food)}
                >
                  <div className="relative w-full aspect-square rounded-full overflow-hidden transition-all duration-200 shadow-md group-hover:shadow-lg bg-white dark:bg-[#1a1a1a] p-1 sm:p-1.5">
                    {food.image ? (
                      <img
                        src={food.image}
                        alt={food.name}
                        className="w-full h-full object-cover rounded-full"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <Search className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="px-1 sm:px-2 text-center">
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-[#FF0000] dark:group-hover:text-red-400 transition-colors line-clamp-2">
                      {food.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 sm:py-16">
              {loadingFoods ? (
                <>
                  <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-semibold">Loading dishes from database...</p>
                </>
              ) : (
                <>
                  <Search className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-semibold">
                    {searchValue.trim() ? `No results found for "${searchValue}"` : "No dishes found in database"}
                  </p>
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 mt-2">
                    {searchValue.trim() ? "Try a different search term" : "Add menu items in restaurant menus to show here"}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
    </div>
  )
}
