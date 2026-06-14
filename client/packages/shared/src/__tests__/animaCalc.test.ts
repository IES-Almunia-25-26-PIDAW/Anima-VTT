import { describe, it, expect } from 'vitest';
import {
    isAnimaFormat,
    statMod,
    statTotal,
    calcTurno,
    calcPresencia,
    calcCombatSkill,
    calcSecondarySkill,
    calcMaxPDs,
    calcAcciones,
    calcKiBase,
    calcKiAccumBase,
    calcZeonBase,
    calcACTBase,
} from '../utils/animaCalc';
import type { AnimaAttributes } from '../models/character';

// ── helpers ────────────────────────────────────────────────────────────────────

function attrs(overrides: Partial<AnimaAttributes> = {}): AnimaAttributes {
    return { baseAGI: 10, baseDES: 10, ...overrides };
}

// ── isAnimaFormat ──────────────────────────────────────────────────────────────

describe('isAnimaFormat()', () => {
    it('returns true when baseAGI is present', () => {
        expect(isAnimaFormat({ baseAGI: 10 })).toBe(true);
    });

    it('returns false for empty object', () => {
        expect(isAnimaFormat({})).toBe(false);
    });

    it('returns false for old-format stats object', () => {
        expect(isAnimaFormat({ stats: { AGI: 10 } })).toBe(false);
    });
});

// ── statTotal ──────────────────────────────────────────────────────────────────

describe('statTotal()', () => {
    it('sums base and tmp', () => {
        expect(statTotal(8, 2)).toBe(10);
    });

    it('clamps to 0 at the low end', () => {
        expect(statTotal(0, -5)).toBe(0);
    });

    it('clamps to 20 at the high end', () => {
        expect(statTotal(18, 5)).toBe(20);
    });

    it('defaults both params to 0', () => {
        expect(statTotal()).toBe(0);
    });
});

// ── statMod ────────────────────────────────────────────────────────────────────

describe('statMod()', () => {
    it('returns −30 for stat total 0 or below', () => {
        expect(statMod(0)).toBe(-30);
    });

    it('returns 0 for stat total 5 (index 4)', () => {
        expect(statMod(5)).toBe(0);
    });

    it('returns 25 for stat total 10', () => {
        expect(statMod(10)).toBe(25);
    });

    it('returns 75 for stat total 20 (maximum)', () => {
        expect(statMod(20)).toBe(75);
    });

    it('clamps at 75 above 20', () => {
        expect(statMod(21)).toBe(75);
    });
});

// ── calcTurno ─────────────────────────────────────────────────────────────────

describe('calcTurno()', () => {
    it('returns AGI_mod + DES_mod for a standard character', () => {
        // AGI=10 → mod 25, DES=10 → mod 25 → total 50
        expect(calcTurno(attrs({ baseAGI: 10, baseDES: 10 }))).toBe(50);
    });

    it('returns 0 for zero stats', () => {
        // AGI=0 → −30, DES=0 → −30 → −60
        expect(calcTurno(attrs({ baseAGI: 0, baseDES: 0 }))).toBe(-60);
    });

    it('respects temporary modifiers', () => {
        // baseAGI=8, tmpAGI=2 → total 10 → mod 25; DES=10 → 25 → total 50
        expect(calcTurno(attrs({ baseAGI: 8, tmpAGI: 2, baseDES: 10 }))).toBe(50);
    });
});

// ── calcPresencia ─────────────────────────────────────────────────────────────

describe('calcPresencia()', () => {
    it('returns 20 for a level-0 character', () => {
        expect(calcPresencia(attrs())).toBe(20);
    });

    it('returns 30 for level 1 (25 + 1*5)', () => {
        expect(calcPresencia(attrs({ level1: 1 }))).toBe(30);
    });

    it('combines level1 and level2', () => {
        expect(calcPresencia(attrs({ level1: 2, level2: 1 }))).toBe(40); // 25 + 3*5
    });
});

// ── calcCombatSkill ────────────────────────────────────────────────────────────

describe('calcCombatSkill()', () => {
    it('returns floor(pds/cost)*5 + bonuses', () => {
        // 50 pds / cost 10 = 5 levels → 25 + statBonus 20 + catBonus 5 = 50
        expect(calcCombatSkill(50, 10, 20, 5)).toBe(50);
    });

    it('floors fractional levels', () => {
        expect(calcCombatSkill(15, 10, 0, 0)).toBe(5); // 1 full level
    });

    it('guards against zero cost (uses 1)', () => {
        expect(calcCombatSkill(10, 0, 0, 0)).toBe(50); // 10 levels * 5
    });

    it('returns 0 for no investment', () => {
        expect(calcCombatSkill(0, 10, 0, 0)).toBe(0);
    });
});

