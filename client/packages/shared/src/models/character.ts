export type CharacterType = "PC" | "NPC" | "Monster";

export interface SkillEntry {
    pds?: number;
    cost?: number;
    catBonus?: number;
    esp?: number;
    specialty?: string;
}

export interface KiStatEntry {
    pds?: number;
    cost?: number;
    esp?: number;
    accumPds?: number;
    accumCost?: number;
    accumEsp?: number;
}

export interface AnimaAttributes {
    // Identity
    race?: string;
    gender?: 'M' | 'F';
    gnosis?: number;
    category1?: string;
    level1?: number;
    category2?: string;
    level2?: number;
    experience?: number;
    notes?: string;

    // Primary stats — base value and temporary modifier
    baseAGI?: number; tmpAGI?: number;
    baseCON?: number; tmpCON?: number;
    baseDES?: number; tmpDES?: number;
    baseFUE?: number; tmpFUE?: number;
    baseINT?: number; tmpINT?: number;
    basePER?: number; tmpPER?: number;
    basePOD?: number; tmpPOD?: number;
    baseVOL?: number; tmpVOL?: number;

    // Combat skills: PDs invested, PD cost per 5-point bonus, class base bonus
    pdHA?: number; costHA?: number; catBonusHA?: number;
    pdHP?: number; costHP?: number; catBonusHP?: number;
    pdHE?: number; costHE?: number; catBonusHE?: number;
    pdLA?: number; costLA?: number; catBonusLA?: number;

    // Resistance special bonuses (Esp)
    espRF?: number;
    espRE?: number;
    espRV?: number;
    espRM?: number;
    espRP?: number;

    // Life Points and Fatigue
    maxPV?: number;
    currentPV?: number;
    maxCansancio?: number;
    currentCansancio?: number;

    // Secondary skills — keyed by skill identifier (see SECONDARY_SKILL_CATS in CharacterSheet)
    secondarySkills?: Record<string, SkillEntry>;

    // Ki — one entry per stat (agi, con, des, fue, pod, vol)
    ki?: {
        agi?: KiStatEntry;
        con?: KiStatEntry;
        des?: KiStatEntry;
        fue?: KiStatEntry;
        pod?: KiStatEntry;
        vol?: KiStatEntry;
    };

    // Mystic abilities
    mystic?: {
        pdZeon?: number; costZeon?: number; catBonusZeon?: number; espZeon?: number;
        pdACT?: number; costACT?: number; espACT?: number;
        pdProyMag?: number; costProyMag?: number; espProyMag?: number;
        pdConvocar?: number; costConvocar?: number; espConvocar?: number;
        pdAtar?: number; costAtar?: number; espAtar?: number;
        pdDesconvocar?: number; costDesconvocar?: number; espDesconvocar?: number;
        pdControlar?: number; costControlar?: number; espControlar?: number;
    };

    // Psychic abilities
    psychic?: {
        pdCV?: number; costCV?: number; catBonusCV?: number; espCV?: number;
        pdProyPsi?: number; costProyPsi?: number; espProyPsi?: number;
    };
}

export interface Character {
    id: number;

    campaignId: number;

    name: string;

    type: CharacterType;

    attributes: Record<string, any>;

    biography?: string;

    portraitPath?: string;

    tokenIds: number[];

    itemIds: number[];
}
