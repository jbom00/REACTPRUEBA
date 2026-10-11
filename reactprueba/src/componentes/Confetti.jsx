// src/componentes/Confetti.jsx
import React, { useEffect, useRef } from 'react';

const COLORS = ['#ff3d71', '#00c2ff', '#ffc83d', '#9b5cff', '#00e08a', '#ff6a00', '#ffffff', '#ff4fd8'];

function Confetti({ duration = 6500 }) {
    const ref = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w = 0;
        let h = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const parts = [];
        const rand = (a, b) => a + Math.random() * (b - a);

        const spawn = (x, y, vx, vy) => {
            parts.push({
                x, y, vx, vy,
                w: rand(6, 12),
                h: rand(8, 16),
                rot: rand(0, Math.PI * 2),
                vr: rand(-0.25, 0.25),
                tilt: rand(0, Math.PI * 2),
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                round: Math.random() < 0.25,
            });
        };

        const burst = (x, y, count, spread, up = true) => {
            for (let i = 0; i < count; i++) {
                const a = (up ? -Math.PI / 2 : rand(0, Math.PI * 2)) + rand(-spread / 2, spread / 2);
                const s = rand(6, 17);
                spawn(x, y, Math.cos(a) * s, Math.sin(a) * s);
            }
        };

        burst(w * 0.15, h * 0.95, 80, 1.1);
        burst(w * 0.85, h * 0.95, 80, 1.1);
        burst(w * 0.5, h * 0.55, 110, Math.PI * 2, false);

        const start = performance.now();
        let last = start;
        let lastBurst = start;
        let raf = 0;

        const frame = (t) => {
            const dt = Math.min(32, t - last) / 16.67;
            last = t;
            const elapsed = t - start;

            if (elapsed < duration * 0.6) {
                if (Math.random() < 0.6) spawn(rand(0, w), -12, rand(-1.5, 1.5), rand(2, 4));
                if (t - lastBurst > 1300) {
                    lastBurst = t;
                    burst(rand(w * 0.2, w * 0.8), rand(h * 0.3, h * 0.6), 60, Math.PI * 2, false);
                }
            }

            ctx.clearRect(0, 0, w, h);
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                p.vy = Math.min(p.vy + 0.2 * dt, 7);
                p.vx *= 0.992;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.rot += p.vr * dt;
                p.tilt += 0.12 * dt;

                if (p.y > h + 30) {
                    parts.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.scale(1, Math.cos(p.tilt));
                ctx.fillStyle = p.color;
                if (p.round) {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                }
                ctx.restore();
            }

            if (elapsed > duration && parts.length === 0) return;
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, [duration]);

    return <canvas ref={ref} className="confetti-canvas" aria-hidden="true" />;
}

export default Confetti;