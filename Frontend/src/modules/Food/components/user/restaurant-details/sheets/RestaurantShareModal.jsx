import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, MessageCircle, Send, Mail, Copy } from "lucide-react";

export default function RestaurantShareModal({
  open,
  onClose,
  sharePayload,
  handleSystemShareFromModal,
  openShareTarget,
  copyShareLink,
}) {
  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && sharePayload && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-[10020]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10021] w-[92vw] max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">Share</h3>
              <button
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={onClose}
                aria-label="Close share modal"
              >
                <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              {typeof navigator !== "undefined" && navigator.share && (
                <button
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                  onClick={handleSystemShareFromModal}
                >
                  <Share2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Share via system apps</span>
                </button>
              )}
              <button
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                onClick={() => openShareTarget("whatsapp")}
              >
                <MessageCircle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp</span>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                onClick={() => openShareTarget("telegram")}
              >
                <Send className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Telegram</span>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                onClick={() => openShareTarget("email")}
              >
                <Mail className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Email</span>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                onClick={copyShareLink}
              >
                <Copy className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Copy link</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
