export * from './websocket';

export {
    WebSocketService,
    getWebSocketService,
    resetWebSocketService
} from './websocket';

export * from './websocket';

export type {
    LoginCredentials,
    LoginSuccess,
    RegisterCredentials,
    RegisterSuccess,
    JoinCampaignData,
    SessionState
} from './websocket';

export const API_CONFIG = {
    baseURL: 'http://localhost:1000' //Default
};