import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { roll, parseRollCommand, rollInitiativeD100 } from '../utils/diceRoller';

// Returns a mock value that reliably produces face N on a `sides`-sided die.
// Formula: Math.floor(random * sides) + 1 = N  →  use midpoint (N-0.5)/sides.
function mockForDie(n: number, sides: number) {
    return (n - 0.5) / sides;
}
// Shorthand for d100 (the most common case in this codebase).
function mockForRoll(n: number) {
    return mockForDie(n, 100);
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

// ── roll() ────────────────────────────────────────────────────────────────────

describe('roll()', () => {
    it('returns null for invalid formulas', () => {
        expect(roll('hello')).toBeNull();
        expect(roll('d')).toBeNull();
        expect(roll('0d6')).toBeNull();
        expect(roll('1d1')).toBeNull();    // x < 2
        expect(roll('21d6')).toBeNull();   // n > 20
        expect(roll('1d1001')).toBeNull(); // x > 1000
        expect(roll('')).toBeNull();
    });

    it('parses a plain dX formula (n defaults to 1)', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForDie(4, 6)); // → 4 on d6
        const result = roll('d6');
        expect(result).not.toBeNull();
        expect(result!.formula).toBe('d6');
        expect(result!.result).toBe(4);
    });

    it('parses NdX with a positive modifier', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForDie(1, 6)); // → 1 on each die
        const result = roll('2d6+10');
        expect(result).not.toBeNull();
        expect(result!.result).toBe(12); // 1+1+10
        expect(result!.formula).toBe('2d6+10');
    });

    it('parses NdX with a negative modifier', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForDie(6, 6)); // → 6 on each die
        const result = roll('2d6-5');
        expect(result).not.toBeNull();
        expect(result!.result).toBe(7); // 6+6-5
    });

    it('details string includes the final result', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(1));
        const result = roll('d20');
        expect(result!.details).toContain('= 1');
    });

    it('d100 returns a number for a normal roll', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(51));
        const result = roll('d100');
        expect(result).not.toBeNull();
        expect(result!.result).toBe(51);
    });

    it('d100 chains open-ended on roll >= 90', () => {
        // 90 triggers the chain, then 50 stops it → 90 + 50 = 140
        vi.spyOn(Math, 'random')
            .mockReturnValueOnce(mockForRoll(90))
            .mockReturnValueOnce(mockForRoll(50));
        const result = roll('d100');
        expect(result!.result).toBe(140);
    });

    it('d100 subtracts on pifia (roll <= 3)', () => {
        // 3 triggers pifia, then 50 stops chain → 3 - 50 = -47
        vi.spyOn(Math, 'random')
            .mockReturnValueOnce(mockForRoll(3))
            .mockReturnValueOnce(mockForRoll(50));
        const result = roll('d100');
        expect(result!.result).toBe(-47);
    });
});

// ── parseRollCommand() ────────────────────────────────────────────────────────

describe('parseRollCommand()', () => {
    it('returns null when input does not start with /roll', () => {
        expect(parseRollCommand('hello')).toBeNull();
        expect(parseRollCommand('roll 1d6')).toBeNull();
        expect(parseRollCommand('/rolll 1d6')).toBeNull();
    });

    it('returns null when the formula after /roll is invalid', () => {
        expect(parseRollCommand('/roll abc')).toBeNull();
    });

    it('parses /roll 1d6', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForDie(3, 6));
        const result = parseRollCommand('/roll 1d6');
        expect(result).not.toBeNull();
        expect(result!.result).toBe(3);
    });

    it('parses /roll d100+50', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(40));
        const result = parseRollCommand('/roll d100+50');
        expect(result!.result).toBe(90);
    });

    it('is case-insensitive for the /roll prefix', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(1));
        expect(parseRollCommand('/Roll 1d6')).not.toBeNull();
    });

    it('trims surrounding whitespace', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(1));
        expect(parseRollCommand('  /roll 1d6  ')).not.toBeNull();
    });
});

// ── rollInitiativeD100() ──────────────────────────────────────────────────────

describe('rollInitiativeD100()', () => {
    it('returns -125 on a roll of 1 (worst pifia)', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(1));
        expect(rollInitiativeD100()).toBe(-125);
    });

    it('returns -100 on a roll of 2', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(2));
        expect(rollInitiativeD100()).toBe(-100);
    });

    it('returns -75 on a roll of 3', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(3));
        expect(rollInitiativeD100()).toBe(-75);
    });

    it('returns the face value for rolls 4-89', () => {
        vi.spyOn(Math, 'random').mockReturnValue(mockForRoll(50));
        expect(rollInitiativeD100()).toBe(50);
    });

    it('chains open-ended on roll >= 90', () => {
        // 90 triggers chain, then 30 stops it → 90 + 30 = 120
        vi.spyOn(Math, 'random')
            .mockReturnValueOnce(mockForRoll(90))
            .mockReturnValueOnce(mockForRoll(30));
        expect(rollInitiativeD100()).toBe(120);
    });
});
