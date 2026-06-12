import { create } from 'zustand';
import { NormalizedState, CombatState } from './state';
import { initialState } from './initialState';
import type { Token, Scene, Character, CharacterType, ChatMessage, User } from '../models';
import type { WebSocketService } from '../websocket';
import type { ID } from './types';

type Actions = {
    // Session
    setConnected: (value: boolean) => void;
    setCurrentUser: (user: User) => void;

    // Campaign / scene
    setActiveCampaign: (id: ID) => void;
    setActiveScene: (id: ID) => void;
    upsertScene: (scene: Scene) => void;

    // Tokens
    upsertToken: (token: Token) => void;
    moveToken: (id: ID, x: number, y: number) => void;
    rotateToken: (id: ID, rotation: number) => void;
    setTokenVisibility: (id: ID, visible: boolean) => void;
    selectToken: (id: ID | undefined) => void;

    // Characters
    upsertCharacter: (character: Character) => void;

    // Chat
    addChatMessage: (message: ChatMessage) => void;

    // Combat
    setCombat: (inCombat: boolean, combatState: CombatState | null) => void;

    // Connected users
    setConnectedUsers: (users: string[]) => void;

    // Batch updates from server payloads
    applySessionState: (payload: any) => void;
    applySceneChanged: (payload: any) => void;

    // Wire WebSocket events to store actions
    bindWebSocket: (ws: WebSocketService) => void;
};

// Server TokenState DTO → frontend Token model
function normalizeToken(t: any): Token {
    return {
        id: t.tokenId,
        sceneId: t.sceneId,
        characterId: t.characterId,
        characterName: t.characterName ?? 'Desconocido',
        x: t.xPosition,
        y: t.yPosition,
        rotation: t.rotation ?? 0,
        visible: t.isVisible ?? true,
        locked: t.isLocked ?? false,
        hpOverride: t.hpOverride ?? undefined,
        statusEffects: t.statusEffectsJson ? JSON.parse(t.statusEffectsJson) : [],
    };
}

// Server CharacterState DTO → frontend Character model
function normalizeCharacter(c: any, campaignId: ID): Character {
    return {
        id: c.characterId,
        campaignId,
        name: c.name,
        type: c.type as CharacterType,
        attributes: c.attributesJson ? JSON.parse(c.attributesJson) : {},
        biography: c.biography ?? undefined,
        portraitPath: undefined,
        tokenIds: [],
        itemIds: [],
    };
}

// Server SceneState DTO → frontend Scene model
function normalizeScene(s: any, tokenIds: ID[]): Scene {
    return {
        id: s.sceneId,
        campaignId: s.campaignId,
        name: s.name,
        backgroundImagePath: s.backgroundImagePath,
        gridSize: s.gridSize,
        width: s.width,
        height: s.height,
        isActive: s.isActive,
        tokenIds,
    };
}

function buildTokensRecord(rawTokens: any[]): Record<ID, Token> {
    const record: Record<ID, Token> = {};
    rawTokens.forEach((t) => {
        const token = normalizeToken(t);
        record[token.id] = token;
    });
    return record;
}

