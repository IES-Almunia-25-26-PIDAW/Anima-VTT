import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { initialState } from '../store/initialState';

// Reset the store data before every test.
// Do NOT pass `true` (replace mode) — that would wipe out the action functions too.
// Merging initialState resets only the data fields while keeping actions intact.
beforeEach(() => {
    useStore.setState(initialState);
});

// ── token actions ──────────────────────────────────────────────────────────────

describe('upsertToken()', () => {
    it('adds a token to the store', () => {
        const token = { id: 1, sceneId: 1, characterId: 10, characterName: 'Kaelindra', x: 64, y: 64, rotation: 0, visible: true, locked: false, statusEffects: [] };
        useStore.getState().upsertToken(token);
        expect(useStore.getState().entities.tokens[1]).toEqual(token);
    });

    it('overwrites an existing token with the same id', () => {
        const base = { id: 1, sceneId: 1, characterId: 10, characterName: 'A', x: 0, y: 0, rotation: 0, visible: true, locked: false, statusEffects: [] };
        useStore.getState().upsertToken(base);
        useStore.getState().upsertToken({ ...base, x: 128 });
        expect(useStore.getState().entities.tokens[1].x).toBe(128);
    });
});

describe('moveToken()', () => {
    it('updates x and y for an existing token', () => {
        const token = { id: 5, sceneId: 1, characterId: 1, characterName: 'T', x: 0, y: 0, rotation: 0, visible: true, locked: false, statusEffects: [] };
        useStore.getState().upsertToken(token);
        useStore.getState().moveToken(5, 96, 160);
        const moved = useStore.getState().entities.tokens[5];
        expect(moved.x).toBe(96);
        expect(moved.y).toBe(160);
    });

    it('does nothing for an unknown token id', () => {
        useStore.getState().moveToken(999, 50, 50);
        expect(useStore.getState().entities.tokens[999]).toBeUndefined();
    });
});

describe('rotateToken()', () => {
    it('updates rotation for an existing token', () => {
        const token = { id: 2, sceneId: 1, characterId: 1, characterName: 'T', x: 0, y: 0, rotation: 0, visible: true, locked: false, statusEffects: [] };
        useStore.getState().upsertToken(token);
        useStore.getState().rotateToken(2, 90);
        expect(useStore.getState().entities.tokens[2].rotation).toBe(90);
    });
});

describe('setTokenVisibility()', () => {
    it('toggles visible to false', () => {
        const token = { id: 3, sceneId: 1, characterId: 1, characterName: 'T', x: 0, y: 0, rotation: 0, visible: true, locked: false, statusEffects: [] };
        useStore.getState().upsertToken(token);
        useStore.getState().setTokenVisibility(3, false);
        expect(useStore.getState().entities.tokens[3].visible).toBe(false);
    });
});

describe('selectToken()', () => {
    it('sets the selectedTokenId in ui', () => {
        useStore.getState().selectToken(7);
        expect(useStore.getState().ui.selectedTokenId).toBe(7);
    });

    it('clears selection when passed undefined', () => {
        useStore.getState().selectToken(7);
        useStore.getState().selectToken(undefined);
        expect(useStore.getState().ui.selectedTokenId).toBeUndefined();
    });
});

// ── combat actions ─────────────────────────────────────────────────────────────

describe('setCombat()', () => {
    it('sets inCombat to true with a combat state', () => {
        const cs = { active: true, currentRound: 1, currentTurnTokenId: 1, turnOrder: [1, 2] };
        useStore.getState().setCombat(true, cs);
        expect(useStore.getState().combat.inCombat).toBe(true);
        expect(useStore.getState().combat.combatState).toEqual(cs);
    });

    it('clears combat state when ended', () => {
        useStore.getState().setCombat(true, { active: true, currentRound: 1, currentTurnTokenId: 1, turnOrder: [1] });
        useStore.getState().setCombat(false, null);
        expect(useStore.getState().combat.inCombat).toBe(false);
        expect(useStore.getState().combat.combatState).toBeNull();
    });
});

// ── fog of war ────────────────────────────────────────────────────────────────

describe('setFogOfWar()', () => {
    it('enables fog of war', () => {
        useStore.getState().setFogOfWar(true);
        expect(useStore.getState().fogOfWar).toBe(true);
    });
});

describe('updateRevealedCells()', () => {
    it('adds cells when revealed is true', () => {
        useStore.getState().updateRevealedCells(['1,1', '2,2'], true);
        expect(useStore.getState().revealedCells).toContain('1,1');
        expect(useStore.getState().revealedCells).toContain('2,2');
    });

    it('removes cells when revealed is false', () => {
        useStore.getState().setRevealedCells(['1,1', '2,2', '3,3']);
        useStore.getState().updateRevealedCells(['2,2'], false);
        expect(useStore.getState().revealedCells).not.toContain('2,2');
        expect(useStore.getState().revealedCells).toContain('1,1');
    });

    it('does not duplicate already-revealed cells', () => {
        useStore.getState().setRevealedCells(['1,1']);
        useStore.getState().updateRevealedCells(['1,1'], true);
        const cells = useStore.getState().revealedCells;
        expect(cells.filter((c) => c === '1,1').length).toBe(1);
    });
});

