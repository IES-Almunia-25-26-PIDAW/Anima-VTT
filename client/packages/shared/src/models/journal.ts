export interface JournalFolder {
    id: number;
    name: string;
}

export interface JournalEntry {
    id: number;
    folderId?: number;
    title: string;
    content: string;
    visibility: 'gm' | 'all';
}
