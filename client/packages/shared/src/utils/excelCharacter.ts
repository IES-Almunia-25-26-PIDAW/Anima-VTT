import * as XLSX from 'xlsx';
import type { AnimaAttributes, CharacterType, SkillEntry, KiStatEntry } from '../models/character';
import { statMod, calcZeonBase } from './animaCalc';

type KiKey = 'agi' | 'con' | 'des' | 'fue' | 'pod' | 'vol';

// Secondary skill → governing stat (null = no stat modifier)
const SKILL_STAT: Record<string, string | null> = {
    acrobacias: 'AGI', atletismo: 'AGI', montar: 'AGI', nadar: 'AGI',
    trepar: 'AGI', saltar: 'AGI', pilotar: 'DES',
    estilo: null,   intimidar: 'VOL', liderazgo: 'VOL', persuasion: 'VOL',
    comercio: 'INT', callejeo: 'INT', etiqueta: null,
    advertir: 'PER', buscar: 'PER', rastrear: 'PER',
    animales: 'INT', ciencia: 'INT', ley: 'INT', herbolaria: 'INT',
    historia: 'INT', tactica: 'INT', medicina: 'INT', memorizar: 'INT',
    navegacion: 'INT', ocultismo: 'INT', tasacion: 'INT',
    frialdad: 'VOL', purezaFuerza: 'FUE', resistenciaDolor: 'VOL',
    cerrajeria: 'DES', disfraz: 'DES', ocultarse: 'AGI', robo: 'DES',
    sigilo: 'AGI', tramperia: 'DES', venenos: 'INT',
    arte: 'DES', baile: 'AGI', forja: 'DES', runas: 'INT',
    alquimia: 'INT', animismo: 'INT', musica: 'DES', trucosM: 'DES',
    calRitual: 'INT', orfebr: 'DES', confeccion: 'DES', marionetas: 'DES',
};

const VTT_MARKER = 'VTT_PERSONAJE';

// ─── Cell helpers ────────────────────────────────────────────────────────────

function cellStr(sheet: XLSX.WorkSheet, row: number, col: number): string {
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    const c = sheet[ref];
    return c != null ? String(c.v ?? '').trim() : '';
}

function cellNum(sheet: XLSX.WorkSheet, row: number, col: number): number {
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    const c = sheet[ref];
    if (!c) return 0;
    const n = Number(c.v);
    return isFinite(n) ? n : 0;
}