// ── journal actions ───────────────────────────────────────────────────────────

describe('upsertJournalFolder()', () => {
    it('adds a folder', () => {
        useStore.getState().upsertJournalFolder({ id: 1, name: 'Lore' });
        expect(useStore.getState().journal.folders[1]).toEqual({ id: 1, name: 'Lore' });
    });

    it('updates an existing folder by id', () => {
        useStore.getState().upsertJournalFolder({ id: 1, name: 'Lore' });
        useStore.getState().upsertJournalFolder({ id: 1, name: 'World Lore' });
        expect(useStore.getState().journal.folders[1].name).toBe('World Lore');
    });
});

describe('removeJournalFolder()', () => {
    it('deletes the folder', () => {
        useStore.getState().upsertJournalFolder({ id: 1, name: 'Lore' });
        useStore.getState().removeJournalFolder(1);
        expect(useStore.getState().journal.folders[1]).toBeUndefined();
    });

    it('unlinks entries that referenced the deleted folder', () => {
        useStore.getState().upsertJournalFolder({ id: 1, name: 'Lore' });
        useStore.getState().upsertJournalEntry({ id: 10, folderId: 1, title: 'Entry', content: '', visibility: 'all' });
        useStore.getState().removeJournalFolder(1);
        expect(useStore.getState().journal.entries[10].folderId).toBeUndefined();
    });
});

describe('upsertJournalEntry()', () => {
    it('adds an entry', () => {
        const entry = { id: 5, title: 'Session 1', content: 'We met in a tavern.', visibility: 'all' as const };
        useStore.getState().upsertJournalEntry(entry);
        expect(useStore.getState().journal.entries[5]).toEqual(entry);
    });

    it('updates an existing entry', () => {
        useStore.getState().upsertJournalEntry({ id: 5, title: 'Old', content: '', visibility: 'gm' });
        useStore.getState().upsertJournalEntry({ id: 5, title: 'New', content: 'Updated', visibility: 'all' });
        expect(useStore.getState().journal.entries[5].title).toBe('New');
    });
});

describe('removeJournalEntry()', () => {
    it('deletes the entry', () => {
        useStore.getState().upsertJournalEntry({ id: 5, title: 'Session 1', content: '', visibility: 'all' });
        useStore.getState().removeJournalEntry(5);
        expect(useStore.getState().journal.entries[5]).toBeUndefined();
    });
});

// ── connectedUsers ────────────────────────────────────────────────────────────

describe('setConnectedUsers()', () => {
    it('replaces the connected users list', () => {
        useStore.getState().setConnectedUsers([{ userId: 1, username: 'gm', role: 'gm' }]);
        expect(useStore.getState().connectedUsers).toHaveLength(1);
        expect(useStore.getState().connectedUsers[0].username).toBe('gm');
    });

    it('clears the list when passed an empty array', () => {
        useStore.getState().setConnectedUsers([{ userId: 1, username: 'gm', role: 'gm' }]);
        useStore.getState().setConnectedUsers([]);
        expect(useStore.getState().connectedUsers).toHaveLength(0);
    });
});

// ── applySessionState ─────────────────────────────────────────────────────────

describe('applySessionState()', () => {
    const minimalPayload = {
        campaignId: 42,
        activeScene: { sceneId: 1, campaignId: 42, name: 'Taberna', gridSize: 64, width: 1280, height: 960, isActive: true },
        tokens: [
            { tokenId: 1, sceneId: 1, characterId: 10, characterName: 'Kaelindra', xPosition: 96, yPosition: 96, rotation: 0, isVisible: true, isLocked: false },
        ],
        characters: [],
        connectedUsers: [{ userId: 1, username: 'gm', role: 'gm' }],
        inCombat: false,
        combatState: null,
        fogOfWar: false,
        revealedCells: [],
        allScenes: [],
        journalFolders: [],
        journalEntries: [],
    };

    it('sets the active campaign and scene ids', () => {
        useStore.getState().applySessionState(minimalPayload);
        expect(useStore.getState().ui.activeCampaignId).toBe(42);
        expect(useStore.getState().ui.activeSceneId).toBe(1);
    });

    it('normalises server token DTOs into frontend Token models', () => {
        useStore.getState().applySessionState(minimalPayload);
        const token = useStore.getState().entities.tokens[1];
        expect(token).toBeDefined();
        expect(token.x).toBe(96);
        expect(token.y).toBe(96);
        expect(token.visible).toBe(true);
    });

    it('sets connectedUsers', () => {
        useStore.getState().applySessionState(minimalPayload);
        expect(useStore.getState().connectedUsers[0].username).toBe('gm');
    });

    it('hydrates journal folders and entries from server DTOs', () => {
        useStore.getState().applySessionState({
            ...minimalPayload,
            journalFolders: [{ folderId: 1, name: 'Lore' }],
            journalEntries: [{ entryId: 10, folderId: 1, title: 'Dragons', content: 'Big ones.', visibility: 'all' }],
        });
        expect(useStore.getState().journal.folders[1].name).toBe('Lore');
        expect(useStore.getState().journal.entries[10].title).toBe('Dragons');
    });
});
