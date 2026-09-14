"use client";

import { useMotionValue, motion, useSpring, useTransform } from "framer-motion";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export const Dock = React.forwardRef(
    ({ className, children, magnification = 60, distance = 140, direction = "middle", ...props }, ref) => {
        const mouseX = useMotionValue(Infinity);

        const renderChildren = () => {
            return React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, {
                        mouseX: mouseX,
                        magnification: magnification,
                        distance: distance,
                    });
                }
                return child;
            });
        };

        return (
            <motion.div
                ref={ref}
                onMouseMove={(e) => mouseX.set(e.pageX)}
                onMouseLeave={() => mouseX.set(Infinity)}
                className={cn(
                    "mx-auto flex h-[58px] w-max gap-2 rounded-2xl border p-2 backdrop-blur-md",
                    className,
                )}
                {...props}
            >
                {renderChildren()}
            </motion.div>
        );
    },
);

Dock.displayName = "Dock";

export const DockIcon = ({ size, magnification = 60, distance = 140, mouseX, className, children, ...props }) => {
    const ref = useRef(null);

    const distanceCalc = useTransform(mouseX, (val) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
        return val - bounds.x - bounds.width / 2;
    });

    const widthSync = useTransform(distanceCalc, [-distance, 0, distance], [40, magnification, 40]);

    const width = useSpring(widthSync, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    });

    return (
        <motion.div
            ref={ref}
            style={{ width }}
            className={cn("aspect-square cursor-pointer rounded-full flex items-center justify-center", className)}
            {...props}
        >
            {children}
        </motion.div>
    );
};

DockIcon.displayName = "DockIcon";
