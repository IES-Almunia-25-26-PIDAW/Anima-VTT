import { NormalizedState } from "./state";

export const initialState: NormalizedState = {
    entities: {
        users: {},
        campaigns: {},
        scenes: {},
        tokens: {},
        characters: {},
        items: {},
        assets: {},
        chatMessages: {}
    },

    ui: {
        activeCampaignId: undefined,
        activeSceneId: undefined,
        selectedTokenId: undefined,
        selectedCharacterId: undefined
    },

    session: {
        currentUserId: undefined,
        connected: false
    },

    combat: {
        inCombat: false,
        combatState: null,
    },

    connectedUsers: [],
    fogOfWar: false,
};