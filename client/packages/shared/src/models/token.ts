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

    statusEffects: string[];
}