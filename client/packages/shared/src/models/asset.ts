export type AssetType = "image" | "audio";

export interface Asset {
    id: number;

    campaignId: number;

    path: string;

    type: AssetType;

    label?: string;
}