import type { AnimaAttributes } from '../models/character';

// Stat value (1–20) → modifier, from spec Table 3.3
const STAT_MODS = [-30, -20, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75];

export function statTotal(base = 0, tmp = 0): number {
    return Math.min(20, Math.max(0, base + tmp));
}

export function statMod(total: number): number {
    if (total <= 0) return -30;
    if (total > 20) return 75;
    return STAT_MODS[total - 1];
}

export function totalLevel(a: AnimaAttributes): number {
    return (a.level1 ?? 0) + (a.level2 ?? 0);
}

// Presencia = 25 + level*5 (min level 1), or 20 if no levels
export function calcPresencia(a: AnimaAttributes): number {
    const lvl = totalLevel(a);
    return lvl >= 1 ? 25 + lvl * 5 : 20;
}

// Combat skill total = floor(pds / cost) * 5 + statBonus + catBonus
export function calcCombatSkill(pds = 0, cost = 10, statBonus = 0, catBonus = 0): number {
    return Math.floor(pds / Math.max(1, cost)) * 5 + statBonus + catBonus;
}

// Secondary skill total — untrained penalty of −30 if fewer than 5 PD levels purchased
export function calcSecondarySkill(
    pds = 0,
    cost = 2,
    statBonus = 0,
    catBonus = 0,
    esp = 0,
    hasSpecialty = false,
): number {
    const levels = Math.floor(pds / Math.max(1, cost));
    const trained = levels >= 5;
    return levels * 5 + statBonus + catBonus + esp + (hasSpecialty ? 40 : 0) + (trained ? 0 : -30);
}

// Initiative base = AGI_bonus + DES_bonus
export function calcTurno(a: AnimaAttributes): number {
    return statMod(statTotal(a.baseAGI, a.tmpAGI)) + statMod(statTotal(a.baseDES, a.tmpDES));
}

// Max PDs a character can spend: 400 at level 0, 500+level*100 otherwise
export function calcMaxPDs(a: AnimaAttributes): number {
    const lvl = totalLevel(a);
    return lvl === 0 ? 400 : 500 + lvl * 100;
}

// Total PDs currently spent across all tracked categories
export function calcSpentPDs(a: AnimaAttributes): number {
    let total = (a.pdHA ?? 0) + (a.pdHP ?? 0) + (a.pdHE ?? 0) + (a.pdLA ?? 0);

    if (a.secondarySkills) {
        for (const entry of Object.values(a.secondarySkills)) {
            if (entry) total += entry.pds ?? 0;
        }
    }

    if (a.ki) {
        for (const stat of Object.values(a.ki)) {
            if (stat) total += (stat.pds ?? 0) + (stat.accumPds ?? 0);
        }
    }

    const m = a.mystic;
    if (m) {
        total += (m.pdZeon ?? 0) + (m.pdACT ?? 0) + (m.pdProyMag ?? 0) +
            (m.pdConvocar ?? 0) + (m.pdAtar ?? 0) + (m.pdDesconvocar ?? 0) + (m.pdControlar ?? 0);
    }

    const p = a.psychic;
    if (p) {
        total += (p.pdCV ?? 0) + (p.pdProyPsi ?? 0);
    }

    return total;
}

// Actions per turn from AGI + DES totals (spec Table 4.2)
export function calcAcciones(a: AnimaAttributes): number {
    const sum = statTotal(a.baseAGI, a.tmpAGI) + statTotal(a.baseDES, a.tmpDES);
    if (sum <= 7)  return 1;
    if (sum <= 11) return 2;
    if (sum <= 15) return 3;
    if (sum <= 19) return 4;
    return 5;
}

// Ki base points for a stat: stat + max(0, stat - 10)
export function calcKiBase(st: number): number {
    return st + Math.max(0, st - 10);
}

// Ki accumulation base from stat value (Tabla_Acum lookup)
export function calcKiAccumBase(st: number): number {
    if (st <= 4)  return 1;
    if (st <= 7)  return 2;
    if (st <= 10) return 3;
    if (st <= 13) return 4;
    if (st <= 16) return 5;
    if (st <= 19) return 6;
    return 7;
}

// Zeón base from POD (Tabla_ValoresBase col 2)
const ZEON_BASE: Record<number, number> = {
    1: 20, 2: 20, 3: 20, 4: 20,
    5: 30, 6: 30,
    7: 40, 8: 40,
    9: 50,
    10: 60,
    11: 80,
    12: 100,
    13: 120,
    14: 140,
    15: 160,
    16: 180,
    17: 200,
    18: 220,
    19: 240,
    20: 260,
};
export function calcZeonBase(podTotal: number): number {
    return ZEON_BASE[Math.max(1, Math.min(20, podTotal))] ?? 20;
}

// ACT base from POD (Tabla_ValoresBase col 3)
export function calcACTBase(podTotal: number): number {
    const clamped = Math.max(1, Math.min(20, podTotal));
    if (clamped <= 4)  return 1;
    if (clamped <= 6)  return 2;
    if (clamped <= 8)  return 3;
    if (clamped === 9) return 4;
    return clamped - 5;
}

// Returns true if the attributes object uses Anima format (has at least one base stat)
export function isAnimaFormat(attrs: Record<string, unknown>): boolean {
    return 'baseAGI' in attrs;
}
