export type ChatMessageType = "chat" | "roll" | "system";

export interface ChatMessage {
    id: number;

    campaignId: number;

    userId: number;

    message: string;

    messageType: ChatMessageType;

    data?: any;

    timestamp: string;
}