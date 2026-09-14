import { memo } from "react";
import { motion } from "framer-motion";
import QuickTabPage from "@food/pages/user/Quick";

function QuickHomeContent({ quickThemeColor, onThemeChange }) {
  return (
    <motion.div
      key="quick-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <QuickTabPage onThemeChange={onThemeChange} embeddedHeaderColor={quickThemeColor} />
    </motion.div>
  );
}

export default memo(QuickHomeContent);
