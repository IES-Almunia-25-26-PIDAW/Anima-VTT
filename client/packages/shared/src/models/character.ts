export type CharacterType = "PC" | "NPC" | "Monster";

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