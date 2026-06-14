import { useState, useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { getWebSocketService } from '../websocket';
import { API_CONFIG } from '../config';
import MapCanvas from './MapCanvas';
import CharacterSheet from './CharacterSheet';
import Journal from './Journal';
import CharacterCreator from './CharacterCreator';
import { importCharacterFromExcel } from '../utils/excelCharacter';
import { parseRollCommand, roll, rollInitiativeD100 } from '../utils/diceRoller';
import { calcTurno, isAnimaFormat } from '../utils/animaCalc';
import type { AnimaAttributes } from '../models/character';
import type { ID } from '../store/types';

interface GameViewProps {
    onLeave: () => void;
}

export default function GameView({ onLeave }: GameViewProps) {
    const [chatInput, setChatInput] = useState('');
    const [rightTab, setRightTab] = useState<'chat' | 'sheet' | 'journal'>('chat');
    const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [showCombatSetup, setShowCombatSetup] = useState(false);
    const [combatParticipants, setCombatParticipants] = useState<Set<number>>(new Set());
    const [rolledInitiatives, setRolledInitiatives] = useState<Record<number, { rolled: number; bonus: number; total: number }>>({});
    const [showCreator, setShowCreator] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const importRef = useRef<HTMLInputElement>(null);
    const [showBgPanel, setShowBgPanel] = useState(false);
    const [bgImages, setBgImages] = useState<string[]>([]);
    const [bgUploading, setBgUploading] = useState(false);
    const [showNewScene, setShowNewScene] = useState(false);
    const [newSceneName, setNewSceneName] = useState('');
    const [browseCharId, setBrowseCharId] = useState<number | null>(null);
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
    const allScenes = useStore(useShallow((s) => Object.values(s.entities.scenes)));
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
    const unplacedCharacters = useStore(useShallow((s) => {
        const placedCharIds = new Set(Object.values(s.entities.tokens).map((t) => t.characterId));
        return Object.values(s.entities.characters).filter((c) => !placedCharIds.has(c.id));
    }));
    const ownedCharacters = useStore(useShallow((s) => {
        const uid = s.session.currentUserId;
        if (uid == null) return [];
        return Object.values(s.entities.characters).filter((c) => c.ownerUserId === uid);
    }));
    const fogOfWar = useStore((s) => s.fogOfWar);
    const revealedCells = useStore((s) => s.revealedCells);
    const [fogPaintMode, setFogPaintMode] = useState<'reveal' | 'hide' | null>(null);
    const [rulerMode, setRulerMode] = useState<'free' | 'snap' | null>(null);
    const [pingMode, setPingMode] = useState(false);
    const pings = useStore(useShallow((s) => s.pings));
    const [areaMode, setAreaMode] = useState<'circle' | 'rect' | null>(null);
    const [areaSnap, setAreaSnap] = useState<'free' | 'center' | 'corner'>('corner');
    const [areaColor, setAreaColor] = useState('#ef4444');
    const areas = useStore(useShallow((s) => s.areas));
    const AREA_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];

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

    const portraits = useStore(useShallow((s) => {
        const result: Record<number, string> = {};
        for (const c of Object.values(s.entities.characters)) {
            if (c.portraitPath) result[c.id] = c.portraitPath;
        }
        return result;
    }));

    const viewCharacterId = selectedCharacterId ?? browseCharId;

    // Auto-switch to character sheet when a token is selected
    useEffect(() => {
        if (selectedTokenId != null) setRightTab('sheet');
    }, [selectedTokenId]);

    useEffect(() => {
        if (!fogOfWar) setFogPaintMode(null);
    }, [fogOfWar]);
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

    const handleAssignOwner = (characterId: number, userId: number | null) => {
        getWebSocketService().send('ASSIGN_CHARACTER', { characterId, ownerUserId: userId });
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setImportError(null);
        try {
            const result = await importCharacterFromExcel(file);
            getWebSocketService().send('CREATE_CHARACTER', {
                name: result.name,
                type: result.type,
                attributesJson: result.attributesJson,
                biography: result.biography,
            });
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Error al leer el archivo.');
        }
    };

    const handleLeave = () => {
        getWebSocketService().send('LEAVE_CAMPAIGN', {});
        onLeave();
    };

    const openBgPanel = async () => {
        setShowBgPanel(true);
        try {
            const res = await fetch(`${API_CONFIG.baseURL}/api/uploads`);
            const urls: string[] = await res.json();
            setBgImages(urls);
        } catch {
            setBgImages([]);
        }
    };

    const applyBg = (path: string | null) => {
        if (!activeScene) return;
        getWebSocketService().send('UPDATE_SCENE', {
            sceneId: activeScene.id,
            backgroundImagePath: path,
        });
        setShowBgPanel(false);
    };

    const handleBgUpload = async (file: File) => {
        setBgUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`${API_CONFIG.baseURL}/api/uploads`, { method: 'POST', body: form });
            const data = await res.json();
            if (data.url) {
                setBgImages((prev) => [...prev, data.url]);
                applyBg(data.url);
            }
        } catch {
            // upload failed — silently ignore, panel stays open
        } finally {
            setBgUploading(false);
        }
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold">VTT</h1>
                    {allScenes.length > 0 && currentUser?.role === 'gm' ? (
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">Escena:</span>
                            <select
                                value={activeScene?.id ?? ''}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    if (id && id !== activeScene?.id) {
                                        getWebSocketService().send('CHANGE_SCENE', { sceneId: id });
                                    }
                                }}
                                className="bg-gray-700 border border-gray-600 text-blue-300 text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {allScenes.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            {showNewScene ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newSceneName}
                                        onChange={(e) => setNewSceneName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newSceneName.trim()) {
                                                getWebSocketService().send('CREATE_SCENE', { name: newSceneName.trim() });
                                                setNewSceneName('');
                                                setShowNewScene(false);
                                            } else if (e.key === 'Escape') {
                                                setNewSceneName('');
                                                setShowNewScene(false);
                                            }
                                        }}
                                        placeholder="Nombre de escena"
                                        className="bg-gray-700 border border-blue-500 text-white text-sm rounded px-2 py-1 w-36 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newSceneName.trim()) {
                                                getWebSocketService().send('CREATE_SCENE', { name: newSceneName.trim() });
                                            }
                                            setNewSceneName('');
                                            setShowNewScene(false);
                                        }}
                                        className="text-green-400 hover:text-green-300 text-sm px-1"
                                    >✓</button>
                                    <button
                                        onClick={() => { setNewSceneName(''); setShowNewScene(false); }}
                                        className="text-gray-500 hover:text-gray-300 text-sm px-1"
                                    >✕</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowNewScene(true)}
                                    className="text-gray-400 hover:text-white text-lg leading-none px-1"
                                    title="Nueva escena"
                                >+</button>
                            )}
                        </div>
                    ) : activeScene && (
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
                                onClick={() => getWebSocketService().send('TOGGLE_FOG_OF_WAR', {})}
                                className={`text-sm py-1.5 px-4 rounded-lg transition ${
                                    fogOfWar
                                        ? 'bg-indigo-700 hover:bg-indigo-600 text-white'
                                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                }`}
                            >
                                {fogOfWar ? 'Niebla ON' : 'Niebla'}
                            </button>
                            {fogOfWar && (
                                <>
                                    <button
                                        onClick={() => setFogPaintMode((m) => m === 'reveal' ? null : 'reveal')}
                                        className={`text-sm py-1.5 px-3 rounded-lg transition ${
                                            fogPaintMode === 'reveal'
                                                ? 'bg-green-700 hover:bg-green-600 text-white'
                                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                        }`}
                                        title="Revelar celdas"
                                    >
                                        Revelar
                                    </button>
                                    <button
                                        onClick={() => setFogPaintMode((m) => m === 'hide' ? null : 'hide')}
                                        className={`text-sm py-1.5 px-3 rounded-lg transition ${
                                            fogPaintMode === 'hide'
                                                ? 'bg-red-800 hover:bg-red-700 text-white'
                                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                        }`}
                                        title="Ocultar celdas"
                                    >
                                        Ocultar
                                    </button>
                                    {revealedCells.length > 0 && (
                                        <button
                                            onClick={() => getWebSocketService().send('PAINT_FOG_CELLS', { cells: revealedCells, revealed: false })}
                                            className="text-sm py-1.5 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 transition"
                                            title="Borrar todas las áreas reveladas"
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                </>
                            )}
                            <div className="relative">
                                <button
                                    onClick={openBgPanel}
                                    className="text-sm py-1.5 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition"
                                >
                                    Fondo
                                </button>
                                {showBgPanel && (
                                    <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-72">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Imagen de fondo</span>
                                            <button onClick={() => setShowBgPanel(false)} className="text-gray-400 hover:text-white text-sm">✕</button>
                                        </div>

                                        {/* Upload button */}
                                        <label className={`flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border-2 border-dashed cursor-pointer transition mb-2 text-sm ${bgUploading ? 'border-gray-600 text-gray-500 cursor-not-allowed' : 'border-blue-600 text-blue-400 hover:border-blue-400 hover:text-blue-300'}`}>
                                            {bgUploading ? 'Subiendo…' : '+ Subir imagen'}
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp,image/gif"
                                                className="hidden"
                                                disabled={bgUploading}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleBgUpload(file);
                                                }}
                                            />
                                        </label>

                                        {/* Clear button */}
                                        <button
                                            onClick={() => applyBg(null)}
                                            className="w-full text-sm py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 mb-2 transition"
                                        >
                                            Sin fondo
                                        </button>

                                        {/* Gallery */}
                                        {bgImages.length > 0 && (
                                            <>
                                                <div className="text-xs text-gray-500 mb-1">Imágenes guardadas</div>
                                                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                                                    {bgImages.map((url) => (
                                                        <button
                                                            key={url}
                                                            onClick={() => applyBg(url)}
                                                            className={`aspect-square rounded overflow-hidden border-2 transition ${activeScene?.backgroundImagePath === url ? 'border-blue-500' : 'border-transparent hover:border-gray-400'}`}
                                                        >
                                                            <img
                                                                src={`${API_CONFIG.baseURL}${url}`}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
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
                    <button
                        onClick={() => setRulerMode((m) => m === null ? 'free' : m === 'free' ? 'snap' : null)}
                        className={`text-sm py-1.5 px-3 rounded-lg transition ${
                            rulerMode === 'snap'
                                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                : rulerMode === 'free'
                                    ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                        title={rulerMode === 'snap' ? 'Regla: centro de celdas' : rulerMode === 'free' ? 'Regla: libre' : 'Regla de distancia'}
                    >
                        {rulerMode === 'snap' ? 'Regla: Celdas' : rulerMode === 'free' ? 'Regla: Libre' : 'Regla'}
                    </button>
                    <button
                        onClick={() => setPingMode((m) => !m)}
                        className={`text-sm py-1.5 px-3 rounded-lg transition ${
                            pingMode
                                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                        title="Marcar punto de atención"
                    >
                        Ping
                    </button>
                    <button
                        onClick={() => setAreaMode((m) => m === null ? 'circle' : m === 'circle' ? 'rect' : null)}
                        className={`text-sm py-1.5 px-3 rounded-lg transition ${
                            areaMode
                                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                        title={areaMode === 'circle' ? 'Área: Círculo (click → Rect)' : areaMode === 'rect' ? 'Área: Rectángulo (click → off)' : 'Herramienta de área'}
                    >
                        {areaMode === 'circle' ? '○ Área' : areaMode === 'rect' ? '□ Área' : 'Área'}
                    </button>
                    {areaMode && (
                        <div className="flex items-center gap-1.5 bg-gray-700/60 rounded-lg px-2 py-1">
                            {(['corner', 'center', 'free'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setAreaSnap(s)}
                                    className={`text-xs px-1.5 py-0.5 rounded transition ${areaSnap === s ? 'bg-gray-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                    title={s === 'corner' ? 'Esquinas de celda' : s === 'center' ? 'Centro de celda' : 'Libre'}
                                >
                                    {s === 'corner' ? '⊞' : s === 'center' ? '⊕' : '✦'}
                                </button>
                            ))}
                            <span className="w-px h-4 bg-gray-600 mx-0.5" />
                            {AREA_COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setAreaColor(c)}
                                    style={{ backgroundColor: c }}
                                    className={`w-4 h-4 rounded-full transition-transform ${areaColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-800 scale-125' : 'hover:scale-110'}`}
                                />
                            ))}
                        </div>
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
                                <li key={u.userId} className="text-sm text-gray-300 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                    {u.username}
                                    {u.role === 'gm' && (
                                        <span className="text-xs text-purple-400 font-bold">GM</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="p-4">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Tokens ({tokens.length})
                        </h2>
                        <ul className="space-y-1">
                            {tokens.map((t) => {
                                const canDragToken = currentUser?.role === 'gm' || t.ownerUserId === currentUser?.id;
                                return (
                                    <li
                                        key={t.id}
                                        draggable={canDragToken}
                                        onDragStart={canDragToken ? (e) => {
                                            e.dataTransfer.setData('text/plain', String(t.id));
                                            e.dataTransfer.effectAllowed = 'move';
                                        } : undefined}
                                        onClick={() => useStore.getState().selectToken(t.id)}
                                        className={`group flex items-center gap-1 text-sm px-2 py-1 rounded select-none transition ${
                                            t.id === selectedTokenId
                                                ? 'bg-blue-700 text-white cursor-grabbing'
                                                : t.visible
                                                    ? 'text-gray-300 hover:bg-gray-700 ' + (canDragToken ? 'cursor-grab' : 'cursor-default')
                                                    : 'text-gray-600 hover:bg-gray-700 ' + (canDragToken ? 'cursor-grab' : 'cursor-default')
                                        }`}
                                    >
                                        {currentUser?.role === 'gm' ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    getWebSocketService().send('TOKEN_VISIBILITY', { tokenId: t.id });
                                                }}
                                                className="shrink-0 text-xs leading-none w-4 text-center"
                                                title={t.visible ? 'Ocultar token' : 'Mostrar token'}
                                            >{t.visible ? '●' : '○'}</button>
                                        ) : (
                                            <span className="shrink-0 text-xs w-4 text-center">{t.visible ? '●' : '○'}</span>
                                        )}
                                        <span className="flex-1 truncate">
                                            {t.characterName ?? `Token #${t.id}`}
                                        </span>
                                        {currentUser?.role === 'gm' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    getWebSocketService().send('REMOVE_TOKEN', { tokenId: t.id });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition text-xs leading-none px-0.5"
                                                title="Eliminar token"
                                            >✕</button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    {currentUser?.role === 'gm' && (
                        <section className="p-4 border-t border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Personajes
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => importRef.current?.click()}
                                        className="text-xs text-gray-400 hover:text-gray-200"
                                        title="Importar desde Excel"
                                    >
                                        ↑ Excel
                                    </button>
                                    <button
                                        onClick={() => setShowCreator(true)}
                                        className="text-xs text-blue-400 hover:text-blue-200 font-semibold"
                                        title="Nuevo personaje"
                                    >
                                        + Nuevo
                                    </button>
                                    <input
                                        ref={importRef}
                                        type="file"
                                        accept=".xlsx,.xlsm,.xls"
                                        className="hidden"
                                        onChange={handleImportExcel}
                                    />
                                </div>
                            </div>
                            {importError && (
                                <div className="mb-2 text-xs text-red-400 bg-red-900/30 border border-red-800 rounded px-2 py-1">
                                    {importError}
                                    <button className="ml-2 underline" onClick={() => setImportError(null)}>×</button>
                                </div>
                            )}
                            {unplacedCharacters.length > 0 && (
                                <ul className="space-y-1">
                                    {unplacedCharacters.map((c) => (
                                        <li key={c.id} className="group flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition">
                                            <button
                                                className={`flex-1 truncate text-left hover:text-white transition ${viewCharacterId === c.id && rightTab === 'sheet' ? 'text-blue-300' : ''}`}
                                                onClick={() => { setBrowseCharId(c.id); setRightTab('sheet'); }}
                                                title="Ver ficha"
                                            >{c.name}</button>
                                            <button
                                                onClick={() => getWebSocketService().send('ADD_TOKEN', { characterId: c.id })}
                                                className="text-green-500 hover:text-green-300 font-bold text-base leading-none px-1"
                                                title="Colocar en escena"
                                            >+</button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`¿Eliminar a ${c.name}? Esta acción no se puede deshacer.`)) {
                                                        getWebSocketService().send('DELETE_CHARACTER', { characterId: c.id });
                                                    }
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-300 text-xs leading-none px-1 transition-opacity"
                                                title="Eliminar personaje"
                                            >✕</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                    {currentUser?.role !== 'gm' && ownedCharacters.length > 0 && (
                        <section className="p-4 border-t border-gray-700">
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                Mis personajes
                            </h2>
                            <ul className="space-y-1">
                                {ownedCharacters.map((c) => (
                                    <li key={c.id}>
                                        <button
                                            className={`w-full text-left text-sm px-2 py-1 rounded transition ${viewCharacterId === c.id && rightTab === 'sheet' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'}`}
                                            onClick={() => { setBrowseCharId(c.id); setRightTab('sheet'); }}
                                        >{c.name}</button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
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
                            currentUserId={currentUser?.id}
                            isGM={currentUser?.role === 'gm'}
                            fogOfWar={fogOfWar}
                            revealedCells={revealedCells}
                            fogPaintMode={fogPaintMode}
                            onFogCellPaint={(cells, revealed) =>
                                getWebSocketService().send('PAINT_FOG_CELLS', { cells, revealed })
                            }
                            portraits={portraits}
                            rulerMode={rulerMode ?? undefined}
                            pings={pings}
                            pingMode={pingMode}
                            onPing={(x, y) => getWebSocketService().send('PING_MAP', { x, y })}
                            areas={areas}
                            areaMode={areaMode ?? undefined}
                            areaSnap={areaSnap}
                            areaColor={areaColor}
                            onAreaCreate={(area) => getWebSocketService().send('ADD_AREA', area)}
                            onAreaRemove={(areaId) => getWebSocketService().send('REMOVE_AREA', { areaId })}
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
                            Personaje{viewCharacterId != null ? ' ●' : ''}
                        </button>
                        <button
                            onClick={() => setRightTab('journal')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition ${
                                rightTab === 'journal'
                                    ? 'text-white border-b-2 border-blue-500'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Diario
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
                        viewCharacterId != null ? (
                            <CharacterSheet
                                characterId={viewCharacterId}
                                tokenId={
                                    (selectedTokenId != null && tokens.find(t => t.id === selectedTokenId)?.characterId === viewCharacterId)
                                        ? selectedTokenId
                                        : tokens.find(t => t.characterId === viewCharacterId)?.id
                                }
                                isGM={currentUser?.role === 'gm'}
                                canEditHP={currentUser?.role === 'gm' || tokens.find(t => t.characterId === viewCharacterId)?.ownerUserId === currentUser?.id}
                                onUpdate={(charId, attrsJson) =>
                                    getWebSocketService().send('UPDATE_CHARACTER', {
                                        characterId: charId,
                                        attributesJson: attrsJson,
                                    })
                                }
                                onPortraitUpdate={(charId, path) =>
                                    getWebSocketService().send('UPDATE_PORTRAIT', {
                                        characterId: charId,
                                        portraitPath: path,
                                    })
                                }
                                onBiographyUpdate={(charId, bio) =>
                                    getWebSocketService().send('UPDATE_CHARACTER', {
                                        characterId: charId,
                                        biography: bio,
                                    })
                                }
                                onRoll={handleQuickRoll}
                                connectedUsers={connectedUsers}
                                onAssignOwner={(userId) => handleAssignOwner(viewCharacterId, userId)}
                                onAuraUpdate={(tId, auras) =>
                                    getWebSocketService().send('SET_TOKEN_AURAS', {
                                        tokenId: tId,
                                        aurasJson: JSON.stringify(auras),
                                    })
                                }
                            />
                        ) : (
                            <div className="flex items-center justify-center flex-1 text-gray-600 text-sm p-4 text-center">
                                Selecciona un token o personaje para ver su ficha
                            </div>
                        )
                    )}

                    {/* Journal panel */}
                    {rightTab === 'journal' && (
                        <Journal isGM={currentUser?.role === 'gm'} />
                    )}
                </aside>
            </div>
            {showCreator && (
                <CharacterCreator onClose={() => setShowCreator(false)} />
            )}
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
