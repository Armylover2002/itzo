import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft, Send, MoreVertical } from "lucide-react"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function ChatDetailPage() {
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef(null)

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

  const messages = []

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (message.trim()) {
      // Add message logic here
      debugLog("Sending message:", message)
      setMessage("")
      scrollToBottom()
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center gap-4 rounded-b-3xl md:rounded-b-none fixed top-0 left-0 right-0 z-50">
        <button
          onClick={() => navigate("/restaurant/conversation")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ff8100] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">SF</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 truncate">
              Conversation {conversationId || ""}
            </h2>
            <p className="text-xs text-gray-500">Messaging unavailable</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <MoreVertical className="w-5 h-5 text-gray-600" />
        </motion.button>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-20 md:h-16"></div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20 md:pb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-gray-500">
            Chat messages are not available yet.
          </div>
        ) : messages.map((msg, index) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2.5 ${
                msg.sender === "me"
                  ? "bg-[#ff8100] text-white rounded-br-sm"
                  : "bg-white text-gray-900 rounded-bl-sm shadow-sm"
              }`}
            >
              <p className="text-sm md:text-base break-words">{msg.text}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.sender === "me" ? "text-white/70" : "text-gray-500"
                }`}
              >
                {msg.time}
              </p>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at Bottom */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 fixed bottom-0 left-0 right-0 z-40 md:relative md:border-t-0 md:bottom-auto">
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSend()
              }
            }}
            className="flex-1 rounded-full border border-gray-200 focus:border-[#ff8100] focus:ring-1 focus:ring-[#ff8100]"
          />
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              onClick={handleSend}
              disabled
              className="rounded-full bg-[#ff8100] hover:bg-[#e67300] text-white p-2.5 w-10 h-10 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </div>

    </div>
  )
}


