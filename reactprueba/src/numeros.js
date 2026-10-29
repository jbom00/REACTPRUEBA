// src/numeros.js
// Utilidades para armar la lista de números de la ruleta.

/** Máximo de números que puede abarcar el rango (mínimo..máximo), antes de saltar. */
export const MAX_SPAN = 5000;

/**
 * Lee el texto de "números saltados". Acepta:
 *   7, 15, 22         → números sueltos (separados por coma, espacio, punto y coma o salto de línea)
 *   30-35  /  30 - 35 → rangos (también 30–35 o 30..35)
 *   -5, -10--8        → negativos
 * Devuelve { set: Set<number>, invalid: string[] } (lo que no se entendió).
 */
export function parseSkipped(text) {
    const set = new Set();
    const invalid = [];
    // "30 - 35" (con espacios) se interpreta como rango "30-35"
    const clean = String(text || '').replace(/(\d)\s+[-–—]\s+(-?\d)/g, '$1-$2');
    const tokens = clean.split(/[\s,;]+/).filter(Boolean);

    for (const tk of tokens) {
        let m = tk.match(/^(-?\d+)$/);
        if (m) {
            set.add(Number(m[1]));
            continue;
        }
        m = tk.match(/^(-?\d+)(?:-|–|—|\.\.)(-?\d+)$/);
        if (m) {
            let a = Number(m[1]);
            let b = Number(m[2]);
            if (a > b) [a, b] = [b, a];
            if (b - a > MAX_SPAN) {
                invalid.push(tk);
                continue;
            }
            for (let i = a; i <= b; i++) set.add(i);
            continue;
        }
        invalid.push(tk);
    }
    return { set, invalid };
}

/** Escribe una lista de números de forma compacta: [7, 15, 30, 31, 32, 33] → "7, 15, 30–33". */
export function formatRuns(nums) {
    const a = [...nums].sort((x, y) => x - y);
    const out = [];
    let i = 0;
    while (i < a.length) {
        let j = i;
        while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
        const len = j - i;
        out.push(len >= 2 ? `${a[i]}–${a[j]}` : len === 1 ? `${a[i]}, ${a[j]}` : `${a[i]}`);
        i = j + 1;
    }
    return out.join(', ');
}

/**
 * Arma las dos listas:
 *   base    → rango menos los números saltados
 *   numbers → base menos los ganadores anteriores (si la opción está activada)
 */
export function buildNumbers(min, max, skipped, winners, excludeWinners) {
    const base = [];
    for (let n = min; n <= max; n++) {
        if (!skipped.has(n)) base.push(n);
    }
    const out = excludeWinners && winners.length ? new Set(winners) : null;
    const numbers = out ? base.filter((n) => !out.has(n)) : base;
    return { base, numbers };
}