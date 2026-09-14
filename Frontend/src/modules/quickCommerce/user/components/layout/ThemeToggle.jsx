import React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const ThemeToggle = ({ className = "" }) => {
    const { theme, setTheme } = useTheme();

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
                "relative h-10 w-10 flex items-center justify-center rounded-xl bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/10 backdrop-blur-md shadow-lg transition-all duration-300 group",
                className
            )}
            aria-label="Toggle Theme"
        >
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <AnimatePresence mode="wait" initial={false}>
                {theme === 'dark' ? (
                    <motion.div
                        key="moon"
                        initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
                        transition={{ 
                            type: "spring",
                            stiffness: 300,
                            damping: 20
                        }}
                        className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                    >
                        <Moon size={20} fill="currentColor" strokeWidth={1.5} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                        transition={{ 
                            type: "spring",
                            stiffness: 300,
                            damping: 20
                        }}
                        className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]"
                    >
                        <Sun size={20} fill="currentColor" strokeWidth={1.5} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.button>
    );
};

export default ThemeToggle;
