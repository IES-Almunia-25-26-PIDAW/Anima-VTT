import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { getWebSocketService } from '../websocket';
import MapCanvas from './MapCanvas';

interface GameViewProps {
    onLeave: () => void;
}

export default function GameView({ onLeave }: GameViewProps) {
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const currentUser = useStore((s) => {
        const id = s.session.currentUserId;
        return id != null ? s.entities.users[id] : null;
    });
    const activeScene = useStore((s) => {
        const id = s.ui.activeSceneId;
        return id != null ? s.entities.scenes[id] : null;
    });
    const tokens = useStore(useShallow((s) => Object.values(s.entities.tokens)));
    const connectedUsers = useStore((s) => s.connectedUsers);
    const selectedTokenId = useStore((s) => s.ui.selectedTokenId);
    const combat = useStore((s) => s.combat);
    const chatMessages = useStore(
        useShallow((s) =>
            Object.values(s.entities.chatMessages).sort((a, b) =>
                a.timestamp < b.timestamp ? -1 : 1
            )
        )
    );

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages.length]);

    const handleSendChat = () => {
        const msg = chatInput.trim();
        if (!msg) return;
        getWebSocketService().send('CHAT_MESSAGE', { message: msg });
        setChatInput('');
    };

    const handleChatKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSendChat();
    };

    const handleLeave = () => {
        getWebSocketService().send('LEAVE_CAMPAIGN', {});
        onLeave();
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold">VTT</h1>
                    {activeScene && (
                        <span className="text-gray-400 text-sm">
                            Escena: <span className="text-blue-400 font-medium">{activeScene.name}</span>
                        </span>
                    )}
                    {combat.inCombat && (
                        <span className="bg-red-700 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
                            COMBATE — Ronda {combat.combatState?.currentRound}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {currentUser && (
                        <span className="text-gray-400 text-sm">
                            {currentUser.username}
                            <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${currentUser.role === 'gm' ? 'bg-purple-700 text-purple-100' : 'bg-blue-700 text-blue-100'}`}>
                                {currentUser.role.toUpperCase()}
                            </span>
                        </span>
                    )}
                    <button
                        onClick={handleLeave}
                        className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 px-4 rounded-lg transition"
                    >
                        Salir
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left panel: users + tokens */}
                <aside className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 overflow-y-auto">
                    <section className="p-4 border-b border-gray-700">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Conectados ({connectedUsers.length})
                        </h2>
                        <ul className="space-y-1.5">
                            {connectedUsers.map((u) => (
                                <li key={u} className="text-sm text-gray-300 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                    {u}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="p-4">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Tokens ({tokens.length})
                        </h2>
                        <ul className="space-y-1">
                            {tokens.map((t) => (
                                <li
                                    key={t.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', String(t.id));
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onClick={() => useStore.getState().selectToken(t.id)}
                                    className={`text-sm px-2 py-1 rounded select-none transition ${
                                        t.id === selectedTokenId
                                            ? 'bg-blue-700 text-white cursor-grabbing'
                                            : t.visible
                                                ? 'text-gray-300 hover:bg-gray-700 cursor-grab'
                                                : 'text-gray-600 hover:bg-gray-700 cursor-grab'
                                    }`}
                                >
                                    {t.visible ? '●' : '○'} Token #{t.id}
                                </li>
                            ))}
                        </ul>
                    </section>
                </aside>

                {/* Main area: map canvas */}
                <main className="flex-1 bg-gray-950 relative overflow-hidden">
                    {activeScene ? (
                        <MapCanvas
                            scene={activeScene}
                            tokens={tokens}
                            selectedTokenId={selectedTokenId as number | undefined}
                            onTokenSelect={(id) => useStore.getState().selectToken(id)}
                            onTokenMove={(tokenId, x, y) =>
                                getWebSocketService().send('TOKEN_MOVE', { tokenId, x, y })
                            }
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-gray-600 select-none">
                            <div>
                                <div className="text-6xl mb-4">🎲</div>
                                <p className="text-gray-500">Sin escena activa</p>
                            </div>
                        </div>
                    )}
                </main>

                {/* Right panel: chat */}
                <aside className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col shrink-0">
                    <div className="px-4 py-3 border-b border-gray-700 shrink-0">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chat</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                        {chatMessages.length === 0 ? (
                            <p className="text-gray-600 text-sm italic">Sin mensajes</p>
                        ) : (
                            chatMessages.map((msg) => {
                                const sender = msg.data?.username ?? `User ${msg.userId}`;
                                if (msg.messageType === 'system') {
                                    return (
                                        <div key={msg.id} className="text-xs text-gray-500 italic text-center py-1">
                                            {msg.message}
                                        </div>
                                    );
                                }
                                if (msg.messageType === 'roll') {
                                    return (
                                        <div key={msg.id} className="bg-yellow-900/30 border border-yellow-800/50 rounded px-2 py-1.5">
                                            <span className="text-yellow-400 text-xs font-semibold">{sender} </span>
                                            <span className="text-yellow-300 text-sm">{msg.message}</span>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={msg.id} className="text-sm">
                                        <span className="font-semibold text-blue-400">{sender}: </span>
                                        <span className="text-gray-200">{msg.message}</span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 border-t border-gray-700 shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleChatKey}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleSendChat}
                                disabled={!chatInput.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm transition"
                            >
                                ➤
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
