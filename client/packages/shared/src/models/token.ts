export interface TokenAura {
    id: string;
    type: 'circle' | 'rect';
    size: number;    // radius (circle) or half-width (rect), in grid cells
    sizeH?: number;  // rect only: half-height in grid cells; defaults to size
    color: string;
    label?: string;
}

export interface Token {
    id: number;

    sceneId: number;
    characterId: number;
    characterName: string;

    x: number;
    y: number;
    rotation: number;

    visible: boolean;
    locked: boolean;

    hpOverride?: number;
    ownerUserId?: number;

    statusEffects: string[];
    auras: TokenAura[];
}