// src/componentes/Resultado.jsx
import React, { useMemo } from 'react';
import Confetti from './Confetti';

const rand = (a, b) => a + Math.random() * (b - a);

const WAVE_PATH = 'M0 40 C150 0 450 80 600 40 C750 0 1050 80 1200 40 V120 H0 Z';

function Resultado({ result, remaining, onClose }) {
    const isWinner = result.type === 'winner';

    const bubbles = useMemo(
        () =>
            Array.from({ length: 22 }, (_, i) => ({
                id: i,
                left: rand(2, 98),
                size: rand(8, 30),
                delay: rand(0, 3.5),
                dur: rand(3.5, 7),
            })),
        []
    );

    const drops = useMemo(
        () =>
            Array.from({ length: 18 }, (_, i) => ({
                id: i,
                left: rand(2, 98),
                delay: rand(0, 2.4),
                dur: rand(0.9, 1.6),
                size: rand(8, 16),
            })),
        []
    );

    const sparkles = useMemo(
        () =>
            Array.from({ length: 14 }, (_, i) => ({
                id: i,
                left: rand(4, 96),
                top: rand(6, 94),
                delay: rand(0, 2.5),
                size: rand(14, 30),
            })),
        []
    );

    if (isWinner) {
        return (
            <div className="overlay overlay-win" role="dialog" aria-modal="true" aria-label="Número ganador">
                <div className="rays" />
                <div className="win-glow" />
                {sparkles.map((s) => (
                    <span
                        key={s.id}
                        className="sparkle"
                        style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: s.size, animationDelay: `${s.delay}s` }}
                    >
                        ✦
                    </span>
                ))}
                <Confetti />

                <div className="result-card result-card-win">
                    <div className="trophy">🏆</div>
                    <div className="result-kicker kicker-gold">¡Tenemos ganador!</div>
                    <div className="result-number win-number">{result.number}</div>
                    <p className="result-note">El tercer tiro decide la ronda. ¡Felicitaciones!</p>
                    <button type="button" className="btn btn-gold" onClick={onClose} autoFocus>
                        Nueva ronda ↻
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="overlay overlay-water" role="dialog" aria-modal="true" aria-label="Número al agua">
            <div className="water-rise">
                <svg className="wave wave-back" viewBox="0 0 1200 120" preserveAspectRatio="none">
                    <path d={WAVE_PATH} />
                </svg>
                <svg className="wave wave-front" viewBox="0 0 1200 120" preserveAspectRatio="none">
                    <path d={WAVE_PATH} />
                </svg>
                <div className="water-fill" />
                {bubbles.map((b) => (
                    <span
                        key={b.id}
                        className="bubble"
                        style={{
                            left: `${b.left}%`,
                            width: b.size,
                            height: b.size,
                            animationDelay: `${b.delay}s`,
                            animationDuration: `${b.dur}s`,
                        }}
                    />
                ))}
            </div>

            {drops.map((d) => (
                <span
                    key={d.id}
                    className="drop"
                    style={{
                        left: `${d.left}%`,
                        width: d.size,
                        height: d.size * 1.4,
                        animationDelay: `${d.delay}s`,
                        animationDuration: `${d.dur}s`,
                    }}
                />
            ))}

            <div className="result-card result-card-water">
                <div className="splash-ring" />
                <div className="splash-ring ring-2" />
                <div className="result-kicker kicker-water">💦 ¡Al agua!</div>
                <div className="result-sub">Tiro {result.attempt} de 2</div>
                <div className="result-number water-number">{result.number}</div>
                <p className="result-note">
                    Este número queda fuera de la ronda. Quedan <strong>{remaining}</strong> en juego.
                </p>
                <button type="button" className="btn btn-water" onClick={onClose} autoFocus>
                    {result.attempt === 1 ? 'Siguiente: segundo al agua →' : 'Ir por el ganador 🏆'}
                </button>
            </div>
        </div>
    );
}

export default Resultado;