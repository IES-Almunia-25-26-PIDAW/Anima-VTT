export interface Token {
    id: number;

    sceneId: number;
    characterId: number;

    x: number;
    y: number;
    rotation: number;

    visible: boolean;
    locked: boolean;

    hpOverride?: number;

    statusEffects: string[];
}