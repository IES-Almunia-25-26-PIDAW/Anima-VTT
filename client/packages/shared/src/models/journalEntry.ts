export interface JournalEntry {
    id: number;

    campaignId: number;

    title: string;

    content: string;

    visibility?: string;

    folderId?: number;
}