export const useStore = create<NormalizedState & Actions>((set, get) => ({
    ...initialState,

    setConnected: (value) =>
        set((s) => ({ session: { ...s.session, connected: value } })),

    setCurrentUser: (user) =>
        set((s) => ({
            entities: { ...s.entities, users: { ...s.entities.users, [user.id]: user } },
            session: { ...s.session, currentUserId: user.id },
        })),

    setActiveCampaign: (id) =>
        set((s) => ({ ui: { ...s.ui, activeCampaignId: id } })),

    setActiveScene: (id) =>
        set((s) => ({ ui: { ...s.ui, activeSceneId: id } })),

    upsertScene: (scene) =>
        set((s) => ({
            entities: { ...s.entities, scenes: { ...s.entities.scenes, [scene.id]: scene } },
        })),

    upsertToken: (token) =>
        set((s) => ({
            entities: { ...s.entities, tokens: { ...s.entities.tokens, [token.id]: token } },
        })),

    moveToken: (id, x, y) =>
        set((s) => {
            const token = s.entities.tokens[id];
            if (!token) return {};
            return {
                entities: {
                    ...s.entities,
                    tokens: { ...s.entities.tokens, [id]: { ...token, x, y } },
                },
            };
        }),

    rotateToken: (id, rotation) =>
        set((s) => {
            const token = s.entities.tokens[id];
            if (!token) return {};
            return {
                entities: {
                    ...s.entities,
                    tokens: { ...s.entities.tokens, [id]: { ...token, rotation } },
                },
            };
        }),

    setTokenVisibility: (id, visible) =>
        set((s) => {
            const token = s.entities.tokens[id];
            if (!token) return {};
            return {
                entities: {
                    ...s.entities,
                    tokens: { ...s.entities.tokens, [id]: { ...token, visible } },
                },
            };
        }),

    selectToken: (id) =>
        set((s) => ({ ui: { ...s.ui, selectedTokenId: id } })),

    upsertCharacter: (character) =>
        set((s) => ({
            entities: { ...s.entities, characters: { ...s.entities.characters, [character.id]: character } },
        })),

    addChatMessage: (message) =>
        set((s) => ({
            entities: { ...s.entities, chatMessages: { ...s.entities.chatMessages, [message.id]: message } },
        })),

    setCombat: (inCombat, combatState) =>
        set(() => ({ combat: { inCombat, combatState } })),

    setConnectedUsers: (users) =>
        set(() => ({ connectedUsers: users })),

    applySessionState: (payload) => {
        const { campaignId, activeScene, tokens, characters, connectedUsers, inCombat, combatState, fogOfWar } = payload;

        const tokensRecord = buildTokensRecord(tokens ?? []);

        const scenesRecord: Record<ID, Scene> = {};
        if (activeScene) {
            const scene = normalizeScene(activeScene, Object.keys(tokensRecord).map(Number));
            scenesRecord[scene.id] = scene;
        }

        const charsRecord: Record<ID, Character> = {};
        for (const c of (characters ?? [])) {
            const char = normalizeCharacter(c, campaignId);
            charsRecord[char.id] = char;
        }

        set((s) => ({
            entities: {
                ...s.entities,
                tokens: tokensRecord,
                scenes: { ...s.entities.scenes, ...scenesRecord },
                characters: charsRecord,
            },
            ui: {
                ...s.ui,
                activeCampaignId: campaignId,
                activeSceneId: activeScene?.sceneId,
            },
            combat: { inCombat: inCombat ?? false, combatState: combatState ?? null },
            connectedUsers: connectedUsers ?? [],
            fogOfWar: fogOfWar ?? false,
        }));
    },

    applySceneChanged: (payload) => {
        const { activeScene, tokens } = payload;

        const tokensRecord = buildTokensRecord(tokens ?? []);
        const scene = normalizeScene(activeScene, Object.keys(tokensRecord).map(Number));

        set((s) => ({
            entities: {
                ...s.entities,
                tokens: tokensRecord,
                scenes: { ...s.entities.scenes, [scene.id]: scene },
            },
            ui: {
                ...s.ui,
                activeSceneId: scene.id,
                selectedTokenId: undefined,
            },
        }));
    },

    bindWebSocket: (ws) => {
        ws.on('SESSION_STATE', (payload) => {
            get().applySessionState(payload);
        });

        ws.on('TOKEN_MOVED', (payload) => {
            get().moveToken(payload.tokenId, payload.x, payload.y);
        });

        ws.on('TOKEN_ROTATED', (payload) => {
            get().rotateToken(payload.tokenId, payload.rotation);
        });

        ws.on('TOKEN_VISIBILITY_CHANGED', (payload) => {
            get().setTokenVisibility(payload.tokenId, payload.isVisible);
        });

        ws.on('SCENE_CHANGED', (payload) => {
            get().applySceneChanged(payload);
        });

        ws.on('COMBAT_STARTED', (payload) => {
            get().setCombat(true, payload.combatState);
        });

        ws.on('TURN_CHANGED', (payload) => {
            get().setCombat(true, payload.combatState);
        });

        ws.on('COMBAT_ENDED', () => {
            get().setCombat(false, null);
        });

        ws.on('CHAT_MESSAGE', (payload) => {
            const campaignId = get().ui.activeCampaignId;
            if (campaignId == null) return;
            get().addChatMessage({
                id: Date.now(),
                campaignId,
                userId: payload.userId,
                message: payload.message,
                messageType: 'chat',
                data: { username: payload.username },
                timestamp: payload.timestamp,
            });
        });

        ws.on('DICE_ROLLED', (payload) => {
            const campaignId = get().ui.activeCampaignId;
            if (campaignId == null) return;
            const { roll } = payload;
            get().addChatMessage({
                id: Date.now(),
                campaignId,
                userId: roll.userId,
                message: `${roll.formula} → ${roll.details}`,
                messageType: 'roll',
                data: { username: roll.username, roll },
                timestamp: roll.timestamp,
            });
        });

        ws.on('USER_JOINED', (payload) => {
            get().setConnectedUsers(payload.connectedUsers);
        });

        ws.on('USER_LEFT', (payload) => {
            const updated = get().connectedUsers.filter((u) => u !== payload.username);
            get().setConnectedUsers(updated);
        });

        ws.on('CHARACTER_UPDATED', (payload) => {
            const existing = get().entities.characters[payload.characterId];
            if (!existing) return;
            get().upsertCharacter({
                ...existing,
                attributes: JSON.parse(payload.attributesJson),
            });
        });
    },
}));
