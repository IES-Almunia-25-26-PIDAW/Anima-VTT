import {
    Campaign,
    Scene,
    Token,
    Character,
    Item,
    Asset,
    ChatMessage,
    User
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

    connectedUsers: string[];
    fogOfWar: boolean;
}