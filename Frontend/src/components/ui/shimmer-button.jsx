import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ShimmerButton = React.forwardRef(
    (
        {
            shimmerColor = "#ffffff",
            shimmerSize = "0.05em",
            shimmerDuration = "3s",
            borderRadius = "100px",
            background = "orange-500",
            className,
            children,
            ...props
        },
        ref,
    ) => {
        return (
            <motion.button
                style={{
                    "--spread": "90deg",
                    "--shimmer-color": shimmerColor,
                    "--radius": borderRadius,
                    "--speed": shimmerDuration,
                    "--cut": shimmerSize,
                    "--bg": background,
                }}
                className={cn(
                    "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white [background:var(--bg)] [border-radius:var(--radius)] dark:text-black",
                    "transform-gpu transition-transform active:scale-95",
                    className,
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                ref={ref}
                {...props}
            >
                {/* Shimmer container */}
                <div
                    className={cn(
                        "-z-30Blur absolute inset-0 overflow-visible [container-type:size]",
                    )}
                >
                    {/* Sparkle */}
                    <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
                        {/* Sparkle Inner */}
                        <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
                    </div>
                </div>
                {children}

                {/* Highlight */}
                <div
                    className={cn(
                        "insert-0 absolute size-full",
                        "rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]",
                        "transform-gpu transition-all duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]",
                        "group-active:shadow-[inset_0_-10px_10px_#ffffff3f]",
                    )}
                />

                {/* Backdrop for Shimmer */}
                <div
                    className={cn(
                        "absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]",
                    )}
                />
            </motion.button>
        );
    },
);

ShimmerButton.displayName = "ShimmerButton";

export default ShimmerButton;
