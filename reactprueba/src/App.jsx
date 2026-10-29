// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Home from './componentes/Inicio';
import Wheel, { SPIN_DURATION } from './componentes/Ruleta';
import Resultado from './componentes/Resultado';
import { sonidos, setSoundEnabled } from './sonidos';
import { MAX_SPAN, parseSkipped, buildNumbers, formatRuns } from './numeros';
import './App.css';

const MIN_NUMBERS = 3; // 2 al agua + 1 ganador
const MAX_NUMBERS = 200;
const EMPTY = [];
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

  // Rango y números saltados
  const [minStr, setMinStr] = useState('1');
  const [maxStr, setMaxStr] = useState('20');
  const [skipStr, setSkipStr] = useState('');

  // Regla: los ganadores salen de la ruleta en las rondas siguientes
  const [excludeWinners, setExcludeWinners] = useState(false);
  const [winners, setWinners] = useState([]); // ganadores de la sesión

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

  /* ---------- Rango, números saltados y ganadores excluidos ---------- */
  const min = parseInteger(minStr);
  const max = parseInteger(maxStr);
  const parsed = useMemo(() => parseSkipped(skipStr), [skipStr]);

  let rangeError = null;
  if (Number.isNaN(min) || Number.isNaN(max)) rangeError = 'Ingresa números enteros en ambos campos.';
  else if (max <= min) rangeError = 'El máximo debe ser mayor que el mínimo.';
  else if (max - min + 1 > MAX_SPAN) rangeError = `El rango es demasiado amplio (máximo ${MAX_SPAN} números entre el mínimo y el máximo).`;

  const lists = useMemo(
    () => (rangeError ? { base: EMPTY, numbers: EMPTY } : buildNumbers(min, max, parsed.set, winners, excludeWinners)),
    [rangeError, min, max, parsed, winners, excludeWinners]
  );

  let error = rangeError;
  let errorKind = rangeError ? 'range' : null;
  if (!error) {
    const nBase = lists.base.length;
    if (nBase < MIN_NUMBERS) {
      error = `Necesitas al menos ${MIN_NUMBERS} números disponibles (2 al agua + 1 ganador) y tienes ${nBase}.`;
      errorKind = 'range';
    } else if (nBase > MAX_NUMBERS) {
      error = `Tienes ${nBase} números y el máximo es ${MAX_NUMBERS}. Acorta el rango o salta más números.`;
      errorKind = 'range';
    } else if (lists.numbers.length < MIN_NUMBERS) {
      error = `Solo quedan ${lists.numbers.length} números porque los ganadores anteriores están excluidos.`;
      errorKind = 'winners';
    }
  }

  const numbers = useMemo(() => (error ? EMPTY : lists.numbers), [error, lists]);

  const skippedInRange = useMemo(
    () => (rangeError ? EMPTY : [...parsed.set].filter((n) => n >= min && n <= max).sort((a, b) => a - b)),
    [rangeError, parsed, min, max]
  );
  const skippedOutside = rangeError ? 0 : parsed.set.size - skippedInRange.length;

  const rounds = useMemo(() => {
    const map = new Map();
    [...history].reverse().forEach((h) => {
      if (!map.has(h.round)) map.set(h.round, []);
      map.get(h.round).push(h);
    });
    return [...map.entries()].reverse();
  }, [history]);

  /* ---------- Acciones (definidas antes del return de la portada) ---------- */
  const resetRound = () => {
    setSpinCount(1);
    setDrawn([]);
  };

  const changeRange = (setter) => (e) => {
    setter(e.target.value);
    resetRound(); // al cambiar el rango, la ronda en curso se reinicia
  };

  const changeSkip = (e) => {
    setSkipStr(e.target.value);
    resetRound();
  };

  const applyPreset = ([a, b]) => {
    setMinStr(String(a));
    setMaxStr(String(b));
    resetRound();
  };

  const toggleExcludeWinners = (value) => {
    setExcludeWinners(value);
    resetRound(); // cambia la lista de números: la ronda en curso se reinicia
  };

  const returnWinners = () => {
    setWinners([]);
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

    // El número del tiro se elige UNA vez, entre los que siguen en juego
    // (`numbers` ya no incluye saltados ni ganadores excluidos)
    const available = numbers.filter((n) => !drawn.includes(n));
    if (available.length === 0) return;
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
      // el ganador se registra recién al cerrar, para que la ruleta no cambie detrás de la pantalla de victoria
      setWinners((w) => (w.includes(result.number) ? w : [...w, result.number]));
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
    setWinners([]);
  };

  /* ---------- Portada ---------- */
  if (currentPage === 'home') {
    return (
      <div className="app-shell">
        <div className="bg-fx"><span /><span /><span /></div>
        <Home
          onStart={() => setCurrentPage('roulette')}
          excludeWinners={excludeWinners}
          onToggleExcludeWinners={toggleExcludeWinners}
        />
      </div>
    );
  }

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
            {errorKind === 'winners' && (
              <button type="button" className="btn btn-gold btn-sm" onClick={returnWinners} disabled={isSpinning}>
                Devolver los ganadores a la ruleta
              </button>
            )}

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

              {/* Números saltados */}
              <label className="field field-wide">
                <span>
                  Números saltados <em>(no vendidos o ausentes)</em>
                </span>
                <input
                  type="text"
                  className="skip-input"
                  value={skipStr}
                  onChange={changeSkip}
                  placeholder="Ej: 7, 15, 30-35"
                  disabled={isSpinning}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              {skippedInRange.length === 0 && parsed.invalid.length === 0 && skippedOutside === 0 && (
                <p className="skip-hint">Sepáralos con comas. Para varios seguidos usa un rango: 30-35.</p>
              )}
              {(skippedInRange.length > 0 || parsed.invalid.length > 0 || skippedOutside > 0) && (
                <div className="skip-info">
                  {skippedInRange.length > 0 && (
                    <p className="skip-ok">
                      ⏭ Se {skippedInRange.length === 1 ? 'salta' : 'saltan'} <strong>{skippedInRange.length}</strong>{' '}
                      {skippedInRange.length === 1 ? 'número' : 'números'}: {formatRuns(skippedInRange)}
                    </p>
                  )}
                  {skippedOutside > 0 && (
                    <p className="skip-warn">
                      {skippedOutside} {skippedOutside === 1 ? 'número está' : 'números están'} fuera del rango y se{' '}
                      {skippedOutside === 1 ? 'ignora' : 'ignoran'}.
                    </p>
                  )}
                  {parsed.invalid.length > 0 && <p className="skip-bad">No entendí: {parsed.invalid.join(', ')}</p>}
                </div>
              )}

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
                    <small>en ruleta</small>
                  </div>
                </div>
              )}
            </div>

            <div className="panel">
              <h2 className="panel-title">Reglas del sorteo</h2>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={excludeWinners}
                  onChange={(e) => toggleExcludeWinners(e.target.checked)}
                  disabled={isSpinning}
                />
                <span className="switch" aria-hidden="true" />
                <span className="switch-text">
                  <strong>Excluir ganadores anteriores</strong>
                  <small>
                    {excludeWinners
                      ? 'Quien gana sale de la ruleta y no puede ganar otro premio.'
                      : 'Un ganador puede volver a ganar en las rondas siguientes.'}
                  </small>
                </span>
              </label>
              {winners.length > 0 && (
                <div className="winners-box">
                  <span className="agua-strip-label label-gold">
                    🏆 Ganadores{excludeWinners ? ' (fuera de la ruleta)' : ''}
                  </span>
                  <div className="chips">
                    {winners.map((w) => (
                      <span key={w} className="chip chip-winner">
                        🏆 <strong>{w}</strong>
                      </span>
                    ))}
                  </div>
                  {excludeWinners && (
                    <button type="button" className="link-danger" onClick={returnWinners} disabled={isSpinning}>
                      Devolver ganadores a la ruleta
                    </button>
                  )}
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

      {result && (
        <Resultado result={result} remaining={remaining} excludeWinners={excludeWinners} onClose={closeResult} />
      )}
    </div>
  );
}

export default App;