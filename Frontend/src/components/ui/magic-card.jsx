import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const MagicCard = ({ children, className, gradientSize = 200, gradientColor = "#262626", ...props }) => {
    const cardRef = useRef(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleFocus = () => {
        setOpacity(1);
    };

    const handleBlur = () => {
        setOpacity(0);
    };

    const handleMouseEnter = () => {
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
                "relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
                className
            )}
            {...props}
        >
            <div
                className="pointer-events-none absolute -inset-px z-10 opacity-0 transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(${gradientSize}px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 100%)`,
                }}
            />
            <div className="relative z-20 flex flex-col h-full">{children}</div>
        </div>
    );
};

export { MagicCard };
