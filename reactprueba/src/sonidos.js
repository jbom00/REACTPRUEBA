// src/sonidos.js
// Sonidos sintetizados con WebAudio (estilo 8-bit, sin archivos).
//
// ¿Quieres tus propios sonidos? Crea la carpeta  src/assets/sonidos/  y pon ahí:
//    agua.mp3      → suena cuando un número se va al agua
//    ganador.mp3   → suena cuando sale el ganador
// (también sirven .wav / .ogg / .m4a). Si existen, se usan en lugar de los sintetizados.

const custom = import.meta.glob('./assets/sonidos/*.{mp3,wav,ogg,m4a}', {
    eager: true,
    query: '?url',
    import: 'default',
});

function findCustom(name) {
    const re = new RegExp(`/${name}\\.[a-z0-9]+$`, 'i');
    const key = Object.keys(custom).find((k) => re.test(k));
    return key ? custom[key] : null;
}

let ctx = null;
let enabled = true;
let lastTick = 0;

function getCtx() {
    if (!enabled) return null;
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function setSoundEnabled(value) {
    enabled = value;
}

function playCustom(name) {
    const url = findCustom(name);
    if (!url) return false;
    if (enabled) {
        const audio = new Audio(url);
        audio.volume = 0.9;
        audio.play().catch(() => { });
    }
    return true;
}

function tone({ freq = 440, to, dur = 0.12, type = 'sine', vol = 0.08, delay = 0 }) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.setValueAtTime(vol, t0 + Math.max(0.011, dur - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.5, vol = 0.09, from = 2400, to = 300, delay = 0 }) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t0);
}

export const sonidos = {
    // "clic" cuando la aguja pasa por una casilla
    tick() {
        const now = performance.now();
        if (now - lastTick < 45) return;
        lastTick = now;
        tone({ freq: 1500, to: 700, dur: 0.04, type: 'triangle', vol: 0.05 });
    },

    start() {
        tone({ freq: 300, to: 600, dur: 0.18, type: 'sawtooth', vol: 0.04 });
    },

    // AL AGUA: "fail" retro 8-bit (notas que van cayendo + deslizamiento final) y chapoteo
    splash() {
        if (playCustom('agua')) return;
        const steps = [
            [330, 0.2],
            [311, 0.2],
            [294, 0.2],
        ];
        let t = 0;
        steps.forEach(([freq, dur]) => {
            tone({ freq, dur, type: 'square', vol: 0.05, delay: t });
            t += dur;
        });
        tone({ freq: 277, to: 98, dur: 1.0, type: 'square', vol: 0.055, delay: t });
        tone({ freq: 139, to: 55, dur: 1.0, type: 'triangle', vol: 0.07, delay: t });
        noise({ dur: 0.9, vol: 0.08, from: 2200, to: 250, delay: t + 0.1 });
    },

    // GANADOR: fanfarria 8-bit (arpegio ascendente, acorde largo y trino)
    win() {
        if (playCustom('ganador')) return;
        const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
        arp.forEach((freq, i) => tone({ freq, dur: 0.1, type: 'square', vol: 0.045, delay: i * 0.075 }));

        const t = 0.62;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq) =>
            tone({ freq, dur: 1.0, type: 'square', vol: 0.032, delay: t })
        );
        tone({ freq: 261.63, dur: 1.1, type: 'triangle', vol: 0.08, delay: t });
        for (let k = 0; k < 7; k++) {
            tone({ freq: k % 2 ? 1567.98 : 1760, dur: 0.07, type: 'triangle', vol: 0.04, delay: t + 0.15 + k * 0.08 });
        }
    },
};