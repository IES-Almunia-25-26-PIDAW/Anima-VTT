import { useState, useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { getWebSocketService } from '../websocket';
import MapCanvas from './MapCanvas';
import CharacterSheet from './CharacterSheet';
import { parseRollCommand, roll, rollInitiativeD100 } from '../utils/diceRoller';
import { calcTurno, isAnimaFormat } from '../utils/animaCalc';
import type { AnimaAttributes } from '../models/character';
import type { ID } from '../store/types';

interface GameViewProps {
    onLeave: () => void;
}

export default function GameView({ onLeave }: GameViewProps) {
    const [chatInput, setChatInput] = useState('');
    const [rightTab, setRightTab] = useState<'chat' | 'sheet'>('chat');
    const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [showCombatSetup, setShowCombatSetup] = useState(false);
    const [combatParticipants, setCombatParticipants] = useState<Set<number>>(new Set());
    const [rolledInitiatives, setRolledInitiatives] = useState<Record<number, { rolled: number; bonus: number; total: number }>>({});
    const lastReorderedAsalto = useRef(0);
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
    const selectedCharacterId = useStore((s) => {
        const tokenId = s.ui.selectedTokenId;
        if (tokenId == null) return null;
        return s.entities.tokens[tokenId]?.characterId ?? null;
    });
    const combat = useStore((s) => s.combat);
    const characters = useStore((s) => s.entities.characters);

    const hpMap = useMemo(() => {
        const result: Record<number, [number, number]> = {};
        for (const t of tokens) {
            if (t.characterId == null) continue;
            const attrs = characters[t.characterId]?.attributes as AnimaAttributes | undefined;
            const max = attrs?.maxPV ?? 0;
            if (max <= 0) continue;
            result[t.id] = [attrs?.currentPV ?? max, max];
        }
        return result;
    }, [tokens, characters]);

    // Auto-switch to character sheet when a token is selected
    useEffect(() => {
        setRightTab(selectedTokenId != null ? 'sheet' : 'chat');
    }, [selectedTokenId]);
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

        const rollResult = parseRollCommand(msg);
        if (rollResult) {
            getWebSocketService().send('DICE_ROLL', rollResult);
            setChatInput('');
            return;
        }

        getWebSocketService().send('CHAT_MESSAGE', { message: msg });
        setChatInput('');
    };

    const handleQuickRoll = (formula: string, label: string) => {
        const result = roll(formula);
        if (!result) return;
        getWebSocketService().send('DICE_ROLL', {
            formula: `${label}: ${result.formula}`,
            result: result.result,
            details: result.details,
        });
    };

    const handleChatKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSendChat();
    };

    function getTokenTurno(tokenId: ID): number {
        const token = tokens.find((t) => t.id === tokenId);
        if (!token?.characterId) return 0;
        const char = characters[token.characterId];
        if (!char?.attributes || !isAnimaFormat(char.attributes)) return 0;
        return calcTurno(char.attributes as AnimaAttributes);
    }

    function buildInitiatives(tokenIds: number[]): Record<number, { rolled: number; bonus: number; total: number }> {
        const result: Record<number, { rolled: number; bonus: number; total: number }> = {};
        for (const id of tokenIds) {
            const bonus = getTokenTurno(id);
            const rolled = rollInitiativeD100();
            result[id] = { bonus, rolled, total: rolled + bonus };
        }
        return result;
    }

    const handleOpenCombatSetup = () => {
        setCombatParticipants(new Set(tokens.map((t) => t.id as number)));
        setShowCombatSetup(true);
    };

    const handleConfirmCombat = () => {
        const ids = [...combatParticipants];
        const initiatives = buildInitiatives(ids);
        setRolledInitiatives(initiatives);
        lastReorderedAsalto.current = 1;
        const sorted = ids.slice().sort((a, b) => initiatives[b].total - initiatives[a].total);
        getWebSocketService().send('START_COMBAT', { tokenIds: sorted });
        setShowCombatSetup(false);
    };

    const handleNextTurn = () => getWebSocketService().send('NEXT_TURN', {});

    const handleEndCombat = () => {
        getWebSocketService().send('END_COMBAT', {});
        setRolledInitiatives({});
        lastReorderedAsalto.current = 0;
    };

    // Reroll initiative whenever currentRound increments (GM only).
    // Uses Zustand subscribe (fires synchronously on store change, old+new state provided)
    // instead of useEffect+dep to avoid React scheduling / stale-closure issues.
    useEffect(() => {
        const unsub = useStore.subscribe((state, prevState) => {
            const round = state.combat.combatState?.currentRound;
            const prevRound = prevState.combat.combatState?.currentRound;
            if (!round || round === prevRound || round <= 1) return;
            if (round <= lastReorderedAsalto.current) return;

            const uid = state.session.currentUserId;
            if (uid == null || state.entities.users[uid]?.role !== 'gm') return;

            lastReorderedAsalto.current = round;

            const tokenIds = (state.combat.combatState?.turnOrder ?? []) as number[];
            const allTokens = Object.values(state.entities.tokens);

            const initiatives: Record<number, { rolled: number; bonus: number; total: number }> = {};
            for (const id of tokenIds) {
                const token = allTokens.find((t) => t.id === id);
                const char = token?.characterId != null ? state.entities.characters[token.characterId] : null;
                const bonus =
                    char?.attributes && isAnimaFormat(char.attributes)
                        ? calcTurno(char.attributes as AnimaAttributes)
                        : 0;
                const rolled = rollInitiativeD100();
                initiatives[id] = { bonus, rolled, total: rolled + bonus };
            }

            setRolledInitiatives(initiatives);
            const sorted = tokenIds.slice().sort((a, b) => initiatives[b].total - initiatives[a].total);
            getWebSocketService().send('REORDER_COMBAT', { tokenIds: sorted });
        });
        return unsub;
    }, []);

    useEffect(() => {
        const ws = getWebSocketService();
        ws.on('SESSION_SAVED', () => {
            setSaveFeedback('saved');
            setTimeout(() => setSaveFeedback('idle'), 2000);
        });
        return () => ws.off('SESSION_SAVED');
    }, []);

    const handleSave = () => {
        setSaveFeedback('saving');
        getWebSocketService().send('SAVE_SESSION', {});
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
                            COMBATE — Asalto {combat.combatState?.currentRound}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {currentUser?.role === 'gm' && (
                        <>
                            {!combat.inCombat ? (
                                <button
                                    onClick={handleOpenCombatSetup}
                                    disabled={tokens.length === 0}
                                    className="text-sm py-1.5 px-4 rounded-lg bg-red-800 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition"
                                >
                                    Iniciar Combate
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleNextTurn}
                                        className="text-sm py-1.5 px-4 rounded-lg bg-amber-700 hover:bg-amber-600 text-white transition"
                                    >
                                        Siguiente Turno
                                    </button>
                                    <button
                                        onClick={handleEndCombat}
                                        className="text-sm py-1.5 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition"
                                    >
                                        Fin Combate
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saveFeedback !== 'idle'}
                                className={`text-sm py-1.5 px-4 rounded-lg transition ${
                                    saveFeedback === 'saved'
                                        ? 'bg-green-700 text-green-100 cursor-default'
                                        : saveFeedback === 'saving'
                                            ? 'bg-gray-600 text-gray-400 cursor-default'
                                            : 'bg-gray-700 hover:bg-gray-600 text-white'
                                }`}
                            >
                                {saveFeedback === 'saved' ? 'Guardado ✓' : saveFeedback === 'saving' ? 'Guardando…' : 'Guardar'}
                            </button>
                        </>
                    )}
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
                                    {t.visible ? '●' : '○'} {t.characterName ?? `Token #${t.id}`}
                                </li>
                            ))}
                        </ul>
                    </section>
                    {combat.inCombat && combat.combatState && (
                        <section className="p-4 border-t border-gray-700">
                            <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">
                                Asalto {combat.combatState.currentRound}
                            </h2>
                            <ul className="space-y-1">
                                {combat.combatState.turnOrder.map((tokenId, i) => {
                                    const token = tokens.find((t) => t.id === tokenId);
                                    const isCurrent = tokenId === combat.combatState!.currentTurnTokenId;
                                    const init = rolledInitiatives[tokenId as number];
                                    return (
                                        <li
                                            key={tokenId}
                                            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                                isCurrent
                                                    ? 'bg-red-900 text-white font-semibold'
                                                    : 'text-gray-500'
                                            }`}
                                        >
                                            <span className="text-gray-600 w-3 shrink-0">{i + 1}.</span>
                                            {isCurrent && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                                            )}
                                            <span className="truncate flex-1">
                                                {token?.characterName ?? `Token #${tokenId}`}
                                            </span>
                                            {init && (
                                                <span className={`font-mono shrink-0 ${isCurrent ? 'text-red-300' : 'text-gray-600'}`}>
                                                    {init.rolled}{init.bonus >= 0 ? '+' : ''}{init.bonus}
                                                    <span className={isCurrent ? 'text-white' : 'text-gray-400'}>
                                                        ={init.total}
                                                    </span>
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </aside>

                {/* Main area: map canvas */}
                <main className="flex-1 bg-gray-950 relative overflow-hidden">
                    {activeScene ? (
                        <MapCanvas
                            scene={activeScene}
                            tokens={tokens}
                            selectedTokenId={selectedTokenId as number | undefined}
                            currentTurnTokenId={combat.combatState?.currentTurnTokenId as number | undefined}
                            onTokenSelect={(id) => useStore.getState().selectToken(id)}
                            onTokenMove={(tokenId, x, y) =>
                                getWebSocketService().send('TOKEN_MOVE', { tokenId, x, y })
                            }
                            hpMap={hpMap}
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

                {/* Right panel: Chat / Character Sheet tabs */}
                <aside className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col shrink-0">
                    {/* Tab bar */}
                    <div className="flex border-b border-gray-700 shrink-0">
                        <button
                            onClick={() => setRightTab('chat')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition ${
                                rightTab === 'chat'
                                    ? 'text-white border-b-2 border-blue-500'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => setRightTab('sheet')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition ${
                                rightTab === 'sheet'
                                    ? 'text-white border-b-2 border-blue-500'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Personaje{selectedTokenId != null ? ' ●' : ''}
                        </button>
                    </div>

                    {/* Chat panel */}
                    {rightTab === 'chat' && (
                        <>
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
                                        placeholder="Mensaje o /roll 1d100+50"
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
                        </>
                    )}

                    {/* Character Sheet panel */}
                    {rightTab === 'sheet' && (
                        selectedCharacterId != null ? (
                            <CharacterSheet
                                characterId={selectedCharacterId}
                                isGM={currentUser?.role === 'gm'}
                                onUpdate={(charId, attrsJson) =>
                                    getWebSocketService().send('UPDATE_CHARACTER', {
                                        characterId: charId,
                                        attributesJson: attrsJson,
                                    })
                                }
                                onRoll={handleQuickRoll}
                            />
                        ) : (
                            <div className="flex items-center justify-center flex-1 text-gray-600 text-sm p-4 text-center">
                                Selecciona un token para ver su ficha
                            </div>
                        )
                    )}
                </aside>
            </div>
            {showCombatSetup && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-80 shadow-2xl">
                        <h3 className="text-white font-bold text-base mb-1">Iniciar Combate</h3>
                        <p className="text-gray-400 text-xs mb-4">Selecciona los participantes. El orden se calculará por Turno (AGI+DES).</p>
                        <ul className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                            {tokens.map((t) => {
                                const turno = getTokenTurno(t.id);
                                const sign = turno >= 0 ? '+' : '';
                                return (
                                    <li key={t.id} className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id={`cp-${t.id}`}
                                            checked={combatParticipants.has(t.id as number)}
                                            onChange={(e) => {
                                                setCombatParticipants((prev) => {
                                                    const next = new Set(prev);
                                                    if (e.target.checked) next.add(t.id as number);
                                                    else next.delete(t.id as number);
                                                    return next;
                                                });
                                            }}
                                            className="w-4 h-4 accent-red-500 shrink-0"
                                        />
                                        <label htmlFor={`cp-${t.id}`} className="text-sm text-gray-200 flex-1 cursor-pointer truncate">
                                            {t.characterName ?? `Token #${t.id}`}
                                        </label>
                                        <span className="text-xs text-gray-500 font-mono shrink-0">
                                            {sign}{turno}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCombatSetup(false)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmCombat}
                                disabled={combatParticipants.size === 0}
                                className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg transition text-sm font-semibold"
                            >
                                Iniciar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
