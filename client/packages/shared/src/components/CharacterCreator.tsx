import { useState, useRef } from 'react';
import { getWebSocketService } from '../websocket';
import { API_CONFIG } from '../config';
import type { AnimaAttributes, CharacterType, KiStatEntry } from '../models/character';

interface Props {
    onClose: () => void;
}

const STATS = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL'] as const;
type Stat = typeof STATS[number];

const COMBAT_SKILLS = ['HA', 'HP', 'HE', 'LA'] as const;
type Skill = typeof COMBAT_SKILLS[number];

const SKILL_LABELS: Record<Skill, string> = {
    HA: 'Ataque', HP: 'Parada', HE: 'Esquiva', LA: 'Llevar Armadura',
};

type KiKey = 'agi' | 'con' | 'des' | 'fue' | 'pod' | 'vol';
const KI_STATS: { key: KiKey; label: string }[] = [
    { key: 'agi', label: 'AGI' }, { key: 'con', label: 'CON' },
    { key: 'des', label: 'DES' }, { key: 'fue', label: 'FUE' },
    { key: 'pod', label: 'POD' }, { key: 'vol', label: 'VOL' },
];

const MYSTIC_FIELDS = ['pdZeon', 'pdACT', 'pdProyMag', 'pdConvocar', 'pdAtar', 'pdDesconvocar', 'pdControlar'] as const;
type MysticField = typeof MYSTIC_FIELDS[number];
const MYSTIC_LABELS: Record<MysticField, string> = {
    pdZeon: 'Zeón', pdACT: 'ACT', pdProyMag: 'Proy. Mágica',
    pdConvocar: 'Convocar', pdAtar: 'Atar', pdDesconvocar: 'Desconvocar', pdControlar: 'Controlar',
};

type SkillStat = 'AGI' | 'CON' | 'DES' | 'FUE' | 'INT' | 'PER' | 'POD' | 'VOL' | null;
const SECONDARY_SKILL_CATS: { category: string; skills: { key: string; label: string; stat: SkillStat }[] }[] = [
    {
        category: 'Atléticas',
        skills: [
            { key: 'acrobacias', label: 'Acrobacias', stat: 'AGI' },
            { key: 'atletismo',  label: 'Atletismo',  stat: 'AGI' },
            { key: 'montar',     label: 'Montar',     stat: 'AGI' },
            { key: 'nadar',      label: 'Nadar',      stat: 'AGI' },
            { key: 'trepar',     label: 'Trepar',     stat: 'AGI' },
            { key: 'saltar',     label: 'Saltar',     stat: 'AGI' },
            { key: 'pilotar',    label: 'Pilotar',    stat: 'DES' },
        ],
    },
    {
        category: 'Sociales',
        skills: [
            { key: 'estilo',     label: 'Estilo',     stat: null  },
            { key: 'intimidar',  label: 'Intimidar',  stat: 'VOL' },
            { key: 'liderazgo',  label: 'Liderazgo',  stat: 'VOL' },
            { key: 'persuasion', label: 'Persuasión', stat: 'VOL' },
            { key: 'comercio',   label: 'Comercio',   stat: 'INT' },
            { key: 'callejeo',   label: 'Callejeo',   stat: 'INT' },
            { key: 'etiqueta',   label: 'Etiqueta',   stat: null  },
        ],
    },
    {
        category: 'Perceptivas',
        skills: [
            { key: 'advertir',   label: 'Advertir',   stat: 'PER' },
            { key: 'buscar',     label: 'Buscar',     stat: 'PER' },
            { key: 'rastrear',   label: 'Rastrear',   stat: 'PER' },
        ],
    },
    {
        category: 'Intelectuales',
        skills: [
            { key: 'animales',   label: 'Animales',   stat: 'INT' },
            { key: 'ciencia',    label: 'Ciencia',    stat: 'INT' },
            { key: 'ley',        label: 'Ley',        stat: 'INT' },
            { key: 'herbolaria', label: 'Herbolaria', stat: 'INT' },
            { key: 'historia',   label: 'Historia',   stat: 'INT' },
            { key: 'tactica',    label: 'Táctica',    stat: 'INT' },
            { key: 'medicina',   label: 'Medicina',   stat: 'INT' },
            { key: 'memorizar',  label: 'Memorizar',  stat: 'INT' },
            { key: 'navegacion', label: 'Navegación', stat: 'INT' },
            { key: 'ocultismo',  label: 'Ocultismo',  stat: 'INT' },
            { key: 'tasacion',   label: 'Tasación',   stat: 'INT' },
        ],
    },
    {
        category: 'Vigor',
        skills: [
            { key: 'frialdad',          label: 'Frialdad',    stat: 'VOL' },
            { key: 'purezaFuerza',      label: 'P. Fuerza',   stat: 'FUE' },
            { key: 'resistenciaDolor',  label: 'Res. Dolor',  stat: 'VOL' },
        ],
    },
    {
        category: 'Subterfugio',
        skills: [
            { key: 'cerrajeria', label: 'Cerrajería', stat: 'DES' },
            { key: 'disfraz',    label: 'Disfraz',    stat: 'DES' },
            { key: 'ocultarse',  label: 'Ocultarse',  stat: 'AGI' },
            { key: 'robo',       label: 'Robo',       stat: 'DES' },
            { key: 'sigilo',     label: 'Sigilo',     stat: 'AGI' },
            { key: 'tramperia',  label: 'Trampería',  stat: 'DES' },
            { key: 'venenos',    label: 'Venenos',    stat: 'INT' },
        ],
    },
    {
        category: 'Creativas',
        skills: [
            { key: 'arte',        label: 'Arte',        stat: 'DES' },
            { key: 'baile',       label: 'Baile',       stat: 'AGI' },
            { key: 'forja',       label: 'Forja',       stat: 'DES' },
            { key: 'runas',       label: 'Runas',       stat: 'INT' },
            { key: 'alquimia',    label: 'Alquimia',    stat: 'INT' },
            { key: 'animismo',    label: 'Animismo',    stat: 'INT' },
            { key: 'musica',      label: 'Música',      stat: 'DES' },
            { key: 'trucosM',     label: 'T. Manos',    stat: 'DES' },
            { key: 'calRitual',   label: 'Cal. Ritual', stat: 'INT' },
            { key: 'orfebr',      label: 'Orfebrería',  stat: 'DES' },
            { key: 'confeccion',  label: 'Confección',  stat: 'DES' },
            { key: 'marionetas',  label: 'Marionetas',  stat: 'DES' },
        ],
    },
];

