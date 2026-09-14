import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function WordPullUp({
    words,
    wrapperFramerProps = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    },
    framerProps = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 },
    },
    className,
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });
    return (
        <motion.h1
            ref={ref}
            variants={wrapperFramerProps}
            initial="hidden"
            animate={isInView ? "show" : "hidden"}
            className={className}
        >
            {words.split(" ").map((word, i) => (
                <motion.span
                    key={i}
                    variants={framerProps}
                    style={{ display: "inline-block", paddingRight: "8px" }}
                >
                    {word === "" ? "\u00A0" : word}
                </motion.span>
            ))}
        </motion.h1>
    );
}