function sumCells(sheet: XLSX.WorkSheet, row: number, col1: number, col2: number): number {
    let total = 0;
    for (let c = col1; c <= col2; c++) total += cellNum(sheet, row, c);
    return total;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function withDefaults(partial: AnimaAttributes): AnimaAttributes {
    return {
        baseAGI: 5, baseCON: 5, baseDES: 5, baseFUE: 5,
        baseINT: 5, basePER: 5, basePOD: 5, baseVOL: 5,
        pdHA: 0, costHA: 2, catBonusHA: 0,
        pdHP: 0, costHP: 2, catBonusHP: 0,
        pdHE: 0, costHE: 2, catBonusHE: 0,
        pdLA: 0, costLA: 2, catBonusLA: 0,
        maxPV: 40, currentPV: 40,
        maxCansancio: 6, currentCansancio: 6,
        ...partial,
    };
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function exportCharacterToExcel(character: {
    name: string;
    type: CharacterType;
    biography?: string;
    attributes: AnimaAttributes;
}): void {
    const a = character.attributes;
    const rows: (string | number)[][] = [];

    const add = (...cells: (string | number | undefined | null)[]) =>
        rows.push(cells.map(c => c ?? '') as (string | number)[]);

    add(VTT_MARKER, '1.0');
    add('nombre', character.name);
    add('tipo', character.type);
    add('biografia', character.biography ?? '');
    add();

    // Identity
    add('category1',   a.category1  ?? '');
    add('level1',      a.level1     ?? 0);
    add('category2',   a.category2  ?? '');
    add('level2',      a.level2     ?? 0);
    add('race',        a.race       ?? '');
    add('gender',      a.gender     ?? '');
    add('gnosis',      a.gnosis     ?? 10);
    add('experience',  a.experience ?? 0);
    add('notes',       a.notes      ?? '');
    add();

    // Stats
    for (const s of ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL']) {
        add(`base${s}`, (a as Record<string, unknown>)[`base${s}`] as number ?? 5);
        add(`tmp${s}`,  (a as Record<string, unknown>)[`tmp${s}`]  as number ?? 0);
    }
    add();

    // Combat
    for (const sk of ['HA', 'HP', 'HE', 'LA']) {
        add(`pd${sk}`,       (a as Record<string, unknown>)[`pd${sk}`]       as number ?? 0);
        add(`cost${sk}`,     (a as Record<string, unknown>)[`cost${sk}`]     as number ?? 2);
        add(`catBonus${sk}`, (a as Record<string, unknown>)[`catBonus${sk}`] as number ?? 0);
    }
    add();

    // Vitals
    add('maxPV',           a.maxPV           ?? 0);
    add('currentPV',       a.currentPV       ?? 0);
    add('maxCansancio',    a.maxCansancio    ?? 0);
    add('currentCansancio', a.currentCansancio ?? 0);
    add();

    // Resistances
    for (const r of ['RF', 'RE', 'RV', 'RM', 'RP']) {
        add(`esp${r}`, (a as Record<string, unknown>)[`esp${r}`] as number ?? 0);
    }
    add();

    // Secondary skills
    if (a.secondarySkills) {
        for (const [key, entry] of Object.entries(a.secondarySkills)) {
            add(`secondarySkills.${key}.pds`,      entry.pds      ?? 0);
            add(`secondarySkills.${key}.cost`,     entry.cost     ?? 2);
            add(`secondarySkills.${key}.catBonus`, entry.catBonus ?? 0);
            add(`secondarySkills.${key}.esp`,      entry.esp      ?? 0);
            if (entry.specialty) add(`secondarySkills.${key}.specialty`, entry.specialty);
        }
        add();
    }

    // Ki
    if (a.ki) {
        for (const stat of ['agi', 'con', 'des', 'fue', 'pod', 'vol'] as KiKey[]) {
            const k = a.ki[stat];
            if (!k) continue;
            add(`ki.${stat}.pds`,       k.pds       ?? 0);
            add(`ki.${stat}.cost`,      k.cost      ?? 20);
            add(`ki.${stat}.esp`,       k.esp       ?? 0);
            add(`ki.${stat}.accumPds`,  k.accumPds  ?? 0);
            add(`ki.${stat}.accumCost`, k.accumCost ?? 25);
            add(`ki.${stat}.accumEsp`,  k.accumEsp  ?? 0);
        }
        add();
    }

    // Mystic
    if (a.mystic) {
        for (const [k, v] of Object.entries(a.mystic)) {
            if (v !== undefined) add(`mystic.${k}`, v);
        }
        add();
    }

    // Psychic
    if (a.psychic) {
        for (const [k, v] of Object.entries(a.psychic)) {
            if (v !== undefined) add(`psychic.${k}`, v);
        }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 38 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VTT');
    XLSX.writeFile(wb, `${character.name.replace(/[^\w\-]/g, '_')}.xlsx`);
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportResult {
    name: string;
    type: CharacterType;
    biography: string;
    attributesJson: string;
}

export async function importCharacterFromExcel(file: File): Promise<ImportResult> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // Detect our own VTT export format first
    const vttSheet = wb.Sheets['VTT'];
    if (vttSheet && cellStr(vttSheet, 0, 0) === VTT_MARKER) {
        return parseVTTFormat(vttSheet);
    }

    // Fall back to Anima BF xlsm format per ExcelReader.java spec
    return parseAnimaBFFormat(wb);
}

// Parses the structured key-value format we export
function parseVTTFormat(sheet: XLSX.WorkSheet): ImportResult {
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:B1');
    const kv: Record<string, string | number> = {};

    for (let r = 0; r <= range.e.r; r++) {
        const key = cellStr(sheet, r, 0);
        if (!key || key === VTT_MARKER) continue;
        const ref = XLSX.utils.encode_cell({ r, c: 1 });
        const cell = sheet[ref];
        if (cell == null) continue;
        kv[key] = cell.t === 'n' ? Number(cell.v) : String(cell.v ?? '');
    }

    const name      = String(kv['nombre'] ?? 'Personaje importado');
    const type      = String(kv['tipo'] ?? 'NPC') as CharacterType;
    const biography = String(kv['biografia'] ?? '');

    const partial: AnimaAttributes = {};
    const SKIP = new Set(['nombre', 'tipo', 'biografia']);

    for (const [key, val] of Object.entries(kv)) {
        if (SKIP.has(key)) continue;
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        const v   = isFinite(num) ? num : String(val);

        if (key.startsWith('secondarySkills.')) {
            const [, skillKey, field] = key.split('.');
            if (!partial.secondarySkills) partial.secondarySkills = {};
            if (!partial.secondarySkills[skillKey]) partial.secondarySkills[skillKey] = {};
            (partial.secondarySkills[skillKey] as Record<string, unknown>)[field as keyof SkillEntry] = v;
        } else if (key.startsWith('ki.')) {
            const [, stat, field] = key.split('.');
            if (!partial.ki) partial.ki = {};
            const k = stat as KiKey;
            if (!partial.ki[k]) partial.ki[k] = {};
            (partial.ki[k] as Record<string, unknown>)[field as keyof KiStatEntry] = v;
        } else if (key.startsWith('mystic.')) {
            const field = key.slice(7);
            if (!partial.mystic) partial.mystic = {};
            (partial.mystic as Record<string, unknown>)[field] = v;
        } else if (key.startsWith('psychic.')) {
            const field = key.slice(8);
            if (!partial.psychic) partial.psychic = {};
            (partial.psychic as Record<string, unknown>)[field] = v;
        } else {
            (partial as Record<string, unknown>)[key] = v;
        }
    }

    return { name, type, biography, attributesJson: JSON.stringify(withDefaults(partial)) };
}

// Reads from Anima Beyond Fantasy xlsm v8.7.0 sheet layout
function parseAnimaBFFormat(wb: XLSX.WorkBook): ImportResult {
    const general   = wb.Sheets['General'];
    const principal = wb.Sheets['Principal'];
    const pds       = wb.Sheets['PDs'];

    if (!principal && !general) {
        throw new Error('Formato no reconocido: faltan las hojas "General" y "Principal".');
    }

    // ── Identity ──────────────────────────────────────────────────────────────
    // General!F22 = nombre (row 21, col 5)
    const name = general ? cellStr(general, 21, 5) : '';
    // Principal!F22 = raza, AB13 = gnosis, H24 = sexo
    const race   = principal ? cellStr(principal, 21,  5) : '';
    const gnosis = principal ? cellNum(principal, 12, 27) : 0;  // AB13
    const sexoRaw = principal ? cellStr(principal, 23, 7).toLowerCase() : ''; // H24
    const gender: 'M' | 'F' =
        sexoRaw === 'femenino' || sexoRaw === 'mujer' || sexoRaw === 'f' ? 'F' : 'M';

    // ── Primary stats ─────────────────────────────────────────────────────────
    // Principal!E11:E18 = base (rows 10-17, col 4)
    // Principal!F11:F18 = temp (rows 10-17, col 5)
    const STATS = ['AGI', 'CON', 'DES', 'FUE', 'INT', 'PER', 'POD', 'VOL'];
    const statBase: Record<string, number> = {};
    const statTemp: Record<string, number> = {};
    if (principal) {
        STATS.forEach((key, i) => {
            statBase[key] = cellNum(principal, 10 + i, 4);
            statTemp[key] = cellNum(principal, 10 + i, 5);
        });
    } else {
        STATS.forEach(key => { statBase[key] = 5; statTemp[key] = 0; });
    }

    // ── Stat totals + modifier map (for catBonus back-calculation) ───────────
    const clamp = (v: number) => Math.min(20, Math.max(0, v));
    const agiT = clamp((statBase['AGI'] || 5) + (statTemp['AGI'] || 0));
    const conT = clamp((statBase['CON'] || 5) + (statTemp['CON'] || 0));
    const desT = clamp((statBase['DES'] || 5) + (statTemp['DES'] || 0));
    const fueT = clamp((statBase['FUE'] || 5) + (statTemp['FUE'] || 0));
    const intT = clamp((statBase['INT'] || 5) + (statTemp['INT'] || 0));
    const perT = clamp((statBase['PER'] || 5) + (statTemp['PER'] || 0));
    const podT = clamp((statBase['POD'] || 5) + (statTemp['POD'] || 0));
    const volT = clamp((statBase['VOL'] || 5) + (statTemp['VOL'] || 0));
    const MOD: Record<string, number> = {
        AGI: statMod(agiT), CON: statMod(conT), DES: statMod(desT),
        FUE: statMod(fueT), INT: statMod(intT), PER: statMod(perT),
        POD: statMod(podT), VOL: statMod(volT),
    };
    const sm = (key: string | null | undefined): number => (key ? (MOD[key] ?? 0) : 0);

    // ── PV and Cansancio (CALC snapshots) ────────────────────────────────────
    // Principal!N11 = PV total CALC (row 10, col 13)
    // Principal!P11 = PV actual (row 10, col 15)
    // Principal!N16 = Cansancio total CALC (row 15, col 13)
    let maxPV = 40, currentPV = 40, maxCansancio = 6;
    if (principal) {
        const pvTotal   = cellNum(principal, 10, 13);
        const pvActual  = cellNum(principal, 10, 15);
        const cansTotal = cellNum(principal, 15, 13);
        if (pvTotal    > 0) { maxPV = pvTotal; currentPV = pvActual > 0 ? pvActual : pvTotal; }
        if (cansTotal  > 0) maxCansancio = cansTotal;
    }

    // ── Resistance Esp ────────────────────────────────────────────────────────
    // Principal!I58:I62 = RF/RE/RV/RM/RP esp (rows 57-61, col 8)
    const espRF = principal ? cellNum(principal, 57, 8) : 0;
    const espRE = principal ? cellNum(principal, 58, 8) : 0;
    const espRV = principal ? cellNum(principal, 59, 8) : 0;
    const espRM = principal ? cellNum(principal, 60, 8) : 0;
    const espRP = principal ? cellNum(principal, 61, 8) : 0;

    // ── Categories ────────────────────────────────────────────────────────────
    // PDs!O7/P7 = cat1 name/levels (row 6, col 14/15)
    // PDs!O9/P9 = cat2 name/levels (row 8, col 14/15)
    // PDs!R17   = total level CALC  (row 16, col 17)
    let category1 = '', level1 = 0, category2 = '', level2 = 0;
    if (pds) {
        category1 = cellStr(pds,  6, 14);
        level1    = cellNum(pds,  6, 15);
        category2 = cellStr(pds,  8, 14);
        level2    = cellNum(pds,  8, 15);
        if (!level1 && !level2) level1 = cellNum(pds, 16, 17); // R17 fallback
    }

    // ── Combat skills ─────────────────────────────────────────────────────────
    // PDs!L25:P25 = HA PDs (row 24, cols 11-15); AA25 (col 26) = CALC final
    // All four skills use AGI modifier in the VTT formula
    // catBonus = aaVal - floor(pd/2)*5 - agiMod  (absorbs cost correction + real catBonus)
    const pdHA = pds ? sumCells(pds, 24, 11, 15) : 0;
    const pdHP = pds ? sumCells(pds, 25, 11, 15) : 0;
    const pdHE = pds ? sumCells(pds, 26, 11, 15) : 0;
    const pdLA = pds ? sumCells(pds, 27, 11, 15) : 0;
    const agiMod = MOD['AGI'];
    const combatCatBonus = (aaVal: number, pd: number): number =>
        aaVal !== 0 ? aaVal - Math.floor(pd / 2) * 5 - agiMod : 0;
    const catBonusHA = pds ? combatCatBonus(cellNum(pds, 24, 26), pdHA) : 0;
    const catBonusHP = pds ? combatCatBonus(cellNum(pds, 25, 26), pdHP) : 0;
    const catBonusHE = pds ? combatCatBonus(cellNum(pds, 26, 26), pdHE) : 0;
    const catBonusLA = pds ? combatCatBonus(cellNum(pds, 27, 26), pdLA) : 0;

    // ── Ki skills ─────────────────────────────────────────────────────────────
    // PDs!L30:P30 = Ki AGI PDs (row 29, cols 11-15)
    // PDs!L31:P31 = KiAcum AGI PDs (row 30, cols 11-15); pattern repeats per stat
    const KI_MAP: { key: KiKey; kiRow: number; accumRow: number }[] = [
        { key: 'agi', kiRow: 29, accumRow: 30 },
        { key: 'con', kiRow: 31, accumRow: 32 },
        { key: 'des', kiRow: 33, accumRow: 34 },
        { key: 'fue', kiRow: 35, accumRow: 36 },
        { key: 'pod', kiRow: 37, accumRow: 38 },
        { key: 'vol', kiRow: 39, accumRow: 40 },
    ];
    const ki: AnimaAttributes['ki'] = {};
    if (pds) {
        for (const { key, kiRow, accumRow } of KI_MAP) {
            const kPds = sumCells(pds, kiRow,    11, 15);
            const aPds = sumCells(pds, accumRow, 11, 15);
            if (kPds > 0 || aPds > 0) {
                ki[key] = { pds: kPds, cost: 20, accumPds: aPds, accumCost: 25 };
            }
        }
    }

    // ── Secondary skills ─────────────────────────────────────────────────────
    // PDs rows 129-179 (0-indexed 128-178); PDs L:P (11-15); Esp Z (25); specialty S (18)
    // Row 157 (0-indexed 156) = V. Mágica — skipped (not in VTT skill set)
    const SKILL_ROWS: { key: string; row: number }[] = [
        { key: 'acrobacias',       row: 128 }, { key: 'atletismo',      row: 129 },
        { key: 'montar',           row: 130 }, { key: 'nadar',          row: 131 },
        { key: 'trepar',           row: 132 }, { key: 'saltar',         row: 133 },
        { key: 'pilotar',          row: 134 }, { key: 'estilo',         row: 135 },
        { key: 'intimidar',        row: 136 }, { key: 'liderazgo',      row: 137 },
        { key: 'persuasion',       row: 138 }, { key: 'comercio',       row: 139 },
        { key: 'callejeo',         row: 140 }, { key: 'etiqueta',       row: 141 },
        { key: 'advertir',         row: 142 }, { key: 'buscar',         row: 143 },
        { key: 'rastrear',         row: 144 }, { key: 'animales',       row: 145 },
        { key: 'ciencia',          row: 146 }, { key: 'ley',            row: 147 },
        { key: 'herbolaria',       row: 148 }, { key: 'historia',       row: 149 },
        { key: 'tactica',          row: 150 }, { key: 'medicina',       row: 151 },
        { key: 'memorizar',        row: 152 }, { key: 'navegacion',     row: 153 },
        { key: 'ocultismo',        row: 154 }, { key: 'tasacion',       row: 155 },
        // row 156 = V. Mágica (skipped)
        { key: 'frialdad',         row: 157 }, { key: 'purezaFuerza',   row: 158 },
        { key: 'resistenciaDolor', row: 159 }, { key: 'cerrajeria',     row: 160 },
        { key: 'disfraz',          row: 161 }, { key: 'ocultarse',      row: 162 },
        { key: 'robo',             row: 163 }, { key: 'sigilo',         row: 164 },
        { key: 'tramperia',        row: 165 }, { key: 'venenos',        row: 166 },
        { key: 'arte',             row: 167 }, { key: 'baile',          row: 168 },
        { key: 'forja',            row: 169 }, { key: 'runas',          row: 170 },
        { key: 'alquimia',         row: 171 }, { key: 'animismo',       row: 172 },
        { key: 'musica',           row: 173 }, { key: 'trucosM',        row: 174 },
        { key: 'calRitual',        row: 175 }, { key: 'orfebr',         row: 176 },
        { key: 'confeccion',       row: 177 }, { key: 'marionetas',     row: 178 },
    ];
    const secondarySkills: AnimaAttributes['secondarySkills'] = {};
    if (pds) {
        for (const { key, row } of SKILL_ROWS) {
            const totalPds  = sumCells(pds, row, 11, 15); // L:P
            const esp       = cellNum(pds, row, 25);       // Z col
            const specialty = cellStr(pds, row, 18);       // S col
            const aaVal     = cellNum(pds, row, 26);       // AA col (CALC final)
            if (totalPds > 0 || esp > 0 || specialty || aaVal !== 0) {
                const levels = Math.floor(totalPds / 2);
                const trained = levels >= 5;
                const skillSm = sm(SKILL_STAT[key]);
                // aaVal = levels*5 + skillSm + catBonus + esp + (specialty?40:0) + (trained?0:-30)
                const catBonus = aaVal !== 0
                    ? aaVal - levels * 5 - skillSm - esp
                        - (specialty ? 40 : 0) - (trained ? 0 : -30)
                    : 0;
                secondarySkills[key] = {
                    pds: totalPds, cost: 2,
                    ...(catBonus !== 0 && { catBonus }),
                    ...(esp > 0        && { esp }),
                    ...(specialty      && { specialty }),
                };
            }
        }
    }

    // ── Zeón (Místicos sheet) ─────────────────────────────────────────────────
    // Místicos!K18 = Zeón total CALC (row 17, col 10)
    // Store excess above the POD-derived base as catBonusZeon so VTT total matches Excel
    const misticosSheet = wb.Sheets['Místicos'] ?? wb.Sheets['Misticos'];
    let catBonusZeon = 0;
    if (misticosSheet) {
        const zeonTotal = cellNum(misticosSheet, 17, 10);
        if (zeonTotal > 0) catBonusZeon = Math.max(0, zeonTotal - calcZeonBase(podT));
    }

    // ── Mystic ────────────────────────────────────────────────────────────────
    // PDs!L94:P94 = ACT (row 93), L96:P96 = ProyMag (row 95), etc.
    // Esp in column X (col 23) per section 7.4 pattern
    const mystic: AnimaAttributes['mystic'] = {};
    if (pds) {
        const mRows: { field: keyof NonNullable<AnimaAttributes['mystic']>; espField: keyof NonNullable<AnimaAttributes['mystic']>; row: number }[] = [
            { field: 'pdACT',         espField: 'espACT',         row: 93  },
            { field: 'pdProyMag',     espField: 'espProyMag',     row: 95  },
            { field: 'pdConvocar',    espField: 'espConvocar',    row: 97  },
            { field: 'pdControlar',   espField: 'espControlar',   row: 98  },
            { field: 'pdAtar',        espField: 'espAtar',        row: 99  },
            { field: 'pdDesconvocar', espField: 'espDesconvocar', row: 100 },
        ];
        for (const { field, espField, row } of mRows) {
            const pd  = sumCells(pds, row, 11, 15);
            const esp = cellNum(pds, row, 23); // X col
            if (pd  > 0) mystic[field]    = pd;
            if (esp > 0) mystic[espField] = esp;
        }
        if (catBonusZeon > 0) mystic.catBonusZeon = catBonusZeon;
    } else if (catBonusZeon > 0) {
        mystic.catBonusZeon = catBonusZeon;
    }

    // ── Psychic ───────────────────────────────────────────────────────────────
    // PDs!L111:P111 = CV (row 110), L112:P112 = ProyPsi (row 111); Esp X (col 23)
    const psychic: AnimaAttributes['psychic'] = {};
    if (pds) {
        const pdCV      = sumCells(pds, 110, 11, 15);
        const espCV     = cellNum(pds, 110, 23);
        const pdProyPsi = sumCells(pds, 111, 11, 15);
        const espProyPsi = cellNum(pds, 111, 23);
        if (pdCV      > 0) psychic.pdCV       = pdCV;
        if (espCV     > 0) psychic.espCV      = espCV;
        if (pdProyPsi > 0) psychic.pdProyPsi  = pdProyPsi;
        if (espProyPsi > 0) psychic.espProyPsi = espProyPsi;
    }

    // ── Biography (General!C30/C35/C45/C55 → rows 29/34/44/54, col 2) ────────
    const bioParts: string[] = [];
    if (general) {
        for (const row of [29, 34, 44, 54]) {
            const text = cellStr(general, row, 2);
            if (text) bioParts.push(text);
        }
    }

    // ── Assemble ──────────────────────────────────────────────────────────────
    const attrs: AnimaAttributes = {
        baseAGI: statBase['AGI'] || 5,  tmpAGI: statTemp['AGI'] || 0,
        baseCON: statBase['CON'] || 5,  tmpCON: statTemp['CON'] || 0,
        baseDES: statBase['DES'] || 5,  tmpDES: statTemp['DES'] || 0,
        baseFUE: statBase['FUE'] || 5,  tmpFUE: statTemp['FUE'] || 0,
        baseINT: statBase['INT'] || 5,  tmpINT: statTemp['INT'] || 0,
        basePER: statBase['PER'] || 5,  tmpPER: statTemp['PER'] || 0,
        basePOD: statBase['POD'] || 5,  tmpPOD: statTemp['POD'] || 0,
        baseVOL: statBase['VOL'] || 5,  tmpVOL: statTemp['VOL'] || 0,
        pdHA, costHA: 2, catBonusHA,
        pdHP, costHP: 2, catBonusHP,
        pdHE, costHE: 2, catBonusHE,
        pdLA, costLA: 2, catBonusLA,
        maxPV, currentPV,
        maxCansancio, currentCansancio: maxCansancio,
        espRF, espRE, espRV, espRM, espRP,
        ...(category1 && { category1 }),
        ...(level1  > 0 && { level1 }),
        ...(category2 && { category2 }),
        ...(level2  > 0 && { level2 }),
        ...(gnosis  > 0 && { gnosis }),
        ...(race       && { race }),
        ...(gender     && { gender }),
        ...(Object.keys(secondarySkills).length > 0 && { secondarySkills }),
        ...(Object.keys(ki).length          > 0 && { ki }),
        ...(Object.keys(mystic).length      > 0 && { mystic }),
        ...(Object.keys(psychic).length     > 0 && { psychic }),
    };

    return {
        name:           name || 'Personaje importado',
        type:           'PC',
        biography:      bioParts.join('\n\n'),
        attributesJson: JSON.stringify(attrs),
    };
}
