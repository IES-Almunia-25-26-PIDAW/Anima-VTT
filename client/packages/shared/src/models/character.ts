export type CharacterType = "PC" | "NPC" | "Monster";

export interface AnimaAttributes {
    // Identity
    race?: string;
    gender?: 'M' | 'F';
    gnosis?: number;
    category1?: string;
    level1?: number;
    category2?: string;
    level2?: number;

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