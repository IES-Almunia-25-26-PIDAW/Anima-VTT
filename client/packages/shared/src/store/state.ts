import {
    Campaign,
    Scene,
    Token,
    Character,
    Item,
    Asset,
    ChatMessage,
    User,
    ConnectedUser,
    JournalFolder,
    JournalEntry,
} from "../models";
import {ID} from "./types";

export interface CombatState {
    active: boolean;
    currentRound: number;
    currentTurnTokenId: ID | null;
    turnOrder: ID[];
}

export interface NormalizedState {
    entities: {
        users: Record<ID, User>;
        campaigns: Record<ID, Campaign>;
        scenes: Record<ID, Scene>;
        tokens: Record<ID, Token>;
        characters: Record<ID, Character>;
        items: Record<ID, Item>;
        assets: Record<ID, Asset>;
        chatMessages: Record<ID, ChatMessage>;
    };

    ui: {
        activeCampaignId?: ID;
        activeSceneId?: ID;
        selectedTokenId?: ID;
        selectedCharacterId?: ID;
    };

    session: {
        currentUserId?: ID;
        connected: boolean;
    };

    combat: {
        inCombat: boolean;
        combatState: CombatState | null;
    };

    connectedUsers: ConnectedUser[];
    fogOfWar: boolean;
    revealedCells: string[];
    journal: {
        folders: Record<ID, JournalFolder>;
        entries: Record<ID, JournalEntry>;
    };
    pings: MapPing[];
    areas: MapArea[];
}

export interface MapPing {
    id: string;
    x: number;
    y: number;
    username: string;
    startMs: number;
}

export interface MapArea {
    id: string;
    type: 'circle' | 'rect';
    x: number;
    y: number;
    x2: number;
    y2: number;
    color: string;
    ownerUserId: number;
    username: string;
}