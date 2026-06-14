import { Component, useState, useEffect } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Login, SignIn, Lobby, GameView, useStore, getWebSocketService, resetWebSocketService } from '@vtt/shared';
import { API_CONFIG, savePersistedUser, loadPersistedUser, clearPersistedUser } from '@vtt/shared';
import type { LoginSuccess } from '@vtt/shared';

// ── Error boundary ────────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            const err = this.state.error as Error;
            return (
                <div style={{ padding: 32, fontFamily: 'monospace', background: '#1a1a1a', color: '#f87171', minHeight: '100vh' }}>
                    <h1 style={{ fontSize: 20, marginBottom: 16 }}>Render error</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{err.message}</pre>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#9ca3af', marginTop: 16 }}>{err.stack}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── App ───────────────────────────────────────────────────────────────────────

type ViewType = 'login' | 'signin' | 'lobby' | 'game';

function App() {
    const [currentView, setCurrentView] = useState<ViewType>('login');
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        const saved = loadPersistedUser();
        if (!saved) {
            setCheckingAuth(false);
            return;
        }

        const ws = getWebSocketService(API_CONFIG.wsURL);
        ws.connect()
            .then(() => {
                const store = useStore.getState();
                store.setCurrentUser({ id: saved.userId, username: saved.username, role: saved.role });
                store.bindWebSocket(ws);

                if (saved.campaignId != null) {
                    ws.joinCampaign({ campaignId: saved.campaignId, userId: saved.userId });
                    setCurrentView('game');
                } else {
                    setCurrentView('lobby');
                }
            })
            .catch(() => {
                clearPersistedUser();
                resetWebSocketService();
            })
            .finally(() => setCheckingAuth(false));
    }, []);

    const handleLoginSuccess = (userData: LoginSuccess) => {
        savePersistedUser({ userId: userData.userId, username: userData.username, role: userData.role });
        const store = useStore.getState();
        store.setCurrentUser({ id: userData.userId, username: userData.username, role: userData.role });
        store.bindWebSocket(getWebSocketService());
        setCurrentView('lobby');
    };

    const handleRegisterSuccess = () => setCurrentView('login');

    const handleJoinedCampaign = () => {
        const campaignId = useStore.getState().ui.activeCampaignId;
        if (campaignId != null) {
            const current = loadPersistedUser();
            if (current) savePersistedUser({ ...current, campaignId });
        }
        setCurrentView('game');
    };

    const handleLeave = () => {
        const current = loadPersistedUser();
        if (current) savePersistedUser({ ...current, campaignId: undefined });
        useStore.setState((s) => ({
            ui: { ...s.ui, activeCampaignId: undefined, activeSceneId: undefined, selectedTokenId: undefined },
            entities: { ...s.entities, tokens: {}, chatMessages: {} },
            connectedUsers: [],
            combat: { inCombat: false, combatState: null },
        }));
        setCurrentView('lobby');
    };

    const handleLogout = () => {
        clearPersistedUser();
        resetWebSocketService();
        useStore.setState((s) => ({
            session: { ...s.session, currentUserId: undefined },
            ui: { ...s.ui, activeCampaignId: undefined, activeSceneId: undefined, selectedTokenId: undefined },
            entities: { ...s.entities, tokens: {}, chatMessages: {}, users: {} },
            connectedUsers: [],
            combat: { inCombat: false, combatState: null },
        }));
        setCurrentView('login');
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-300">Conectando...</p>
                </div>
            </div>
        );
    }

    if (currentView === 'signin') {
        return (
            <SignIn
                onBackToLogin={() => setCurrentView('login')}
                onRegisterSuccess={handleRegisterSuccess}
            />
        );
    }

    if (currentView === 'login') {
        return (
            <Login
                onLoginSuccess={handleLoginSuccess}
                onGoToSignIn={() => setCurrentView('signin')}
            />
        );
    }

    if (currentView === 'lobby') {
        return <Lobby onJoined={handleJoinedCampaign} onLogout={handleLogout} />;
    }

    return <GameView onLeave={handleLeave} />;
}

export default function AppWithBoundary() {
    return (
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    );
}
