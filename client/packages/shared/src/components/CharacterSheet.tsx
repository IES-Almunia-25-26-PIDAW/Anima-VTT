import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { API_CONFIG } from '../config';
import { useStore } from '../store/useStore';
import type { AnimaAttributes, SkillEntry, KiStatEntry } from '../models/character';
import type { TokenAura } from '../models/token';
import type { ConnectedUser } from '../models/user';
import { exportCharacterToExcel } from '../utils/excelCharacter';
import {
    statTotal, statMod, totalLevel,
    calcPresencia, calcCombatSkill, calcSecondarySkill,
    calcTurno, calcAcciones, isAnimaFormat,
    calcMaxPDs, calcSpentPDs,
    calcKiBase, calcKiAccumBase, calcZeonBase, calcACTBase,
} from '../utils/animaCalc';

interface Props {
    characterId: number;
    tokenId?: number;
    isGM: boolean;
    canEditHP?: boolean;
    onUpdate: (characterId: number, attrsJson: string) => void;
    onPortraitUpdate?: (characterId: number, portraitPath: string) => void;
    onBiographyUpdate?: (characterId: number, biography: string) => void;
    onRoll?: (formula: string, label: string) => void;
    connectedUsers?: ConnectedUser[];
    onAssignOwner?: (userId: number | null) => void;
    onAuraUpdate?: (tokenId: number, auras: TokenAura[]) => void;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillStat = 'AGI' | 'CON' | 'DES' | 'FUE' | 'INT' | 'PER' | 'POD' | 'VOL' | null;
type KiKey = 'agi' | 'con' | 'des' | 'fue' | 'pod' | 'vol';

// ── Static data ───────────────────────────────────────────────────────────────

const STATS = [
    { key: 'AGI', label: 'AGI' },
    { key: 'CON', label: 'CON' },
    { key: 'DES', label: 'DES' },
    { key: 'FUE', label: 'FUE' },
    { key: 'INT', label: 'INT' },
    { key: 'PER', label: 'PER' },
    { key: 'POD', label: 'POD' },
    { key: 'VOL', label: 'VOL' },
] as const;

const KI_STATS: { key: KiKey; label: string; statKey: string }[] = [
    { key: 'agi', label: 'AGI', statKey: 'AGI' },
    { key: 'con', label: 'CON', statKey: 'CON' },
    { key: 'des', label: 'DES', statKey: 'DES' },
    { key: 'fue', label: 'FUE', statKey: 'FUE' },
    { key: 'pod', label: 'POD', statKey: 'POD' },
    { key: 'vol', label: 'VOL', statKey: 'VOL' },
];

const SECONDARY_SKILL_CATS: { category: string; skills: { key: string; label: string; stat: SkillStat }[] }[] = [
    {
        category: 'Atléticas',
        skills: [
            { key: 'acrobacias',  label: 'Acrobacias',  stat: 'AGI' },
            { key: 'atletismo',   label: 'Atletismo',   stat: 'AGI' },
            { key: 'montar',      label: 'Montar',      stat: 'AGI' },
            { key: 'nadar',       label: 'Nadar',       stat: 'AGI' },
            { key: 'trepar',      label: 'Trepar',      stat: 'AGI' },
            { key: 'saltar',      label: 'Saltar',      stat: 'AGI' },
            { key: 'pilotar',     label: 'Pilotar',     stat: 'DES' },
        ],
    },
    {
        category: 'Sociales',
        skills: [
            { key: 'estilo',      label: 'Estilo',      stat: null  },
            { key: 'intimidar',   label: 'Intimidar',   stat: 'VOL' },
            { key: 'liderazgo',   label: 'Liderazgo',   stat: 'VOL' },
            { key: 'persuasion',  label: 'Persuasión',  stat: 'VOL' },
            { key: 'comercio',    label: 'Comercio',    stat: 'INT' },
            { key: 'callejeo',    label: 'Callejeo',    stat: 'INT' },
            { key: 'etiqueta',    label: 'Etiqueta',    stat: null  },
        ],
    },
    {
        category: 'Perceptivas',
        skills: [
            { key: 'advertir',    label: 'Advertir',    stat: 'PER' },
            { key: 'buscar',      label: 'Buscar',      stat: 'PER' },
            { key: 'rastrear',    label: 'Rastrear',    stat: 'PER' },
        ],
    },
    {
        category: 'Intelectuales',
        skills: [
            { key: 'animales',    label: 'Animales',    stat: 'INT' },
            { key: 'ciencia',     label: 'Ciencia',     stat: 'INT' },
            { key: 'ley',         label: 'Ley',         stat: 'INT' },
            { key: 'herbolaria',  label: 'Herbolaria',  stat: 'INT' },
            { key: 'historia',    label: 'Historia',    stat: 'INT' },
            { key: 'tactica',     label: 'Táctica',     stat: 'INT' },
            { key: 'medicina',    label: 'Medicina',    stat: 'INT' },
            { key: 'memorizar',   label: 'Memorizar',   stat: 'INT' },
            { key: 'navegacion',  label: 'Navegación',  stat: 'INT' },
            { key: 'ocultismo',   label: 'Ocultismo',   stat: 'INT' },
            { key: 'tasacion',    label: 'Tasación',    stat: 'INT' },
        ],
    },
    {
        category: 'Vigor',
        skills: [
            { key: 'frialdad',         label: 'Frialdad',     stat: 'VOL' },
            { key: 'purezaFuerza',     label: 'P. Fuerza',    stat: 'FUE' },
            { key: 'resistenciaDolor', label: 'Res. Dolor',   stat: 'VOL' },
        ],
    },
    {
        category: 'Subterfugio',
        skills: [
            { key: 'cerrajeria',  label: 'Cerrajería',  stat: 'DES' },
            { key: 'disfraz',     label: 'Disfraz',     stat: 'DES' },
            { key: 'ocultarse',   label: 'Ocultarse',   stat: 'AGI' },
            { key: 'robo',        label: 'Robo',        stat: 'DES' },
            { key: 'sigilo',      label: 'Sigilo',      stat: 'AGI' },
            { key: 'tramperia',   label: 'Trampería',   stat: 'DES' },
            { key: 'venenos',     label: 'Venenos',     stat: 'INT' },
        ],
    },
    {
        category: 'Creativas',
        skills: [
            { key: 'arte',        label: 'Arte',         stat: 'DES' },
            { key: 'baile',       label: 'Baile',        stat: 'AGI' },
            { key: 'forja',       label: 'Forja',        stat: 'DES' },
            { key: 'runas',       label: 'Runas',        stat: 'INT' },
            { key: 'alquimia',    label: 'Alquimia',     stat: 'INT' },
            { key: 'animismo',    label: 'Animismo',     stat: 'INT' },
            { key: 'musica',      label: 'Música',       stat: 'DES' },
            { key: 'trucosM',     label: 'T. Manos',     stat: 'DES' },
            { key: 'calRitual',   label: 'Cal. Ritual',  stat: 'INT' },
            { key: 'orfebr',      label: 'Orfebrería',   stat: 'DES' },
            { key: 'confeccion',  label: 'Confección',   stat: 'DES' },
            { key: 'marionetas',  label: 'Marionetas',   stat: 'DES' },
        ],
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sign(n: number): string {
    return n >= 0 ? `+${n}` : String(n);
}

function numInput(
    val: number,
    onChange: (v: number) => void,
    opts?: { min?: number; max?: number; className?: string },
) {
    return (
        <input
            type="number"
            min={opts?.min ?? 0}
            max={opts?.max}
            value={val}
            onChange={e => onChange(Number(e.target.value))}
            className={opts?.className ?? 'w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs'}
        />
    );
}

function RollBtn({ total, label, onRoll }: { total: number; label: string; onRoll: (f: string, l: string) => void }) {
    const mod = total >= 0 ? `+${total}` : String(total);
    return (
        <button
            onClick={() => onRoll(`d100${mod}`, label)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-1 py-0 rounded transition font-mono leading-4"
            title={`d100${mod}`}
        >d100</button>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ label, base, tmp, editing, onChange }: {
    label: string;
    base: number;
    tmp: number;
    editing: boolean;
    onChange: (field: 'base' | 'tmp', val: number) => void;
}) {
    const total = statTotal(base, tmp);
    const mod = statMod(total);
    return (
        <tr className="border-t border-gray-700/50">
            <td className="py-0.5 pr-2 text-gray-400 font-mono text-xs">{label}</td>
            <td className="py-0.5 pr-2 text-center text-xs">
                {editing
                    ? <input type="number" min={1} max={20} value={base}
                        onChange={e => onChange('base', Number(e.target.value))}
                        className="w-10 text-center bg-gray-700 border border-gray-600 rounded text-xs py-0" />
                    : base}
            </td>
            <td className="py-0.5 pr-2 text-center text-xs">
                {editing
                    ? <input type="number" min={-10} max={10} value={tmp}
                        onChange={e => onChange('tmp', Number(e.target.value))}
                        className="w-10 text-center bg-gray-700 border border-gray-600 rounded text-xs py-0" />
                    : tmp !== 0 ? <span className="text-yellow-400">{sign(tmp)}</span> : '—'}
            </td>
            <td className="py-0.5 pr-2 text-center font-semibold text-xs">{total}</td>
            <td className={`py-0.5 text-right font-mono text-xs ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {sign(mod)}
            </td>
        </tr>
    );
}

function CollapsibleSection({ title, children, defaultOpen = true }: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="mt-3 pt-2 border-t border-gray-700">
            <button
                className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
                onClick={() => setOpen(o => !o)}
            >
                {title}
                <span className="text-gray-600 text-xs">{open ? '▾' : '▸'}</span>
            </button>
            {open && children}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CharacterSheet({ characterId, tokenId, isGM, canEditHP, onUpdate, onPortraitUpdate, onBiographyUpdate, onRoll, connectedUsers, onAssignOwner, onAuraUpdate }: Props) {
    const character = useStore(s => s.entities.characters[characterId]);
    const tokenAuras = useStore(useShallow(s => (tokenId != null ? s.entities.tokens[tokenId]?.auras : undefined) ?? []));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<AnimaAttributes>({});

    const [newAuraType, setNewAuraType] = useState<'circle' | 'rect'>('circle');
    const [newAuraSize, setNewAuraSize] = useState(1);
    const [newAuraSizeH, setNewAuraSizeH] = useState(1);
    const [newAuraColor, setNewAuraColor] = useState('#ef4444');
    const [newAuraLabel, setNewAuraLabel] = useState('');

    const [localPV, setLocalPV] = useState(0);
    const [localCan, setLocalCan] = useState(0);
    const [pvDelta, setPvDelta] = useState('');
    const [localBiography, setLocalBiography] = useState('');

    useEffect(() => {
        if (!character) return;
        const a = character.attributes as AnimaAttributes;
        setLocalPV(a.currentPV ?? a.maxPV ?? 0);
        setLocalCan(a.currentCansancio ?? a.maxCansancio ?? 0);
        setLocalBiography(character.biography ?? '');
    }, [character]);

    if (!character) {
        return (
            <div className="flex items-center justify-center flex-1 text-gray-600 text-xs p-4">
                Cargando personaje...
            </div>
        );
    }

    const attrs = character.attributes as AnimaAttributes;

    if (!isAnimaFormat(attrs as Record<string, unknown>)) {
        return (
            <div className="p-4 text-gray-500 text-xs">
                <p className="font-bold text-gray-400 mb-1">{character.name}</p>
                <p>Ficha no disponible en formato Anima.</p>
            </div>
        );
    }

    const a = editing ? draft : attrs;

    // ── Calculated values ─────────────────────────────────────────────────────

    const agiT = statTotal(a.baseAGI, a.tmpAGI);
    const conT = statTotal(a.baseCON, a.tmpCON);
    const desT = statTotal(a.baseDES, a.tmpDES);
    const fueT = statTotal(a.baseFUE, a.tmpFUE);
    const intT = statTotal(a.baseINT, a.tmpINT);
    const perT = statTotal(a.basePER, a.tmpPER);
    const podT = statTotal(a.basePOD, a.tmpPOD);
    const volT = statTotal(a.baseVOL, a.tmpVOL);

    const presencia = calcPresencia(a);
    const turno = calcTurno(a);
    const acciones = calcAcciones(a);
    const lvl = totalLevel(a);

    const rf = presencia + statMod(conT) + (a.espRF ?? 0);
    const re = presencia + statMod(conT) + (a.espRE ?? 0);
    const rv = presencia + statMod(conT) + (a.espRV ?? 0);
    const rm = presencia + statMod(podT) + (a.espRM ?? 0);
    const rp = presencia + statMod(volT) + (a.espRP ?? 0);

    const ha = calcCombatSkill(a.pdHA, a.costHA, statMod(desT), a.catBonusHA);
    const hp = calcCombatSkill(a.pdHP, a.costHP, statMod(desT), a.catBonusHP);
    const he = calcCombatSkill(a.pdHE, a.costHE, statMod(agiT), a.catBonusHE);
    const la = calcCombatSkill(a.pdLA, a.costLA, statMod(fueT), a.catBonusLA);

    const maxPV = a.maxPV ?? 0;
    const maxCan = a.maxCansancio ?? conT;

    // ── PD bar ─────────────────────────────────────────────────────────────────

    const pdSpent = editing ? calcSpentPDs(draft) : 0;
    const pdMax = editing ? calcMaxPDs(draft) : 0;
    const pdOver = pdSpent > pdMax;
    const pdPct = pdMax > 0 ? Math.min(100, (pdSpent / pdMax) * 100) : 0;
    const pdColor = pdOver ? 'bg-red-500' : pdPct > 90 ? 'bg-yellow-500' : 'bg-blue-500';

    // ── Secondary skill helper ────────────────────────────────────────────────

    function getStatMod(stat: SkillStat): number {
        if (!stat) return 0;
        const statTotals: Record<string, number> = {
            AGI: agiT, CON: conT, DES: desT, FUE: fueT,
            INT: intT, PER: perT, POD: podT, VOL: volT,
        };
        return statMod(statTotals[stat] ?? 5);
    }

    function computeSkillTotal(key: string, stat: SkillStat): number {
        const entry = a.secondarySkills?.[key];
        const sMod = getStatMod(stat);
        return calcSecondarySkill(
            entry?.pds ?? 0,
            entry?.cost ?? 2,
            sMod,
            entry?.catBonus ?? 0,
            entry?.esp ?? 0,
            !!(entry?.specialty),
        );
    }

    // ── Commit helpers ────────────────────────────────────────────────────────

    function commitHP() {
        const clamped = Math.max(0, Math.min(maxPV, localPV));
        if (clamped !== attrs.currentPV) {
            onUpdate(characterId, JSON.stringify({ ...attrs, currentPV: clamped }));
        }
    }

    function commitCansancio() {
        const clamped = Math.max(0, Math.min(maxCan, localCan));
        if (clamped !== attrs.currentCansancio) {
            onUpdate(characterId, JSON.stringify({ ...attrs, currentCansancio: clamped }));
        }
    }

    function applyDamage() {
        const amount = parseInt(pvDelta, 10);
        if (!isFinite(amount) || amount <= 0) return;
        const next = Math.max(0, localPV - amount);
        setLocalPV(next);
        setPvDelta('');
        onUpdate(characterId, JSON.stringify({ ...attrs, currentPV: next }));
    }

    function applyHeal() {
        const amount = parseInt(pvDelta, 10);
        if (!isFinite(amount) || amount <= 0) return;
        const next = Math.min(maxPV, localPV + amount);
        setLocalPV(next);
        setPvDelta('');
        onUpdate(characterId, JSON.stringify({ ...attrs, currentPV: next }));
    }

    function handleDeltaKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') applyDamage();
    }

    // ── Draft setters ─────────────────────────────────────────────────────────

    function setStatField(stat: string, field: 'base' | 'tmp', val: number) {
        const baseKey = `base${stat}` as keyof AnimaAttributes;
        const tmpKey = `tmp${stat}` as keyof AnimaAttributes;
        setDraft(d => ({ ...d, [field === 'base' ? baseKey : tmpKey]: val }));
    }

    function setField<K extends keyof AnimaAttributes>(key: K, val: AnimaAttributes[K]) {
        setDraft(d => ({ ...d, [key]: val }));
    }

    function setSkillField(key: string, field: keyof SkillEntry, val: string | number) {
        setDraft(d => ({
            ...d,
            secondarySkills: {
                ...(d.secondarySkills ?? {}),
                [key]: { ...(d.secondarySkills?.[key] ?? {}), [field]: val },
            },
        }));
    }

    function setKiField(stat: KiKey, field: keyof KiStatEntry, val: number) {
        setDraft(d => ({
            ...d,
            ki: {
                ...(d.ki ?? {}),
                [stat]: { ...(d.ki?.[stat] ?? {}), [field]: val },
            },
        }));
    }

    function setMysticField(key: keyof NonNullable<AnimaAttributes['mystic']>, val: number) {
        setDraft(d => ({ ...d, mystic: { ...(d.mystic ?? {}), [key]: val } }));
    }

    function setPsychicField(key: keyof NonNullable<AnimaAttributes['psychic']>, val: number) {
        setDraft(d => ({ ...d, psychic: { ...(d.psychic ?? {}), [key]: val } }));
    }

    function handleEdit() {
        setDraft({ ...attrs });
        setEditing(true);
    }

    function handleSave() {
        onUpdate(characterId, JSON.stringify(draft));
        setEditing(false);
    }

    function commitBiography() {
        if (!onBiographyUpdate) return;
        if (localBiography !== (character.biography ?? '')) {
            onBiographyUpdate(characterId, localBiography);
        }
    }

    async function handlePortraitUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !onPortraitUpdate) return;
        e.target.value = '';
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_CONFIG.baseURL}/api/uploads`, { method: 'POST', body: form });
        if (!res.ok) return;
        const data = await res.json();
        if (data.url) onPortraitUpdate(characterId, data.url);
    }

    // ── HP bar ────────────────────────────────────────────────────────────────

    const pvPct = maxPV > 0 ? Math.max(0, Math.min(100, (localPV / maxPV) * 100)) : 0;
    const pvColor = pvPct > 50 ? 'bg-green-500' : pvPct > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const canPct = maxCan > 0 ? Math.max(0, Math.min(100, (localCan / maxCan) * 100)) : 0;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col flex-1 overflow-y-auto text-xs">
            <div className="p-3 space-y-0.5">

                {/* Header */}
                <div className="flex items-start gap-3">
                    {/* Portrait */}
                    <div className="relative shrink-0">
                        {character.portraitPath ? (
                            <img
                                src={`${API_CONFIG.baseURL}${character.portraitPath}`}
                                alt={character.name}
                                className="w-14 h-14 rounded-full object-cover border-2 border-gray-600"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center text-xl font-bold text-gray-300">
                                {character.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        {isGM && onPortraitUpdate && (
                            <>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 w-5 h-5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center text-xs text-gray-300 hover:text-white transition"
                                    title="Cambiar retrato"
                                >✎</button>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePortraitUpload} />
                            </>
                        )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-white truncate">{character.name}</div>
                                <div className="text-gray-400">
                                    {editing
                                        ? <span className="text-yellow-400 text-xs">Editando…</span>
                                        : <>{a.category1 ?? '—'}{lvl > 0 ? ` ${lvl}` : ''}{a.category2 ? ` / ${a.category2} ${a.level2}` : ''}</>
                                    }
                                </div>
                                <div className="text-gray-500">{a.race ?? '—'} · {a.gender === 'F' ? 'F' : 'M'}{a.experience !== undefined ? ` · ${a.experience} exp` : ''}</div>
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                character.type === 'PC' ? 'bg-blue-700 text-blue-100' :
                                character.type === 'NPC' ? 'bg-gray-600 text-gray-200' :
                                'bg-red-800 text-red-100'
                            }`}>{character.type}</span>
                        </div>
                    </div>
                </div>

                {/* GM ownership assignment */}
                {isGM && connectedUsers && onAssignOwner && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 shrink-0">Jugador:</span>
                        <select
                            value={character.ownerUserId ?? ''}
                            onChange={(e) => onAssignOwner(e.target.value === '' ? null : Number(e.target.value))}
                            className="flex-1 bg-gray-700 border border-gray-600 text-xs text-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="">Sin asignar</option>
                            {connectedUsers.filter((u) => u.role === 'player').map((u) => (
                                <option key={u.userId} value={u.userId}>{u.username}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Global PD bar — only in edit mode */}
                {editing && (
                    <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700">
                        <div className="flex justify-between mb-0.5">
                            <span className="text-gray-400">PDs totales</span>
                            <span className={pdOver ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                                {pdSpent} / {pdMax}
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${pdColor} rounded-full transition-all`} style={{ width: `${pdPct}%` }} />
                        </div>
                    </div>
                )}

                {/* Vitales */}
                <CollapsibleSection title="Vitales">
                    <div className="space-y-1.5">
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-gray-400">PV</span>
                                <div className="flex items-center gap-1">
                                    {(isGM || canEditHP) ? (
                                        <>
                                            <input type="number" value={localPV}
                                                onChange={e => setLocalPV(Number(e.target.value))}
                                                onBlur={commitHP}
                                                onKeyDown={e => e.key === 'Enter' && commitHP()}
                                                className="w-12 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                            <span className="text-gray-500">/</span>
                                            <input type="number"
                                                value={editing ? (draft.maxPV ?? 0) : maxPV}
                                                onChange={e => editing && setField('maxPV', Number(e.target.value))}
                                                readOnly={!editing}
                                                className={`w-12 text-center rounded py-0 text-xs ${editing ? 'bg-gray-700 border border-gray-600' : 'bg-transparent text-gray-300'}`} />
                                        </>
                                    ) : (
                                        <span className="text-white font-mono">{localPV} / {maxPV}</span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full ${pvColor} rounded-full transition-all`} style={{ width: `${pvPct}%` }} />
                            </div>
                            {(isGM || canEditHP) && (
                                <div className="flex items-center gap-1 mt-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        placeholder="Δ"
                                        value={pvDelta}
                                        onChange={e => setPvDelta(e.target.value)}
                                        onKeyDown={handleDeltaKey}
                                        className="w-14 text-center bg-gray-700 border border-gray-600 rounded py-0.5 text-xs placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                    />
                                    <button
                                        onClick={applyDamage}
                                        disabled={!pvDelta || parseInt(pvDelta, 10) <= 0}
                                        className="flex-1 text-xs py-0.5 px-1 rounded bg-red-800 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-red-100 transition"
                                    >
                                        Daño
                                    </button>
                                    <button
                                        onClick={applyHeal}
                                        disabled={!pvDelta || parseInt(pvDelta, 10) <= 0}
                                        className="flex-1 text-xs py-0.5 px-1 rounded bg-green-800 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-green-100 transition"
                                    >
                                        Curar
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-gray-400">Cansancio</span>
                                <div className="flex items-center gap-1">
                                    {isGM ? (
                                        <>
                                            <input type="number" value={localCan}
                                                onChange={e => setLocalCan(Number(e.target.value))}
                                                onBlur={commitCansancio}
                                                onKeyDown={e => e.key === 'Enter' && commitCansancio()}
                                                className="w-12 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                            <span className="text-gray-500">/</span>
                                            <span className="text-gray-300 w-8 text-center">{maxCan}</span>
                                        </>
                                    ) : (
                                        <span className="text-white font-mono">{localCan} / {maxCan}</span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${canPct}%` }} />
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Primary Stats */}
                <CollapsibleSection title="Características">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left text-gray-500 font-normal pb-0.5 text-xs"></th>
                                <th className="text-center text-gray-500 font-normal pb-0.5 text-xs">Base</th>
                                <th className="text-center text-gray-500 font-normal pb-0.5 text-xs">Tmp</th>
                                <th className="text-center text-gray-500 font-normal pb-0.5 text-xs">Tot</th>
                                <th className="text-right text-gray-500 font-normal pb-0.5 text-xs">Bon</th>
                            </tr>
                        </thead>
                        <tbody>
                            {STATS.map(({ key, label }) => {
                                const baseKey = `base${key}` as keyof AnimaAttributes;
                                const tmpKey = `tmp${key}` as keyof AnimaAttributes;
                                return (
                                    <StatRow
                                        key={key}
                                        label={label}
                                        base={Number(a[baseKey] ?? 5)}
                                        tmp={Number(a[tmpKey] ?? 0)}
                                        editing={editing}
                                        onChange={(field, val) => setStatField(key, field, val)}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </CollapsibleSection>

                {/* Derived Values */}
                <CollapsibleSection title="Derivadas">
                    {editing && (
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            {[
                                { k: 'category1' as const, label: 'Categoría 1' },
                                { k: 'level1' as const, label: 'Nivel 1' },
                                { k: 'category2' as const, label: 'Categoría 2' },
                                { k: 'level2' as const, label: 'Nivel 2' },
                            ].map(({ k, label }) => (
                                <div key={k}>
                                    <div className="text-gray-500 mb-0.5" style={{ fontSize: 9 }}>{label}</div>
                                    <input
                                        type={k.startsWith('level') ? 'number' : 'text'}
                                        min={0}
                                        value={String(draft[k] ?? '')}
                                        onChange={e => setField(k, k.startsWith('level') ? Number(e.target.value) as any : e.target.value as any)}
                                        className="w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs"
                                    />
                                </div>
                            ))}
                            <div>
                                <div className="text-gray-500 mb-0.5" style={{ fontSize: 9 }}>Exp.</div>
                                {numInput(draft.experience ?? 0, v => setField('experience', v), { className: 'w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs' })}
                            </div>
                            <div>
                                <div className="text-gray-500 mb-0.5" style={{ fontSize: 9 }}>Gnosis</div>
                                {numInput(draft.gnosis ?? 10, v => setField('gnosis', v), { min: 10, className: 'w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs' })}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Presencia</span>
                            <span className="font-mono text-white">{presencia}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Turno</span>
                            <span className={`font-mono ${turno >= 0 ? 'text-green-400' : 'text-red-400'}`}>{sign(turno)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Acciones</span>
                            <span className="font-mono text-white">{acciones}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Nivel</span>
                            <span className="font-mono text-white">{lvl}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Gnosis</span>
                            <span className="font-mono text-white">{a.gnosis ?? 10}</span>
                        </div>
                        {a.experience !== undefined && (
                            <div className="flex justify-between">
                                <span className="text-gray-400">Exp.</span>
                                <span className="font-mono text-white">{a.experience}</span>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

                {/* Resistances */}
                <CollapsibleSection title="Resistencias">
                    {editing && (
                        <div className="grid grid-cols-5 gap-1 mb-2">
                            {(['espRF', 'espRE', 'espRV', 'espRM', 'espRP'] as const).map(k => (
                                <div key={k}>
                                    <div className="text-gray-500 text-center" style={{ fontSize: 9 }}>{k.slice(3)}</div>
                                    <input type="number"
                                        value={draft[k] ?? 0}
                                        onChange={e => setField(k, Number(e.target.value))}
                                        className="w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                        {[['RF', rf], ['RE', re], ['RV', rv]].map(([k, v]) => (
                            <div key={k as string} className="flex justify-between">
                                <span className="text-gray-400">{k}</span>
                                <span className="font-mono text-cyan-300">{v}</span>
                            </div>
                        ))}
                        {[['RM', rm], ['RP', rp]].map(([k, v]) => (
                            <div key={k as string} className="flex justify-between">
                                <span className="text-gray-400">{k}</span>
                                <span className="font-mono text-cyan-300">{v}</span>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                {/* Combat Skills */}
                <CollapsibleSection title="Habilidades de combate">
                    {editing && (
                        <div className="space-y-1 mb-2">
                            {[
                                { label: 'HA', pdK: 'pdHA', costK: 'costHA', catK: 'catBonusHA' },
                                { label: 'HP', pdK: 'pdHP', costK: 'costHP', catK: 'catBonusHP' },
                                { label: 'HE', pdK: 'pdHE', costK: 'costHE', catK: 'catBonusHE' },
                                { label: 'LA', pdK: 'pdLA', costK: 'costLA', catK: 'catBonusLA' },
                            ].map(({ label, pdK, costK, catK }) => (
                                <div key={label} className="grid grid-cols-4 gap-1 items-center">
                                    <span className="text-gray-400">{label}</span>
                                    <div>
                                        <div className="text-gray-500 text-center" style={{ fontSize: 9 }}>PDs</div>
                                        <input type="number" min={0} value={draft[pdK as keyof AnimaAttributes] as number ?? 0}
                                            onChange={e => setField(pdK as keyof AnimaAttributes, Number(e.target.value))}
                                            className="w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                    </div>
                                    <div>
                                        <div className="text-gray-500 text-center" style={{ fontSize: 9 }}>Coste</div>
                                        <input type="number" min={1} value={draft[costK as keyof AnimaAttributes] as number ?? 10}
                                            onChange={e => setField(costK as keyof AnimaAttributes, Number(e.target.value))}
                                            className="w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                    </div>
                                    <div>
                                        <div className="text-gray-500 text-center" style={{ fontSize: 9 }}>BonCat</div>
                                        <input type="number" min={0} value={draft[catK as keyof AnimaAttributes] as number ?? 0}
                                            onChange={e => setField(catK as keyof AnimaAttributes, Number(e.target.value))}
                                            className="w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="space-y-0.5">
                        {([['HA', ha], ['HP', hp], ['HE', he], ['LA', la]] as [string, number][]).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between">
                                <span className="text-gray-400 w-8">{k}</span>
                                <span className="font-mono text-amber-300 font-semibold flex-1 text-right mr-2">{v}</span>
                                {onRoll && k !== 'LA' && <RollBtn total={v} label={k} onRoll={onRoll} />}
                                {k === 'LA' && <span className="w-10" />}
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>

                {/* Secondary Skills */}
                <CollapsibleSection title="Habilidades secundarias" defaultOpen={false}>
                    {SECONDARY_SKILL_CATS.map(({ category, skills }) => (
                        <div key={category} className="mb-2">
                            <div className="text-gray-500 uppercase tracking-wider mb-0.5" style={{ fontSize: 9 }}>{category}</div>
                            {skills.map(({ key, label, stat }) => {
                                const total = computeSkillTotal(key, stat);
                                const entry = a.secondarySkills?.[key];
                                const trained = Math.floor((entry?.pds ?? 0) / Math.max(1, entry?.cost ?? 2)) >= 5;
                                return (
                                    <div key={key}>
                                        <div className="flex items-center gap-1 py-0.5">
                                            <span className="text-gray-300 flex-1 truncate">{label}</span>
                                            {stat && <span className="text-gray-600" style={{ fontSize: 9 }}>{stat}</span>}
                                            {onRoll && <RollBtn total={total} label={label} onRoll={onRoll} />}
                                            <span className={`font-mono w-8 text-right text-xs ${
                                                trained ? 'text-amber-300 font-semibold' : 'text-gray-500'
                                            }`}>{total}</span>
                                        </div>
                                        {editing && (
                                            <div className="flex items-center gap-1 pb-0.5 pl-1">
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>PDs</span>
                                                <input type="number" min={0}
                                                    value={draft.secondarySkills?.[key]?.pds ?? 0}
                                                    onChange={e => setSkillField(key, 'pds', Number(e.target.value))}
                                                    className="w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>Cst</span>
                                                <input type="number" min={1}
                                                    value={draft.secondarySkills?.[key]?.cost ?? 2}
                                                    onChange={e => setSkillField(key, 'cost', Number(e.target.value))}
                                                    className="w-7 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>Cat</span>
                                                <input type="number"
                                                    value={draft.secondarySkills?.[key]?.catBonus ?? 0}
                                                    onChange={e => setSkillField(key, 'catBonus', Number(e.target.value))}
                                                    className="w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>Esp</span>
                                                <input type="number"
                                                    value={draft.secondarySkills?.[key]?.esp ?? 0}
                                                    onChange={e => setSkillField(key, 'esp', Number(e.target.value))}
                                                    className="w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                                <input type="text" placeholder="Especialidad"
                                                    value={draft.secondarySkills?.[key]?.specialty ?? ''}
                                                    onChange={e => setSkillField(key, 'specialty', e.target.value)}
                                                    className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded py-0 px-1 text-xs text-gray-300" />
                                            </div>
                                        )}
                                        {!editing && entry?.specialty && (
                                            <div className="text-yellow-600 pl-1" style={{ fontSize: 9 }}>★ {entry.specialty}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </CollapsibleSection>

                {/* Ki */}
                <CollapsibleSection title="Ki" defaultOpen={false}>
                    <table className="w-full">
                        <thead>
                            <tr className="text-gray-500" style={{ fontSize: 9 }}>
                                <th className="text-left font-normal">Stat</th>
                                <th className="text-center font-normal">Base Ki</th>
                                {editing && <th className="text-center font-normal">PDs Ki</th>}
                                <th className="text-center font-normal">Tot Ki</th>
                                <th className="text-center font-normal">Base Ac</th>
                                {editing && <th className="text-center font-normal">PDs Ac</th>}
                                <th className="text-center font-normal">Tot Ac</th>
                            </tr>
                        </thead>
                        <tbody>
                            {KI_STATS.map(({ key, label, statKey }) => {
                                const st = statTotal(
                                    Number(a[`base${statKey}` as keyof AnimaAttributes] ?? 5),
                                    Number(a[`tmp${statKey}` as keyof AnimaAttributes] ?? 0),
                                );
                                const entry = a.ki?.[key];
                                const kiBase = calcKiBase(st);
                                const accumBase = calcKiAccumBase(st);
                                const kiCost = entry?.cost ?? 20;
                                const totalKi = kiBase + Math.floor((entry?.pds ?? 0) / Math.max(1, kiCost)) + (entry?.esp ?? 0);
                                const accumCost = entry?.accumCost ?? 25;
                                const totalAccum = Math.max(0, accumBase + Math.floor((entry?.accumPds ?? 0) / Math.max(1, accumCost)) + (entry?.accumEsp ?? 0));
                                return (
                                    <tr key={key} className="border-t border-gray-700/50">
                                        <td className="py-0.5 text-gray-400 font-mono text-xs">{label}</td>
                                        <td className="py-0.5 text-center text-xs text-gray-300">{kiBase}</td>
                                        {editing && (
                                            <td className="py-0.5 text-center">
                                                <input type="number" min={0}
                                                    value={draft.ki?.[key]?.pds ?? 0}
                                                    onChange={e => setKiField(key, 'pds', Number(e.target.value))}
                                                    className="w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                            </td>
                                        )}
                                        <td className="py-0.5 text-center font-mono text-xs text-purple-300 font-semibold">{totalKi}</td>
                                        <td className="py-0.5 text-center text-xs text-gray-300">{accumBase}</td>
                                        {editing && (
                                            <td className="py-0.5 text-center">
                                                <input type="number" min={0}
                                                    value={draft.ki?.[key]?.accumPds ?? 0}
                                                    onChange={e => setKiField(key, 'accumPds', Number(e.target.value))}
                                                    className="w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                            </td>
                                        )}
                                        <td className="py-0.5 text-center font-mono text-xs text-purple-300">{totalAccum}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {editing && (
                        <div className="mt-1 text-gray-600" style={{ fontSize: 9 }}>
                            Costes por defecto: Ki 20 PDs/punto · Acum 25 PDs/punto. Edita en Ki tab para costes personalizados.
                        </div>
                    )}
                </CollapsibleSection>

                {/* Mystic */}
                <CollapsibleSection title="Místico" defaultOpen={false}>
                    {(() => {
                        const m = a.mystic ?? {};
                        const zeonBase = calcZeonBase(podT);
                        const actBase = calcACTBase(podT);
                        const desBonus = statMod(desT);
                        const podBonus = statMod(podT);
                        const volBonus = statMod(volT);

                        const zeonTotal = zeonBase + (m.catBonusZeon ?? 0) + Math.floor((m.pdZeon ?? 0) / Math.max(1, m.costZeon ?? 2)) * 5 + (m.espZeon ?? 0);
                        const actTotal = Math.max(0, actBase + Math.floor((m.pdACT ?? 0) / Math.max(1, m.costACT ?? 2)) + (m.espACT ?? 0));
                        const proyMagTotal = desBonus + Math.floor((m.pdProyMag ?? 0) / Math.max(1, m.costProyMag ?? 2)) * 5 + (m.espProyMag ?? 0);
                        const convocarTotal = podBonus + Math.floor((m.pdConvocar ?? 0) / Math.max(1, m.costConvocar ?? 2)) * 5 + (m.espConvocar ?? 0);
                        const atarTotal = podBonus + Math.floor((m.pdAtar ?? 0) / Math.max(1, m.costAtar ?? 2)) * 5 + (m.espAtar ?? 0);
                        const desconvocarTotal = podBonus + Math.floor((m.pdDesconvocar ?? 0) / Math.max(1, m.costDesconvocar ?? 2)) * 5 + (m.espDesconvocar ?? 0);
                        const controlarTotal = volBonus + Math.floor((m.pdControlar ?? 0) / Math.max(1, m.costControlar ?? 2)) * 5 + (m.espControlar ?? 0);

                        const rows: { label: string; total: number; pdKey: keyof NonNullable<AnimaAttributes['mystic']>; espKey: keyof NonNullable<AnimaAttributes['mystic']>; base?: number }[] = [
                            { label: 'Zeón', total: zeonTotal, pdKey: 'pdZeon', espKey: 'espZeon', base: zeonBase },
                            { label: 'ACT', total: actTotal, pdKey: 'pdACT', espKey: 'espACT', base: actBase },
                            { label: 'Proy. Mágica', total: proyMagTotal, pdKey: 'pdProyMag', espKey: 'espProyMag', base: desBonus },
                            { label: 'Convocar', total: convocarTotal, pdKey: 'pdConvocar', espKey: 'espConvocar', base: podBonus },
                            { label: 'Controlar', total: controlarTotal, pdKey: 'pdControlar', espKey: 'espControlar', base: volBonus },
                            { label: 'Atar', total: atarTotal, pdKey: 'pdAtar', espKey: 'espAtar', base: podBonus },
                            { label: 'Desconvocar', total: desconvocarTotal, pdKey: 'pdDesconvocar', espKey: 'espDesconvocar', base: podBonus },
                        ];

                        return (
                            <div className="space-y-0.5">
                                {rows.map(({ label, total, pdKey, espKey, base }) => (
                                    <div key={label}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400 flex-1">{label}</span>
                                            {base !== undefined && <span className="text-gray-600 mr-2" style={{ fontSize: 9 }}>base {base}</span>}
                                            <span className={`font-mono text-xs font-semibold ${total > 0 ? 'text-violet-300' : 'text-gray-500'}`}>{total}</span>
                                        </div>
                                        {editing && (
                                            <div className="flex items-center gap-1 pb-0.5 pl-1">
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>PDs</span>
                                                <input type="number" min={0}
                                                    value={(draft.mystic?.[pdKey] as number) ?? 0}
                                                    onChange={e => setMysticField(pdKey, Number(e.target.value))}
                                                    className="w-10 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>Esp</span>
                                                <input type="number"
                                                    value={(draft.mystic?.[espKey] as number) ?? 0}
                                                    onChange={e => setMysticField(espKey, Number(e.target.value))}
                                                    className="w-10 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {editing && (
                                    <div className="mt-1">
                                        <div className="text-gray-600 mb-0.5" style={{ fontSize: 9 }}>Bonus categoría Zeón</div>
                                        <input type="number"
                                            value={draft.mystic?.catBonusZeon ?? 0}
                                            onChange={e => setMysticField('catBonusZeon', Number(e.target.value))}
                                            className="w-16 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </CollapsibleSection>

                {/* Psychic */}
                <CollapsibleSection title="Psíquico" defaultOpen={false}>
                    {(() => {
                        const p = a.psychic ?? {};
                        const desBonus = statMod(desT);

                        const cvTotal = Math.floor((p.pdCV ?? 0) / Math.max(1, p.costCV ?? 2)) + (p.catBonusCV ?? 0) + (p.espCV ?? 0);
                        const proyPsiTotal = desBonus + Math.floor((p.pdProyPsi ?? 0) / Math.max(1, p.costProyPsi ?? 2)) * 5 + (p.espProyPsi ?? 0);

                        return (
                            <div className="space-y-0.5">
                                {[
                                    { label: 'CV', total: cvTotal, pdKey: 'pdCV' as const, espKey: 'espCV' as const, catKey: 'catBonusCV' as const },
                                    { label: 'Proy. Psíquica', total: proyPsiTotal, pdKey: 'pdProyPsi' as const, espKey: 'espProyPsi' as const, catKey: null },
                                ].map(({ label, total, pdKey, espKey, catKey }) => (
                                    <div key={label}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400 flex-1">{label}</span>
                                            {label === 'Proy. Psíquica' && <span className="text-gray-600 mr-2" style={{ fontSize: 9 }}>base {desBonus}</span>}
                                            <span className={`font-mono text-xs font-semibold ${total > 0 ? 'text-pink-300' : 'text-gray-500'}`}>{total}</span>
                                        </div>
                                        {editing && (
                                            <div className="flex items-center gap-1 pb-0.5 pl-1">
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>PDs</span>
                                                <input type="number" min={0}
                                                    value={(draft.psychic?.[pdKey] as number) ?? 0}
                                                    onChange={e => setPsychicField(pdKey, Number(e.target.value))}
                                                    className="w-10 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                                {catKey && (
                                                    <>
                                                        <span className="text-gray-600" style={{ fontSize: 9 }}>Cat</span>
                                                        <input type="number"
                                                            value={(draft.psychic?.[catKey] as number) ?? 0}
                                                            onChange={e => setPsychicField(catKey, Number(e.target.value))}
                                                            className="w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                                    </>
                                                )}
                                                <span className="text-gray-600" style={{ fontSize: 9 }}>Esp</span>
                                                <input type="number"
                                                    value={(draft.psychic?.[espKey] as number) ?? 0}
                                                    onChange={e => setPsychicField(espKey, Number(e.target.value))}
                                                    className="w-8 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </CollapsibleSection>

                {/* Auras (GM only, only when a token is selected) */}
                {isGM && tokenId != null && onAuraUpdate && (
                    <CollapsibleSection title="Auras" defaultOpen={false}>
                        {tokenAuras.length > 0 ? (
                            <div className="space-y-0.5 mb-2">
                                {tokenAuras.map(aura => (
                                    <div key={aura.id} className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded-sm shrink-0 border border-gray-600" style={{ background: aura.color }} />
                                        <span className="text-gray-400 text-xs shrink-0">{aura.type === 'circle' ? '○' : '□'} {aura.size}{aura.sizeH && aura.sizeH !== aura.size ? `×${aura.sizeH}` : ''} cel</span>
                                        {aura.label && <span className="text-gray-500 flex-1 truncate text-xs">{aura.label}</span>}
                                        <button
                                            onClick={() => onAuraUpdate(tokenId, tokenAuras.filter(a => a.id !== aura.id))}
                                            className="text-gray-600 hover:text-red-400 text-xs ml-auto transition leading-none"
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600 text-xs italic mb-2">Sin auras.</p>
                        )}
                        <div className="space-y-1 pt-1 border-t border-gray-700/50">
                            <div className="flex gap-1">
                                <select value={newAuraType} onChange={e => setNewAuraType(e.target.value as 'circle' | 'rect')}
                                    className="flex-1 bg-gray-700 border border-gray-600 rounded py-0 text-xs text-gray-200 focus:outline-none">
                                    <option value="circle">○ Círculo</option>
                                    <option value="rect">□ Rectángulo</option>
                                </select>
                                <input type="color" value={newAuraColor} onChange={e => setNewAuraColor(e.target.value)}
                                    className="w-7 h-5 rounded cursor-pointer border border-gray-600 p-0 bg-gray-700" />
                            </div>
                            <div className="flex gap-1 items-center">
                                <span className="text-gray-500 text-xs shrink-0">{newAuraType === 'circle' ? 'Radio' : 'Ancho'}</span>
                                <input type="number" min={0.5} step={0.5} value={newAuraSize}
                                    onChange={e => setNewAuraSize(Number(e.target.value))}
                                    className="w-12 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                {newAuraType === 'rect' && (
                                    <>
                                        <span className="text-gray-500 text-xs shrink-0">Alto</span>
                                        <input type="number" min={0.5} step={0.5} value={newAuraSizeH}
                                            onChange={e => setNewAuraSizeH(Number(e.target.value))}
                                            className="w-12 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs" />
                                    </>
                                )}
                                <span className="text-gray-500 text-xs shrink-0">cel</span>
                            </div>
                            <div className="flex gap-1">
                                <input type="text" placeholder="Etiqueta (opcional)" value={newAuraLabel}
                                    onChange={e => setNewAuraLabel(e.target.value)}
                                    className="flex-1 bg-gray-700 border border-gray-600 rounded py-0 px-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none" />
                                <button
                                    onClick={() => {
                                        if (newAuraSize <= 0) return;
                                        const aura: TokenAura = {
                                            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                                            type: newAuraType,
                                            size: newAuraSize,
                                            ...(newAuraType === 'rect' && newAuraSizeH !== newAuraSize ? { sizeH: newAuraSizeH } : {}),
                                            color: newAuraColor,
                                            ...(newAuraLabel.trim() ? { label: newAuraLabel.trim() } : {}),
                                        };
                                        onAuraUpdate(tokenId, [...tokenAuras, aura]);
                                        setNewAuraLabel('');
                                    }}
                                    className="bg-blue-700 hover:bg-blue-600 text-white text-xs px-2 py-0.5 rounded transition"
                                >+ Añadir</button>
                            </div>
                        </div>
                    </CollapsibleSection>
                )}

                {/* Notes */}
                <CollapsibleSection title="Notas" defaultOpen={false}>
                    {editing ? (
                        <textarea
                            value={draft.notes ?? ''}
                            onChange={e => setField('notes', e.target.value)}
                            rows={4}
                            className="w-full bg-gray-700 border border-gray-600 rounded p-1.5 text-xs text-gray-300 resize-y"
                            placeholder="Notas del personaje…"
                        />
                    ) : (
                        <p className="text-gray-400 whitespace-pre-wrap" style={{ fontSize: 11 }}>
                            {a.notes || <span className="italic text-gray-600">Sin notas.</span>}
                        </p>
                    )}
                </CollapsibleSection>

                {/* Biografía */}
                {(character.biography || isGM) && (
                    <CollapsibleSection title="Biografía" defaultOpen={false}>
                        {isGM && onBiographyUpdate ? (
                            <textarea
                                value={localBiography}
                                onChange={e => setLocalBiography(e.target.value)}
                                onBlur={commitBiography}
                                rows={5}
                                className="w-full bg-gray-700 border border-gray-600 rounded p-1.5 text-xs text-gray-300 resize-y focus:outline-none focus:border-blue-500"
                                placeholder="Historia, descripción, notas del personaje…"
                            />
                        ) : (
                            <p className="text-gray-400 whitespace-pre-wrap" style={{ fontSize: 11 }}>
                                {character.biography || <span className="italic text-gray-600">Sin biografía.</span>}
                            </p>
                        )}
                    </CollapsibleSection>
                )}

                {/* Edit controls */}
                {isGM && (
                    <div className="mt-4 pt-3 border-t border-gray-700 flex gap-2">
                        {editing ? (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={pdOver}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-1.5 rounded text-xs font-semibold transition"
                                    title={pdOver ? `PDs excedidos (${pdSpent} > ${pdMax})` : undefined}
                                >
                                    Guardar
                                </button>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1.5 rounded text-xs transition"
                                >
                                    Cancelar
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleEdit}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-1.5 rounded text-xs transition"
                                >
                                    Editar ficha
                                </button>
                                <button
                                    onClick={() => exportCharacterToExcel({
                                        name: character.name,
                                        type: character.type,
                                        biography: character.biography,
                                        attributes: attrs,
                                    })}
                                    className="bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 px-2 py-1.5 rounded text-xs transition"
                                    title="Exportar a Excel"
                                >
                                    ↓ Excel
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
