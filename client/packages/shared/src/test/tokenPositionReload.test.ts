import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { initialState } from '../store/initialState';

function makeSessionPayload(tokens: Array<{ tokenId: number; xPosition: number; yPosition: number }>) {
    return {
        campaignId: 1,
        activeScene: {
            sceneId: 1,
            gridSize: 64,
            width: 2048,
            height: 2048,
            name: 'Taberna',
            isActive: true,
            backgroundImagePath: null,
            campaignId: 1,
        },
        tokens: tokens.map((t) => ({
            tokenId: t.tokenId,
            sceneId: 1,
            characterId: 1,
            characterName: 'Test',
            xPosition: t.xPosition,
            yPosition: t.yPosition,
            rotation: 0,
            isVisible: true,
            isLocked: false,
            hpOverride: null,
            statusEffectsJson: null,
            aurasJson: null,
            ownerUserId: null,
        })),
        characters: [],
        connectedUsers: [],
        inCombat: false,
        combatState: null,
        fogOfWar: false,
        revealedCells: [],
        allScenes: [],
        journalFolders: [],
        journalEntries: [],
    };
}

describe('token position after page reload', () => {
    beforeEach(() => {
        // Merge-reset: overrides all state slices without discarding actions
        useStore.setState(initialState);
    });

    it('normalizes xPosition/yPosition from SESSION_STATE into x/y', () => {
        useStore.getState().applySessionState(
            makeSessionPayload([{ tokenId: 1, xPosition: 100, yPosition: 200 }]),
        );

        const token = useStore.getState().entities.tokens[1];
        expect(token).toBeDefined();
        expect(token.x).toBe(100);
        expect(token.y).toBe(200);
    });

    it('reflects updated position when server sends correct SESSION_STATE after reload', () => {
        // 1. Initial join — token at (100, 200)
        useStore.getState().applySessionState(
            makeSessionPayload([{ tokenId: 1, xPosition: 100, yPosition: 200 }]),
        );
        expect(useStore.getState().entities.tokens[1].x).toBe(100);

        // 2. Token is dragged to a new position
        useStore.getState().moveToken(1, 608, 1056);
        expect(useStore.getState().entities.tokens[1].x).toBe(608);
        expect(useStore.getState().entities.tokens[1].y).toBe(1056);

        // 3. Page reload — store resets
        useStore.setState(initialState);
        expect(useStore.getState().entities.tokens[1]).toBeUndefined();

        // 4. Server sends SESSION_STATE with the persisted (moved) position
        useStore.getState().applySessionState(
            makeSessionPayload([{ tokenId: 1, xPosition: 608, yPosition: 1056 }]),
        );

        // 5. Token must appear at the moved position
        const token = useStore.getState().entities.tokens[1];
        expect(token).toBeDefined();
        expect(token.x).toBe(608);
        expect(token.y).toBe(1056);
    });

    it('faithfully shows whatever position the server sends — documents the server-side bug path', () => {
        // This test verifies that if the server sends the WRONG (old) position after reload,
        // the client will display the wrong position.
        // It documents the root cause of the bug: it is on the server side.
        useStore.getState().applySessionState(
            makeSessionPayload([{ tokenId: 1, xPosition: 100, yPosition: 200 }]),
        );
        useStore.getState().moveToken(1, 608, 1056);

        // Reload
        useStore.setState(initialState);

        // Server incorrectly sends the original (stale) position
        useStore.getState().applySessionState(
            makeSessionPayload([{ tokenId: 1, xPosition: 100, yPosition: 200 }]),
        );

        const token = useStore.getState().entities.tokens[1];
        // Client displays exactly what the server sent — wrong position
        expect(token.x).toBe(100);
        expect(token.y).toBe(200);
    });
});
