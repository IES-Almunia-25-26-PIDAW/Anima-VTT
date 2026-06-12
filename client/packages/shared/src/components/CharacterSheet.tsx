import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { AnimaAttributes } from '../models/character';
import {
    statTotal, statMod, totalLevel,
    calcPresencia, calcCombatSkill, calcTurno, calcAcciones, isAnimaFormat,
} from '../utils/animaCalc';

interface Props {
    characterId: number;
    isGM: boolean;
    onUpdate: (characterId: number, attrsJson: string) => void;
    onRoll?: (formula: string, label: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function sign(n: number): string {
    return n >= 0 ? `+${n}` : String(n);
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mt-3 pt-2 border-t border-gray-700">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</div>
            {children}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CharacterSheet({ characterId, isGM, onUpdate, onRoll }: Props) {
    const character = useStore(s => s.entities.characters[characterId]);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<AnimaAttributes>({});

    // Local PV/Cansancio state for inline editing without spamming WS
    const [localPV, setLocalPV] = useState(0);
    const [localCan, setLocalCan] = useState(0);

    useEffect(() => {
        if (!character) return;
        const a = character.attributes as AnimaAttributes;
        setLocalPV(a.currentPV ?? a.maxPV ?? 0);
        setLocalCan(a.currentCansancio ?? a.maxCansancio ?? 0);
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

    // ── Calculated values ─────────────────────────────────────────────────────

    const a = editing ? draft : attrs;

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

    // ── HP / Fatigue commit ────────────────────────────────────────────────────

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

    // ── Draft helpers ─────────────────────────────────────────────────────────

    function setStatField(stat: string, field: 'base' | 'tmp', val: number) {
        const baseKey = `base${stat}` as keyof AnimaAttributes;
        const tmpKey = `tmp${stat}` as keyof AnimaAttributes;
        setDraft(d => ({ ...d, [field === 'base' ? baseKey : tmpKey]: val }));
    }

    function setField<K extends keyof AnimaAttributes>(key: K, val: AnimaAttributes[K]) {
        setDraft(d => ({ ...d, [key]: val }));
    }

    function handleEdit() {
        setDraft({ ...attrs });
        setEditing(true);
    }

    function handleSave() {
        onUpdate(characterId, JSON.stringify(draft));
        setEditing(false);
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
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-sm font-bold text-white">{character.name}</div>
                        <div className="text-gray-400">
                            {a.category1 ?? '—'}{lvl > 0 ? ` ${lvl}` : ''}
                            {a.category2 ? ` / ${a.category2} ${a.level2}` : ''}
                        </div>
                        <div className="text-gray-500">{a.race ?? '—'} · {a.gender === 'F' ? 'F' : 'M'}</div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                        character.type === 'PC' ? 'bg-blue-700 text-blue-100' :
                        character.type === 'NPC' ? 'bg-gray-600 text-gray-200' :
                        'bg-red-800 text-red-100'
                    }`}>{character.type}</span>
                </div>

                {/* Vitals */}
                <Section title="Vitales">
                    <div className="space-y-1.5">
                        {/* Life Points */}
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-gray-400">PV</span>
                                <div className="flex items-center gap-1">
                                    {isGM ? (
                                        <>
                                            <input
                                                type="number"
                                                value={localPV}
                                                onChange={e => setLocalPV(Number(e.target.value))}
                                                onBlur={commitHP}
                                                onKeyDown={e => e.key === 'Enter' && commitHP()}
                                                className="w-12 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs"
                                            />
                                            <span className="text-gray-500">/</span>
                                            <input
                                                type="number"
                                                value={editing ? (draft.maxPV ?? 0) : maxPV}
                                                onChange={e => editing && setField('maxPV', Number(e.target.value))}
                                                readOnly={!editing}
                                                className={`w-12 text-center rounded py-0 text-xs ${editing ? 'bg-gray-700 border border-gray-600' : 'bg-transparent text-gray-300'}`}
                                            />
                                        </>
                                    ) : (
                                        <span className="text-white font-mono">{localPV} / {maxPV}</span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full ${pvColor} rounded-full transition-all`} style={{ width: `${pvPct}%` }} />
                            </div>
                        </div>

                        {/* Fatigue */}
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-gray-400">Cansancio</span>
                                <div className="flex items-center gap-1">
                                    {isGM ? (
                                        <>
                                            <input
                                                type="number"
                                                value={localCan}
                                                onChange={e => setLocalCan(Number(e.target.value))}
                                                onBlur={commitCansancio}
                                                onKeyDown={e => e.key === 'Enter' && commitCansancio()}
                                                className="w-12 text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs"
                                            />
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
                </Section>

                {/* Primary Stats */}
                <Section title="Características">
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
                </Section>

                {/* Derived Values */}
                <Section title="Derivadas">
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
                    </div>
                </Section>

                {/* Resistances */}
                <Section title="Resistencias">
                    {editing && (
                        <div className="grid grid-cols-5 gap-1 mb-1">
                            {(['espRF', 'espRE', 'espRV', 'espRM', 'espRP'] as const).map(k => (
                                <div key={k}>
                                    <div className="text-gray-500 text-center" style={{ fontSize: 9 }}>{k.slice(3)}</div>
                                    <input type="number"
                                        value={draft[k] ?? 0}
                                        onChange={e => setField(k, Number(e.target.value))}
                                        className="w-full text-center bg-gray-700 border border-gray-600 rounded py-0 text-xs"
                                    />
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
                </Section>

                {/* Combat Skills */}
                <Section title="Habilidades de combate">
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
                                {onRoll && k !== 'LA' && (
                                    <button
                                        onClick={() => onRoll(`d100${v >= 0 ? `+${v}` : `${v}`}`, k)}
                                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-1.5 py-0.5 rounded transition font-mono"
                                        title={`Tirar d100+${k} (${v})`}
                                    >
                                        d100
                                    </button>
                                )}
                                {k === 'LA' && <span className="w-10" />}
                            </div>
                        ))}
                    </div>
                </Section>

                {/* Edit controls */}
                {isGM && (
                    <div className="mt-4 pt-3 border-t border-gray-700 flex gap-2">
                        {editing ? (
                            <>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-xs font-semibold transition"
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
                            <button
                                onClick={handleEdit}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-1.5 rounded text-xs transition"
                            >
                                Editar ficha
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