// ── calcSecondarySkill ────────────────────────────────────────────────────────

describe('calcSecondarySkill()', () => {
    it('applies −30 untrained penalty when fewer than 5 levels', () => {
        // 4 levels * 5 = 20, −30 untrained = −10
        expect(calcSecondarySkill(8, 2, 0, 0)).toBe(-10);
    });

    it('has no penalty at exactly 5 levels', () => {
        expect(calcSecondarySkill(10, 2, 0, 0)).toBe(25); // 5*5
    });

    it('adds specialty bonus of 40 when hasSpecialty is true', () => {
        expect(calcSecondarySkill(10, 2, 0, 0, 0, true)).toBe(65); // 25 + 40
    });

    it('includes statBonus and catBonus', () => {
        expect(calcSecondarySkill(10, 2, 15, 10)).toBe(50); // 25 + 15 + 10
    });
});

// ── calcMaxPDs ────────────────────────────────────────────────────────────────

describe('calcMaxPDs()', () => {
    it('returns 400 for a level-0 character', () => {
        expect(calcMaxPDs(attrs())).toBe(400);
    });

    it('returns 600 for level 1 (500 + 1*100)', () => {
        expect(calcMaxPDs(attrs({ level1: 1 }))).toBe(600);
    });

    it('adds level1 and level2', () => {
        expect(calcMaxPDs(attrs({ level1: 2, level2: 3 }))).toBe(1000); // 500 + 5*100
    });
});

// ── calcAcciones ──────────────────────────────────────────────────────────────

describe('calcAcciones()', () => {
    it('returns 1 action when AGI+DES ≤ 7', () => {
        expect(calcAcciones(attrs({ baseAGI: 3, baseDES: 4 }))).toBe(1);
    });

    it('returns 2 actions when AGI+DES is 8–11', () => {
        expect(calcAcciones(attrs({ baseAGI: 5, baseDES: 5 }))).toBe(2);
    });

    it('returns 3 actions when AGI+DES is 12–15', () => {
        expect(calcAcciones(attrs({ baseAGI: 7, baseDES: 7 }))).toBe(3);
    });

    it('returns 5 actions at maximum stats (20+20)', () => {
        expect(calcAcciones(attrs({ baseAGI: 20, baseDES: 20 }))).toBe(5);
    });
});

// ── calcKiBase / calcKiAccumBase ──────────────────────────────────────────────

describe('calcKiBase()', () => {
    it('returns stat for stats ≤ 10', () => {
        expect(calcKiBase(8)).toBe(8);
    });

    it('returns stat + (stat − 10) for stats > 10', () => {
        expect(calcKiBase(15)).toBe(20); // 15 + 5
    });
});

describe('calcKiAccumBase()', () => {
    it('returns 1 for stats ≤ 9', () => {
        expect(calcKiAccumBase(9)).toBe(1);
    });

    it('returns 2 for stats 10–12', () => {
        expect(calcKiAccumBase(11)).toBe(2);
    });

    it('returns 4 for stats 16+', () => {
        expect(calcKiAccumBase(16)).toBe(4);
    });
});

// ── calcZeonBase / calcACTBase ────────────────────────────────────────────────

describe('calcZeonBase()', () => {
    it('returns 20 for POD 1–4', () => {
        expect(calcZeonBase(1)).toBe(20);
        expect(calcZeonBase(4)).toBe(20);
    });

    it('returns 60 for POD 10', () => {
        expect(calcZeonBase(10)).toBe(60);
    });

    it('returns 260 for POD 20', () => {
        expect(calcZeonBase(20)).toBe(260);
    });

    it('clamps below 1 to 1', () => {
        expect(calcZeonBase(0)).toBe(calcZeonBase(1));
    });
});

describe('calcACTBase()', () => {
    it('returns 1 for POD 1–4', () => {
        expect(calcACTBase(4)).toBe(1);
    });

    it('returns 5 for POD 10 (10 − 5)', () => {
        expect(calcACTBase(10)).toBe(5);
    });

    it('returns 15 for POD 20', () => {
        expect(calcACTBase(20)).toBe(15);
    });
});
