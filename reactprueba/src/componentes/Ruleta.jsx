// src/componentes/Ruleta.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sonidos } from '../sonidos';

const PALETTE = ['#ff3d71', '#00c2ff', '#ffb300', '#9b5cff', '#00e08a', '#ff6a00', '#2f7bff', '#ff4fd8'];
export const SPIN_DURATION = 6000;
const FONT = "'Poppins', 'Segoe UI', sans-serif";

const BASE = 560; // diámetro de referencia (px) para los adornos
const FULL_MAX = 780; // diámetro máximo para mostrar la ruleta completa
const MAX_CANVAS_PX = 3200; // límite de píxeles por lado del canvas

/* ------------------------------------------------------------------ */
/*  Geometría: cada número tiene SU PROPIA casilla                      */
/* ------------------------------------------------------------------ */

const kdFor = (D) => Math.min(D / BASE, 1.4); // escala de los adornos
const ringFor = (D) => 30 * kdFor(D); // grosor del aro dorado

/** Ancho estimado (a 100px de fuente) del número más ancho, en Poppins ExtraBold. */
function digitWidth100(numbers) {
    let max = 0;
    for (const v of numbers) {
        let w = 0;
        for (const ch of String(v)) w += ch === '-' ? 45 : 68;
        if (w > max) max = w;
    }
    return max;
}

const maxFontFor = (n) => (n <= 8 ? 40 : n <= 16 ? 34 : 30);

/**
 * Tamaño de letra más grande que cabe DENTRO de la casilla de cada número
 * (el alto del texto debe ser menor que el ancho de la casilla en su extremo interno).
 */
function solveFont(n, w100, D) {
    const kd = kdFor(D);
    const outer = D / 2 - 4;
    const sliceR = outer - ringFor(D) - 2;
    const outerEnd = sliceR - 14 * kd; // borde derecho del texto
    const minStart = 98 * kd; // no invadir el centro
    for (let f = maxFontFor(n); f >= 7; f -= 0.5) {
        const len = (w100 * f) / 100;
        const innerStart = outerEnd - len;
        if (innerStart < minStart) continue;
        if ((2 * Math.PI * innerStart) / n >= 0.74 * f + 3.5) return { f, sliceR, outerEnd };
    }
    return { f: 7, sliceR, outerEnd };
}

/** Diámetro mínimo de la ruleta para que todos los números se lean bien en su casilla. */
export function wheelDiameterFor(n, numbers) {
    if (n === 0) return 540;
    const w100 = digitWidth100(numbers);
    const target = Math.min(n <= 20 ? 30 : n <= 50 ? 26 : 22, maxFontFor(n));
    for (let D = 540; D <= 3000; D += 20) {
        if (solveFont(n, w100, D).f >= target) return D;
    }
    return 3000;
}

function buildColors(n) {
    const colors = Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);
    // evita que la última casilla tenga el mismo color que la primera
    if (n > 2 && colors[n - 1] === colors[0]) colors[n - 1] = PALETTE[(n + 3) % PALETTE.length];
    return colors;
}

/* ------------------------------------------------------------------ */

