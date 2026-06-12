export type ItemType = "weapon" | "armor" | "spell" | "consumable";

export interface Item {
    id: number;

    campaignId: number;

    characterId?: number;

    name: string;

    type?: ItemType;

    data: Record<string, any>;
}