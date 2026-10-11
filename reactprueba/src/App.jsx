// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Home from './componentes/Inicio';
import Wheel, { SPIN_DURATION } from './componentes/Ruleta';
import Resultado from './componentes/Resultado';
import { sonidos, setSoundEnabled } from './sonidos';
import './App.css';

const MIN_NUMBERS = 3; // 2 al agua + 1 ganador
const MAX_NUMBERS = 200;
const PRESETS = [
  [1, 10],
  [1, 20],
  [1, 50],
  [1, 100],
  [1, 200],
];

/** Entero aleatorio uniforme en [0, max) usando crypto cuando existe. */
function randomInt(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const range = 4294967296;
    const limit = Math.floor(range / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do {
      window.crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

function parseInteger(value) {
  if (value === '' || value === '-') return NaN;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  // Rango
  const [minStr, setMinStr] = useState('1');
  const [maxStr, setMaxStr] = useState('20');

  // Ruleta
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  // Ronda: tiro 1 y 2 = al agua, tiro 3 = ganador
  const [spinCount, setSpinCount] = useState(1);
  const [roundNo, setRoundNo] = useState(1);
  const [drawn, setDrawn] = useState([]); // números ya "al agua" en esta ronda
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [sound, setSound] = useState(true);
  const [stamp, setStamp] = useState(null); // sello "AL AGUA" sobre la ruleta

  const pendingRef = useRef(null);
  const safetyRef = useRef(null);
  const stampTimerRef = useRef(null);

  useEffect(() => setSoundEnabled(sound), [sound]);
  useEffect(
    () => () => {
      clearTimeout(safetyRef.current);
      clearTimeout(stampTimerRef.current);
    },
    []
  );

  /* ---------- Validación del rango ---------- */
  const min = parseInteger(minStr);
  const max = parseInteger(maxStr);
  let error = null;
  if (Number.isNaN(min) || Number.isNaN(max)) error = 'Ingresa números enteros en ambos campos.';
  else if (max <= min) error = 'El máximo debe ser mayor que el mínimo.';
  else if (max - min + 1 < MIN_NUMBERS) error = `Necesitas al menos ${MIN_NUMBERS} números (2 al agua + 1 ganador).`;
  else if (max - min + 1 > MAX_NUMBERS) error = `Máximo ${MAX_NUMBERS} números por ruleta.`;

  const numbers = useMemo(
    () => (error ? [] : Array.from({ length: max - min + 1 }, (_, i) => min + i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [error, min, max]
  );

  const rounds = useMemo(() => {
    const map = new Map();
    [...history].reverse().forEach((h) => {
      if (!map.has(h.round)) map.set(h.round, []);
      map.get(h.round).push(h);
    });
    return [...map.entries()].reverse();
  }, [history]);

  if (currentPage === 'home') {
    return (
      <div className="app-shell">
        <div className="bg-fx"><span /><span /><span /></div>
        <Home onStart={() => setCurrentPage('roulette')} />
      </div>
    );
  }

  /* ---------- Acciones ---------- */
  const resetRound = () => {
    setSpinCount(1);
    setDrawn([]);
  };

  const changeRange = (setter) => (e) => {
    setter(e.target.value);
    resetRound(); // al cambiar el rango, la ronda en curso se reinicia
  };

  const applyPreset = ([a, b]) => {
    setMinStr(String(a));
    setMaxStr(String(b));
    resetRound();
  };

  const finishSpin = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    clearTimeout(safetyRef.current);

    const type = pending.attempt === 3 ? 'winner' : 'water';
    const entry = {
      id: `${Date.now()}-${Math.random()}`,
      number: pending.number,
      type,
      attempt: pending.attempt,
      round: pending.round,
    };

    setIsSpinning(false);
    setResult(entry);
    setHistory((h) => [entry, ...h]);
    if (type === 'water') setDrawn((d) => [...d, pending.number]);
    if (type === 'winner') sonidos.win();
    else sonidos.splash();
  };

  const spin = () => {
    if (error || isSpinning || result) return;

    // El ganador del tiro se elige UNA vez, entre los números que siguen en juego
    const available = numbers.filter((n) => !drawn.includes(n));
    const pick = available[randomInt(available.length)];
    const idx = numbers.indexOf(pick);

    // La aguja está arriba (270° en el canvas). Para que la casilla `idx`
    // quede bajo la aguja: rotación ≡ 270 - (idx + 0.5) * slice (mod 360)
    const slice = 360 / numbers.length;
    const jitter = (Math.random() - 0.5) * slice * 0.7; // no cae siempre en el centro exacto
    const target = 270 - (idx + 0.5) * slice + jitter;
    const delta = (((target - rotation) % 360) + 360) % 360;
    const turns = 5 + randomInt(3);

    pendingRef.current = { number: pick, attempt: spinCount, round: roundNo };
    clearTimeout(stampTimerRef.current);
    setStamp(null);
    sonidos.start();
    setIsSpinning(true);
    setRotation(rotation + turns * 360 + delta);

    // Respaldo por si el navegador no dispara transitionend
    safetyRef.current = setTimeout(finishSpin, SPIN_DURATION + 800);
  };

  const closeResult = () => {
    if (!result) return;
    if (result.type === 'winner') {
      setSpinCount(1);
      setDrawn([]);
      setRoundNo((r) => r + 1);
    } else {
      setSpinCount((c) => c + 1);
      // sello visual "AL AGUA" sobre la ruleta
      setStamp({ id: Date.now(), number: result.number });
      clearTimeout(stampTimerRef.current);
      stampTimerRef.current = setTimeout(() => setStamp(null), 2800);
    }
    setResult(null);
  };

  const resetAll = () => {
    setStamp(null);
    setHistory([]);
    setResult(null);
    setSpinCount(1);
    setDrawn([]);
    setRoundNo(1);
  };

  const remaining = numbers.length - drawn.length;
  const isLast = spinCount === 3;
  const canSpin = !error && !isSpinning && !result;

  const steps = [
    { n: 1, icon: '💦', label: 'Al agua' },
    { n: 2, icon: '💦', label: 'Al agua' },
    { n: 3, icon: '🏆', label: '¡Ganador!' },
  ];

  const spinLabel = isSpinning
    ? 'Girando…'
    : isLast
    ? '🏆 Lanzar por el ganador'
    : `💦 Lanzar tiro ${spinCount} (al agua)`;

  return (
    <div className="app-shell">
      <div className="bg-fx"><span /><span /><span /></div>

      <div className="page">
        {/* Barra superior */}
        <header className="topbar">
          <button type="button" className="btn-ghost" onClick={() => setCurrentPage('home')} disabled={isSpinning}>
            ← Inicio
          </button>
          <div className="topbar-right">
            <span className="pill">Ronda {roundNo}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSound((s) => !s)}
              aria-label={sound ? 'Silenciar' : 'Activar sonido'}
              title={sound ? 'Silenciar' : 'Activar sonido'}
            >
              {sound ? '🔊' : '🔇'}
            </button>
          </div>
        </header>

        <h1 className="title">
          Ruleta de <span>Números</span>
        </h1>

        {/* Progreso de la ronda */}
        <ol className="steps">
          {steps.map((s) => {
            const state = spinCount > s.n ? 'done' : spinCount === s.n ? 'active' : 'pending';
            return (
              <li key={s.n} className={`step step-${state} ${s.n === 3 ? 'step-gold' : ''}`}>
                <span className="step-dot">{state === 'done' ? '✓' : s.n}</span>
                <span className="step-text">
                  {s.icon} {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="layout">
          {/* Columna izquierda: ruleta */}
          <section className="wheel-col">
            <Wheel
              numbers={numbers}
              eliminated={drawn}
              highlight={result ? result.number : null}
              rotation={rotation}
              isSpinning={isSpinning}
              disabled={!canSpin}
              label="GIRAR"
              stamp={stamp}
              onSpin={spin}
              onFinished={finishSpin}
            />

            <button
              type="button"
              className={`spin-btn ${isLast ? 'spin-btn-gold' : ''}`}
              onClick={spin}
              disabled={!canSpin}
            >
              {spinLabel}
            </button>
            {error && <p className="error-msg">⚠ {error}</p>}

            {drawn.length > 0 && (
              <div className="agua-strip">
                <span className="agua-strip-label">💦 Al agua en esta ronda</span>
                <div className="chips">
                  {drawn.map((d) => (
                    <span key={d} className="chip chip-water">
                      💦 <strong>{d}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Columna derecha: configuración e historial */}
          <aside className="side-col">
            <div className="panel">
              <h2 className="panel-title">Rango de números</h2>
              <div className="fields">
                <label className="field">
                  <span>Mínimo</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={minStr}
                    onChange={changeRange(setMinStr)}
                    disabled={isSpinning}
                  />
                </label>
                <label className="field">
                  <span>Máximo</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={maxStr}
                    onChange={changeRange(setMaxStr)}
                    disabled={isSpinning}
                  />
                </label>
              </div>
              <div className="presets">
                {PRESETS.map(([a, b]) => (
                  <button
                    type="button"
                    key={`${a}-${b}`}
                    className={`preset ${min === a && max === b ? 'preset-on' : ''}`}
                    onClick={() => applyPreset([a, b])}
                    disabled={isSpinning}
                  >
                    {a} – {b}
                  </button>
                ))}
              </div>
              {!error && (
                <div className="stats">
                  <div>
                    <strong>{remaining}</strong>
                    <small>en juego</small>
                  </div>
                  <div>
                    <strong>{drawn.length}</strong>
                    <small>al agua</small>
                  </div>
                  <div>
                    <strong>{numbers.length}</strong>
                    <small>total</small>
                  </div>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Historial</h2>
                <button type="button" className="link-danger" onClick={resetAll} disabled={isSpinning}>
                  Reiniciar todo
                </button>
              </div>
              {rounds.length === 0 ? (
                <p className="empty">Todavía no hay tiros. ¡Gira la ruleta!</p>
              ) : (
                <div className="rounds">
                  {rounds.map(([roundId, shots]) => (
                    <div className="round-block" key={roundId}>
                      <span className="round-label">Ronda {roundId}</span>
                      <div className="chips">
                        {shots.map((s) => (
                          <span key={s.id} className={`chip chip-${s.type}`}>
                            {s.type === 'winner' ? '🏆' : '💦'} <strong>{s.number}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {result && <Resultado result={result} remaining={remaining} onClose={closeResult} />}
    </div>
  );
}

export default App;