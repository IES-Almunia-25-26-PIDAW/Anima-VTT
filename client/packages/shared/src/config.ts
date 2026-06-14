// Derive server URLs from wherever the browser loaded the page so that
// cross-machine play, Tailscale, and public tunnels all work without config.
//
// Three scenarios:
//  • Vite dev server  (port 5173)  → Spring Boot is on the same host at :1000
//  • Spring Boot direct (port 1000) → same origin
//  • Tunnel via HTTPS  (no port)   → same origin but switch to wss://
const _loc = typeof window !== 'undefined' ? window.location : null;
const _host = _loc?.hostname ?? 'localhost';
const _port = _loc?.port ?? '1000';
const _proto = _loc?.protocol ?? 'http:';

const _devMode = _port === '5173';
const _serverOrigin = _devMode
    ? `http://${_host}:1000`
    : `${_proto}//${_host}${_port ? `:${_port}` : ''}`;
const _wsOrigin = _devMode
    ? `ws://${_host}:1000`
    : `${_proto === 'https:' ? 'wss:' : 'ws:'}//${_host}${_port ? `:${_port}` : ''}`;

export const API_CONFIG = {
    baseURL: import.meta.env.VITE_API_URL || _serverOrigin,
    wsURL: import.meta.env.VITE_WS_URL || `${_wsOrigin}/game`,
};

const AUTH_KEY = 'vtt_user';

export interface PersistedUser {
    userId: number;
    username: string;
    role: 'gm' | 'player';
    campaignId?: number;
}

export function savePersistedUser(user: PersistedUser) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function loadPersistedUser(): PersistedUser | null {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        return raw ? (JSON.parse(raw) as PersistedUser) : null;
    } catch {
        return null;
    }
}

export function clearPersistedUser() {
    localStorage.removeItem(AUTH_KEY);
}
