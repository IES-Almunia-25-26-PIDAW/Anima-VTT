export interface User {
    id: number;
    username: string;
    role: "gm" | "player";
}

export interface ConnectedUser {
    userId: number;
    username: string;
    role: "gm" | "player";
}