type Tab = 'basico' | 'secundarias' | 'ki' | 'mistica' | 'psiquica';
const TABS: { key: Tab; label: string }[] = [
    { key: 'basico',      label: 'Básico'     },
    { key: 'secundarias', label: 'Secundarias' },
    { key: 'ki',          label: 'Ki'          },
    { key: 'mistica',     label: 'Mística'     },
    { key: 'psiquica',    label: 'Psíquica'    },
];

const INPUT_CLS = 'w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-blue-500';

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function nat(raw: string) {
    return Math.max(0, parseInt(raw) || 0);
}

export default function CharacterCreator({ onClose }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('basico');

    // Básico
    const [name, setName] = useState('');
    const [type, setType] = useState<CharacterType>('NPC');
    const [biography, setBiography] = useState('');
    const [portraitPath, setPortraitPath] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stats, setStats] = useState<Record<Stat, number>>({
        AGI: 5, CON: 5, DES: 5, FUE: 5, INT: 5, PER: 5, POD: 5, VOL: 5,
    });
    const [combatPds, setCombatPds] = useState<Record<Skill, number>>({ HA: 0, HP: 0, HE: 0, LA: 0 });
    const [maxPV, setMaxPV] = useState(40);
    const [maxCansancio, setMaxCansancio] = useState(6);

    // Secundarias — sparse map: only non-zero entries need to be tracked
    const [skillPds, setSkillPds] = useState<Record<string, number>>({});

    // Ki
    const [kiPds,    setKiPds]    = useState<Record<KiKey, number>>({ agi: 0, con: 0, des: 0, fue: 0, pod: 0, vol: 0 });
    const [accumPds, setAccumPds] = useState<Record<KiKey, number>>({ agi: 0, con: 0, des: 0, fue: 0, pod: 0, vol: 0 });

    // Mística
    const [mysticPds, setMysticPds] = useState<Record<MysticField, number>>({
        pdZeon: 0, pdACT: 0, pdProyMag: 0, pdConvocar: 0, pdAtar: 0, pdDesconvocar: 0, pdControlar: 0,
    });

    // Psíquica
    const [psychicPds, setPsychicPds] = useState({ pdCV: 0, pdProyPsi: 0 });

    const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`${API_CONFIG.baseURL}/api/uploads`, { method: 'POST', body: form });
            if (res.ok) {
                const data = await res.json();
                if (data.url) setPortraitPath(data.url);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleCreate = () => {
        if (!name.trim()) return;

        const secondarySkills: AnimaAttributes['secondarySkills'] = {};
        for (const [key, pds] of Object.entries(skillPds)) {
            if (pds > 0) secondarySkills[key] = { pds, cost: 2, catBonus: 0 };
        }

        const ki: AnimaAttributes['ki'] = {};
        for (const { key } of KI_STATS) {
            const kp = kiPds[key];
            const ap = accumPds[key];
            if (kp > 0 || ap > 0) {
                ki[key] = { pds: kp, cost: 20, accumPds: ap, accumCost: 25 } as KiStatEntry;
            }
        }

        const hasMystic  = MYSTIC_FIELDS.some(f => mysticPds[f] > 0);
        const hasPsychic = psychicPds.pdCV > 0 || psychicPds.pdProyPsi > 0;

        const attrs: AnimaAttributes = {
            baseAGI: stats.AGI, baseCON: stats.CON, baseDES: stats.DES, baseFUE: stats.FUE,
            baseINT: stats.INT, basePER: stats.PER, basePOD: stats.POD, baseVOL: stats.VOL,
            pdHA: combatPds.HA, costHA: 2, catBonusHA: 0,
            pdHP: combatPds.HP, costHP: 2, catBonusHP: 0,
            pdHE: combatPds.HE, costHE: 2, catBonusHE: 0,
            pdLA: combatPds.LA, costLA: 2, catBonusLA: 0,
            maxPV, currentPV: maxPV,
            maxCansancio, currentCansancio: maxCansancio,
            ...(Object.keys(secondarySkills).length > 0 && { secondarySkills }),
            ...(Object.keys(ki).length > 0 && { ki }),
            ...(hasMystic  && { mystic:   { ...mysticPds  } }),
            ...(hasPsychic && { psychic:  { ...psychicPds } }),
        };

        getWebSocketService().send('CREATE_CHARACTER', {
            name: name.trim(),
            type,
            attributesJson: JSON.stringify(attrs),
            biography: biography.trim(),
            ...(portraitPath && { portraitPath }),
        });

        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
                    <h2 className="text-white font-semibold text-sm">Nuevo personaje</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700 shrink-0 overflow-x-auto">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition border-b-2 -mb-px ${
                                activeTab === key
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-5 space-y-5 flex-1">

                    {/* ── Básico ── */}
                    {activeTab === 'basico' && (
                        <>
                            {/* Portrait picker */}
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="relative shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 border-dashed border-gray-600 hover:border-blue-500 transition focus:outline-none"
                                    title="Subir retrato"
                                >
                                    {portraitPath ? (
                                        <img
                                            src={`${API_CONFIG.baseURL}${portraitPath}`}
                                            alt="Retrato"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="flex flex-col items-center justify-center w-full h-full text-gray-500 text-xs gap-1">
                                            {uploading ? '…' : <><span className="text-lg leading-none">+</span><span>Foto</span></>}
                                        </span>
                                    )}
                                    {uploading && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-gray-300 text-xs">…</div>
                                    )}
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePortraitUpload} />
                                <p className="text-xs text-gray-500">Haz clic en el círculo para subir una imagen de retrato (opcional).</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                                    <input
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Nombre del personaje"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                        value={type}
                                        onChange={(e) => setType(e.target.value as CharacterType)}
                                    >
                                        <option value="PC">PC — Jugador</option>
                                        <option value="NPC">NPC</option>
                                        <option value="Monster">Monster</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Características (1–20)
                                </h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {STATS.map((stat) => (
                                        <div key={stat} className="flex flex-col items-center gap-1">
                                            <label className="text-xs text-gray-500">{stat}</label>
                                            <input
                                                type="number" min={1} max={20}
                                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                                                value={stats[stat]}
                                                onChange={(e) => setStats(s => ({ ...s, [stat]: clamp(parseInt(e.target.value) || 0, 1, 20) }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Habilidades de combate (PDs)
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {COMBAT_SKILLS.map((skill) => (
                                        <div key={skill} className="flex items-center gap-2">
                                            <label className="text-xs text-gray-500 w-24 shrink-0">{skill} – {SKILL_LABELS[skill]}</label>
                                            <input
                                                type="number" min={0}
                                                className={INPUT_CLS}
                                                value={combatPds[skill]}
                                                onChange={(e) => setCombatPds(p => ({ ...p, [skill]: nat(e.target.value) }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Vida y Cansancio
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-500 shrink-0">PV máx</label>
                                        <input
                                            type="number" min={1}
                                            className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                                            value={maxPV}
                                            onChange={(e) => setMaxPV(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-500 shrink-0">Cansancio máx</label>
                                        <input
                                            type="number" min={1}
                                            className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                                            value={maxCansancio}
                                            onChange={(e) => setMaxCansancio(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Biografía (opcional)</label>
                                <textarea
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                                    rows={3}
                                    value={biography}
                                    onChange={(e) => setBiography(e.target.value)}
                                    placeholder="Descripción, historia, notas..."
                                />
                            </div>
                        </>
                    )}

                    {/* ── Secundarias ── */}
                    {activeTab === 'secundarias' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500">
                                Introduce los PDs invertidos en cada habilidad (coste 2 por defecto).
                            </p>
                            {SECONDARY_SKILL_CATS.map(({ category, skills }) => (
                                <div key={category}>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{category}</h3>
                                    <div className="space-y-1">
                                        {skills.map(({ key, label, stat }) => (
                                            <div key={key} className="flex items-center gap-2">
                                                <span className="text-sm text-gray-300 flex-1">{label}</span>
                                                {stat && <span className="text-xs text-gray-600 w-6 shrink-0">{stat}</span>}
                                                <input
                                                    type="number" min={0}
                                                    className={INPUT_CLS}
                                                    value={skillPds[key] ?? 0}
                                                    onChange={(e) => {
                                                        const v = nat(e.target.value);
                                                        setSkillPds(p => ({ ...p, [key]: v }));
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Ki ── */}
                    {activeTab === 'ki' && (
                        <div>
                            <p className="text-xs text-gray-500 mb-4">
                                Coste por defecto: 20 PDs/punto de Ki · 25 PDs/punto de Acumulación.
                            </p>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 text-center">
                                        <th className="text-left font-normal pb-2 pr-2">Stat</th>
                                        <th className="font-normal pb-2">PDs Ki</th>
                                        <th className="font-normal pb-2">PDs Acum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {KI_STATS.map(({ key, label }) => (
                                        <tr key={key} className="border-t border-gray-700/50">
                                            <td className="py-2 text-gray-300 font-mono pr-2">{label}</td>
                                            <td className="py-2 text-center">
                                                <input
                                                    type="number" min={0}
                                                    className={INPUT_CLS}
                                                    value={kiPds[key]}
                                                    onChange={(e) => setKiPds(p => ({ ...p, [key]: nat(e.target.value) }))}
                                                />
                                            </td>
                                            <td className="py-2 text-center">
                                                <input
                                                    type="number" min={0}
                                                    className={INPUT_CLS}
                                                    value={accumPds[key]}
                                                    onChange={(e) => setAccumPds(p => ({ ...p, [key]: nat(e.target.value) }))}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Mística ── */}
                    {activeTab === 'mistica' && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 mb-4">
                                Coste por defecto: 2 PDs/5 puntos para Zeón, Proy. Mágica y habilidades de invocación.
                                2 PDs/punto para ACT.
                            </p>
                            {MYSTIC_FIELDS.map((field) => (
                                <div key={field} className="flex items-center gap-2">
                                    <span className="text-sm text-gray-300 flex-1">{MYSTIC_LABELS[field]}</span>
                                    <input
                                        type="number" min={0}
                                        className={INPUT_CLS}
                                        value={mysticPds[field]}
                                        onChange={(e) => setMysticPds(p => ({ ...p, [field]: nat(e.target.value) }))}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Psíquica ── */}
                    {activeTab === 'psiquica' && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 mb-4">
                                CV: 2 PDs/punto · Proyección Psíquica: 2 PDs/5 puntos.
                            </p>
                            {([
                                { field: 'pdCV',      label: 'CV (Capacidad de Voluntad)' },
                                { field: 'pdProyPsi', label: 'Proyección Psíquica'         },
                            ] as const).map(({ field, label }) => (
                                <div key={field} className="flex items-center gap-2">
                                    <span className="text-sm text-gray-300 flex-1">{label}</span>
                                    <input
                                        type="number" min={0}
                                        className={INPUT_CLS}
                                        value={psychicPds[field]}
                                        onChange={(e) => setPsychicPds(p => ({ ...p, [field]: nat(e.target.value) }))}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-700 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-600 rounded hover:border-gray-400 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!name.trim()}
                        className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition"
                    >
                        Crear personaje
                    </button>
                </div>
            </div>
        </div>
    );
}
