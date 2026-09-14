import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const colors = ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'];

const ConfettiParticle = ({ x, y, color }) => {
    return (
        <motion.div
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
                x: x,
                y: y,
                opacity: [1, 1, 0],
                scale: [0, 1, 0.5],
                rotate: [0, 180, 360]
            }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
                position: 'absolute',
                width: '10px',
                height: '10px',
                background: color,
                borderRadius: '50%',
                left: '50%',
                top: '50%',
                zIndex: 9999
            }}
        />
    );
};

export const Confetti = ({ isExploding = false }) => {
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        if (isExploding) {
            const newParticles = [];
            for (let i = 0; i < 50; i++) {
                const angle = Math.random() * Math.PI * 2;
                const velocity = 200 + Math.random() * 200;
                const tx = Math.cos(angle) * velocity;
                const ty = Math.sin(angle) * velocity;
                newParticles.push({
                    id: i,
                    x: tx,
                    y: ty,
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
            setParticles(newParticles);
        }
    }, [isExploding]);

    if (!isExploding) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%' }}>
                {particles.map((p) => (
                    <ConfettiParticle key={p.id} x={p.x} y={p.y} color={p.color} />
                ))}
            </div>
        </div>
    );
};