function Wheel({ numbers, eliminated, highlight, rotation, isSpinning, disabled, label, stamp, onSpin, onFinished }) {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);
    const rotorRef = useRef(null);
    const needleRef = useRef(null);
    const liveRef = useRef(null);
    const [availW, setAvailW] = useState(540);
    const [fontTick, setFontTick] = useState(0);

    const n = numbers.length;

    // Ancho disponible en la columna de la ruleta
    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return undefined;
        const update = () => setAvailW(Math.max(200, Math.floor(el.clientWidth)));
        update();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Redibuja cuando la fuente Poppins termina de cargar
    useEffect(() => {
        if (document.fonts && document.fonts.load) {
            document.fonts.load(`800 24px ${FONT}`).then(() => setFontTick((t) => t + 1)).catch(() => { });
        }
    }, []);

    // Diámetro necesario y modo de vista:
    //  - "full":   se ve la ruleta completa (cuando cabe con números grandes)
    //  - "window": la ruleta es enorme y se muestra la parte superior (donde está la aguja)
    const D = useMemo(() => wheelDiameterFor(n, numbers), [n, numbers]);
    const mode = D <= FULL_MAX && availW >= D * 0.5 ? 'full' : 'window';
    const stageW = mode === 'full' ? Math.min(D, availW) : Math.min(availW, 900);
    const stageH = mode === 'full' ? stageW : Math.round(Math.min(430, Math.max(300, D * 0.3)));

    /* ---------- Dibujo de la ruleta ---------- */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_CANVAS_PX / D);
        canvas.width = Math.round(D * scale);
        canvas.height = Math.round(D * scale);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, D, D);

        const kd = kdFor(D);
        const c = D / 2;
        const outer = c - 4;
        const ringW = ringFor(D);
        const rim = outer - ringW;

        // 1. Aro dorado exterior
        const gold = ctx.createLinearGradient(0, 0, D, D);
        gold.addColorStop(0, '#fff1a8');
        gold.addColorStop(0.35, '#e0a41a');
        gold.addColorStop(0.65, '#fff1a8');
        gold.addColorStop(1, '#b97a0a');
        ctx.beginPath();
        ctx.arc(c, c, outer, 0, Math.PI * 2);
        ctx.fillStyle = gold;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(c, c, outer - 5 * kd, 0, Math.PI * 2);
        ctx.fillStyle = '#120f24';
        ctx.fill();

        // 2. Luces del aro
        let bulbs = Math.round((2 * Math.PI * (outer - ringW / 2)) / (52 * kd));
        if (bulbs % 2) bulbs += 1;
        const bulbR = 9 * kd;
        for (let i = 0; i < bulbs; i++) {
            const a = (i / bulbs) * Math.PI * 2;
            const r = outer - ringW / 2 - 1;
            const x = c + Math.cos(a) * r;
            const y = c + Math.sin(a) * r;
            const on = i % 2 === 0;
            const g = ctx.createRadialGradient(x, y, 0, x, y, bulbR);
            g.addColorStop(0, on ? '#ffffff' : '#ffe9a0');
            g.addColorStop(0.45, on ? '#ffd24a' : '#ff9a3d');
            g.addColorStop(1, 'rgba(255,170,40,0)');
            ctx.beginPath();
            ctx.arc(x, y, bulbR, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
        }

        // 3. Base interior
        ctx.beginPath();
        ctx.arc(c, c, rim + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#0b0d1a';
        ctx.fill();

        if (n === 0) return;

        const slice = (Math.PI * 2) / n;
        const colors = buildColors(n);
        const sliceR = rim - 2;
        const elimSet = new Set(eliminated);

        // 4. Sectores (los "al agua" se dibujan como agua con olitas)
        const drawWaterSlice = (a0, a1) => {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.arc(c, c, sliceR, a0, a1);
            ctx.closePath();
            ctx.clip();
            const g = ctx.createRadialGradient(c, c, 60 * kd, c, c, sliceR);
            g.addColorStop(0, '#06304f');
            g.addColorStop(1, '#1b8ed6');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.6 * kd;
            for (let r = 100 * kd; r < sliceR; r += 20 * kd) {
                const arcLen = r * (a1 - a0);
                const steps = Math.max(8, Math.ceil(arcLen / 3));
                ctx.beginPath();
                for (let s = 0; s <= steps; s++) {
                    const a = a0 + ((a1 - a0) * s) / steps;
                    const rr = r + 2.5 * kd * Math.sin((2 * Math.PI * ((a - a0) * r)) / (18 * kd) + r * 0.3);
                    const x = c + Math.cos(a) * rr;
                    const y = c + Math.sin(a) * rr;
                    if (s === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.restore();
        };

        numbers.forEach((num, i) => {
            const a0 = i * slice;
            const a1 = (i + 1) * slice;
            if (elimSet.has(num)) {
                drawWaterSlice(a0, a1);
            } else {
                ctx.beginPath();
                ctx.moveTo(c, c);
                ctx.arc(c, c, sliceR, a0, a1);
                ctx.closePath();
                ctx.fillStyle = colors[i];
                ctx.fill();
            }
        });

        // 5. Relieve (luz y sombra)
        const depth = ctx.createRadialGradient(c, c, 30 * kd, c, c, sliceR);
        depth.addColorStop(0, 'rgba(0,0,0,0.45)');
        depth.addColorStop(0.55, 'rgba(0,0,0,0)');
        depth.addColorStop(0.9, 'rgba(255,255,255,0.06)');
        depth.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.beginPath();
        ctx.arc(c, c, sliceR, 0, Math.PI * 2);
        ctx.fillStyle = depth;
        ctx.fill();

        // 6. Divisiones
        ctx.lineWidth = (n > 120 ? 1 : n > 60 ? 1.3 : 1.8) * Math.max(1, kd * 0.8);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < n; i++) {
            const a = i * slice;
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.lineTo(c + Math.cos(a) * sliceR, c + Math.sin(a) * sliceR);
            ctx.stroke();
        }

        // 7. Números: uno por casilla, todos en la misma línea
        const w100 = digitWidth100(numbers);
        const { f, outerEnd } = solveFont(n, w100, D);
        ctx.lineJoin = 'round';
        numbers.forEach((num, i) => {
            const gone = elimSet.has(num);
            const text = String(num);
            ctx.save();
            ctx.translate(c, c);
            ctx.rotate(i * slice + slice / 2);
            ctx.font = `800 ${f}px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = Math.max(2, f / 5);
            ctx.strokeStyle = gone ? 'rgba(2,30,55,0.75)' : 'rgba(0,0,0,0.5)';
            ctx.strokeText(text, outerEnd, 0);
            ctx.fillStyle = gone ? '#d4f1ff' : '#ffffff';
            ctx.fillText(text, outerEnd, 0);

            // Etiqueta "AL AGUA" dentro de la casilla cuando hay espacio
            if (gone) {
                const numLen = ctx.measureText(text).width;
                const labelEnd = outerEnd - numLen - 10 * kd;
                const avail = labelEnd - 98 * kd;
                for (const word of ['AL AGUA', 'AGUA']) {
                    let drawn = false;
                    for (let lf = 18 * kd; lf >= 8; lf -= 1) {
                        ctx.font = `800 ${lf}px ${FONT}`;
                        const len = ctx.measureText(word).width;
                        if (len > avail) continue;
                        const arc = (2 * Math.PI * (labelEnd - len)) / n;
                        if (arc < lf * 0.8 + 2) continue;
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = 'rgba(2,30,55,0.8)';
                        ctx.strokeText(word, labelEnd, 0);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(word, labelEnd, 0);
                        drawn = true;
                        break;
                    }
                    if (drawn) break;
                }
            }
            ctx.restore();
        });

        // 8. Casilla resaltada (resultado)
        const hi = highlight == null ? -1 : numbers.indexOf(highlight);
        if (hi >= 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.arc(c, c, sliceR, hi * slice, (hi + 1) * slice);
            ctx.closePath();
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 24 * kd;
            ctx.lineWidth = 4 * kd;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.restore();
        }

        // 9. Anillo central decorativo
        ctx.beginPath();
        ctx.arc(c, c, 74 * kd, 0, Math.PI * 2);
        ctx.fillStyle = '#0b0d1a';
        ctx.fill();
        ctx.lineWidth = 6 * kd;
        ctx.strokeStyle = gold;
        ctx.stroke();
    }, [numbers, eliminated, highlight, D, mode, fontTick, n]);

    /* ---------- Aguja: "clic" por casilla + número en vivo ---------- */
    useEffect(() => {
        if (!isSpinning || n === 0) return undefined;
        const slice = 360 / n;
        let raf = 0;
        let lastIdx = -1;

        const loop = () => {
            const el = rotorRef.current;
            if (el) {
                const tr = getComputedStyle(el).transform;
                const m = tr && tr !== 'none' ? tr.match(/matrix\(([^)]+)\)/) : null;
                if (m) {
                    const [a, b] = m[1].split(',').map(parseFloat);
                    const rot = (Math.atan2(b, a) * 180) / Math.PI;
                    // la aguja apunta a 270° del canvas (arriba)
                    const theta = (((270 - rot) % 360) + 360) % 360;
                    const idx = Math.floor(theta / slice) % n;
                    if (idx !== lastIdx) {
                        if (liveRef.current) liveRef.current.textContent = String(numbers[idx]);
                        if (lastIdx !== -1) {
                            needleRef.current?.animate(
                                [
                                    { transform: 'translateX(-50%) rotate(0deg)' },
                                    { transform: 'translateX(-50%) rotate(-26deg)', offset: 0.35 },
                                    { transform: 'translateX(-50%) rotate(0deg)' },
                                ],
                                { duration: 120, easing: 'ease-out' }
                            );
                            sonidos.tick();
                        }
                        lastIdx = idx;
                    }
                }
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [isSpinning, n, numbers]);

    const handleEnd = (e) => {
        if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
        onFinished?.();
    };

    const rotorStyle = {
        transform: `rotate(${rotation}deg)`,
        transition: isSpinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.12, 0.62, 0.08, 1)` : 'none',
    };
    if (mode === 'window') {
        Object.assign(rotorStyle, { position: 'absolute', top: 0, left: '50%', width: D, height: D, marginLeft: -D / 2 });
    }

    return (
        <div ref={wrapRef} className="wheel-wrap">
            <div
                className={`wheel-stage mode-${mode} ${isSpinning ? 'is-spinning' : ''}`}
                style={{ width: stageW, height: stageH }}
            >
                <div className="wheel-glow" />

                {/* Aguja */}
                <div className="needle" ref={needleRef} aria-hidden="true">
                    <svg viewBox="0 0 46 64" width="46" height="64">
                        <defs>
                            <linearGradient id="needleGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stopColor="#ff6b8a" />
                                <stop offset="1" stopColor="#e0113f" />
                            </linearGradient>
                        </defs>
                        <path d="M23 62 L4 18 A21 21 0 1 1 42 18 Z" fill="url(#needleGrad)" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
                        <circle cx="23" cy="19" r="7" fill="#fff" opacity="0.9" />
                    </svg>
                </div>

                {/* Rueda giratoria (en vista ampliada se recorta y solo se ve la parte de arriba) */}
                <div className="wheel-clip">
                    <div ref={rotorRef} className="wheel-rotor" style={rotorStyle} onTransitionEnd={handleEnd}>
                        <canvas ref={canvasRef} />
                    </div>
                </div>

                {/* Botón central (no gira). Mientras gira muestra el número bajo la aguja */}
                {mode === 'full' && (
                    <button type="button" className="wheel-hub" onClick={onSpin} disabled={disabled} aria-label="Girar la ruleta">
                        <span className="hub-label">{label}</span>
                        <span className="hub-live" ref={liveRef} />
                    </button>
                )}

                {/* En vista ampliada, el número bajo la aguja se muestra en una etiqueta */}
                {mode === 'window' && (
                    <div className="window-live" aria-hidden="true">
                        <span ref={liveRef} />
                    </div>
                )}

                {/* Sello "AL AGUA" después de cerrar un resultado al agua */}
                {stamp && (
                    <div key={stamp.id} className="water-stamp" aria-hidden="true">
                        <span>💦 AL AGUA</span>
                        <strong>{stamp.number}</strong>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Wheel;