export interface Scene {
    id: number;
    campaignId: number;

    name: string;

    backgroundImagePath?: string;

    gridSize?: number;

    width: number;
    height: number;

    isActive: boolean;

    tokenIds: number[];
}