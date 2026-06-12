import { Component, useState } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Login, SignIn, Lobby, GameView, useStore, getWebSocketService } from '@vtt/shared';
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

    const handleLoginSuccess = (userData: LoginSuccess) => {
        const store = useStore.getState();
        store.setCurrentUser({
            id: userData.userId,
            username: userData.username,
            role: userData.role,
        });
        store.bindWebSocket(getWebSocketService());
        setCurrentView('lobby');
    };

    const handleRegisterSuccess = () => setCurrentView('login');

    const handleJoinedCampaign = () => setCurrentView('game');

    const handleLeave = () => {
        useStore.setState((s) => ({
            ui: { ...s.ui, activeCampaignId: undefined, activeSceneId: undefined, selectedTokenId: undefined },
            entities: { ...s.entities, tokens: {}, chatMessages: {} },
            connectedUsers: [],
            combat: { inCombat: false, combatState: null },
        }));
        setCurrentView('lobby');
    };

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
        return <Lobby onJoined={handleJoinedCampaign} />;
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
