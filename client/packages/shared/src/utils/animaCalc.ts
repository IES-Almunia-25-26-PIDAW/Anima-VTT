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

// Initiative base = AGI_bonus + DES_bonus
export function calcTurno(a: AnimaAttributes): number {
    return statMod(statTotal(a.baseAGI, a.tmpAGI)) + statMod(statTotal(a.baseDES, a.tmpDES));
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

// Returns true if the attributes object uses Anima format (has at least one base stat)
export function isAnimaFormat(attrs: Record<string, unknown>): boolean {
    return 'baseAGI' in attrs;
}
