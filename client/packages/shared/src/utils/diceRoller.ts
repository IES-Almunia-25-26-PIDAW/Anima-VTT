export interface RollResult {
    formula: string;
    result: number;
    details: string;
}

// Open-ended d100 (Anima Beyond Fantasy rule):
// Roll ≥90  → roll again and add (repeat while ≥90, max 10 times).
// Roll ≤3   → pifia: roll again and subtract (repeat while ≤3, max 10 times).
// Roll 4–89 → use as-is.
function rollOpenD100(): { total: number; parts: string[] } {
    const first = Math.floor(Math.random() * 100) + 1;
    const parts: string[] = [`[${first}]`];
    let total = first;

    if (first >= 90) {
        while (parts.length < 10) {
            const r = Math.floor(Math.random() * 100) + 1;
            parts.push(`+[${r}]`);
            total += r;
            if (r < 90) break;
        }
    } else if (first <= 3) {
        while (parts.length < 10) {
            const r = Math.floor(Math.random() * 100) + 1;
            parts.push(`-[${r}]`);
            total -= r;
            if (r > 3) break;
        }
    }

    return { total, parts };
}

// Initiative d100 (Anima initiative pifia rule):
// Roll 1 → −125, Roll 2 → −100, Roll 3 → −75 (fixed penalty, no re-roll).
// Roll 4–89 → use as-is.
// Roll ≥90  → open-ended add (same as standard abierta).
// Returns the raw initiative die value (before adding Turno bonus).
export function rollInitiativeD100(): number {
    const first = Math.floor(Math.random() * 100) + 1;

    if (first === 1) return -125;
    if (first === 2) return -100;
    if (first === 3) return -75;
    if (first < 90)  return first;

    // Open-ended
    let total = first;
    let iter = 0;
    while (iter < 9) {
        const r = Math.floor(Math.random() * 100) + 1;
        total += r;
        iter++;
        if (r < 90) break;
    }
    return total;
}

// Parse and roll a dice formula: [N]dX[±M]
// Examples: "d100", "2d6+3", "1d20-5", "d100+100"
// Returns null if the formula is invalid.
export function roll(formula: string): RollResult | null {
    const match = formula.trim().toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) return null;

    const n = match[1] ? parseInt(match[1], 10) : 1;
    const x = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;

    if (n < 1 || n > 20 || x < 2 || x > 1000) return null;

    let diceTotal: number;
    let diceStr: string;

    if (n === 1 && x === 100) {
        const { total, parts } = rollOpenD100();
        diceTotal = total;
        diceStr = parts.join('');
    } else {
        const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * x) + 1);
        diceTotal = rolls.reduce((a, b) => a + b, 0);
        diceStr = `[${rolls.join(', ')}]`;
    }

    const result = diceTotal + mod;
    const modStr = mod !== 0 ? (mod >= 0 ? `+${mod}` : `${mod}`) : '';
    const details = `${diceStr}${modStr} = ${result}`;
    const displayFormula = `${n === 1 ? '' : n}d${x}${modStr}`;

    return { formula: displayFormula, result, details };
}

// Extract and roll a /roll command from chat input.
// Returns null if the input doesn't start with "/roll " or the formula is invalid.
export function parseRollCommand(input: string): RollResult | null {
    const trimmed = input.trim();
    if (!trimmed.toLowerCase().startsWith('/roll ')) return null;
    return roll(trimmed.slice(6).trim());
}
