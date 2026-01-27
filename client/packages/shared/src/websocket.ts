export interface LoginCredentials {
    username: string;
    password: string;
}

export interface LoginSuccess {
    userId: number;
    username: string;
    role: 'gm' | 'player';
}

export interface RegisterCredentials {
    username: string;
    password: string;
    email?: string;
}

export interface RegisterSuccess {
    message: string;
    userId: number;
    username: string;
}

export interface JoinCampaignData {
    campaignId: number;
    userId: number;
}

export interface SessionState {
    campaignId: number;
    activeScene: any;
    tokens: any[];
    connectedUsers: string[];
    inCombat: boolean;
    combatState: any;
    fogOfWar: boolean;
}

export class WebSocketService {
    private ws: WebSocket | null = null;
    private messageHandlers: Map<string, (payload: any) => void> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 2000;

    constructor(private url: string) {}

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('WebSocket conectado');
                    this.reconnectAttempts = 0;
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        const handler = this.messageHandlers.get(message.type);
                        if (handler) {
                            handler(message.payload);
                        }
                    } catch (error) {
                        console.error('Error procesando mensaje:', error);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log('WebSocket desconectado');
                    this.attemptReconnect();
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reintentando conexión (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            setTimeout(() => {
                this.connect().catch(console.error);
            }, this.reconnectDelay * this.reconnectAttempts);
        }
    }

    on(messageType: string, handler: (payload: any) => void) {
        this.messageHandlers.set(messageType, handler);
    }

    off(messageType: string) {
        this.messageHandlers.delete(messageType);
    }

    send(type: string, payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        } else {
            console.error('WebSocket no está conectado');
        }
    }

    login(credentials: LoginCredentials): Promise<LoginSuccess> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.off('LOGIN_SUCCESS');
                this.off('LOGIN_ERROR');
                reject(new Error('Timeout en login'));
            }, 10000);

            this.on('LOGIN_SUCCESS', (payload: LoginSuccess) => {
                clearTimeout(timeout);
                this.off('LOGIN_SUCCESS');
                this.off('LOGIN_ERROR');
                resolve(payload);
            });

            this.on('LOGIN_ERROR', (payload: { message: string }) => {
                clearTimeout(timeout);
                this.off('LOGIN_SUCCESS');
                this.off('LOGIN_ERROR');
                reject(new Error(payload.message));
            });

            this.send('LOGIN', credentials);
        });
    }

    joinCampaign(data: JoinCampaignData) {
        this.send('JOIN_CAMPAIGN', data);
    }

    register(credentials: RegisterCredentials): Promise<RegisterSuccess> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.off('REGISTER_SUCCESS');
                this.off('REGISTER_ERROR');
                reject(new Error('Timeout en registro'));
            }, 10000);

            this.on('REGISTER_SUCCESS', (payload: RegisterSuccess) => {
                clearTimeout(timeout);
                this.off('REGISTER_SUCCESS');
                this.off('REGISTER_ERROR');
                resolve(payload);
            });

            this.on('REGISTER_ERROR', (payload: { message: string }) => {
                clearTimeout(timeout);
                this.off('REGISTER_SUCCESS');
                this.off('REGISTER_ERROR');
                reject(new Error(payload.message));
            });

            this.send('REGISTER', credentials);
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.messageHandlers.clear();
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

let wsInstance: WebSocketService | null = null;

export const getWebSocketService = (url?: string): WebSocketService => {
    if (!wsInstance && url) {
        wsInstance = new WebSocketService(url);
    }
    if (!wsInstance) {
        throw new Error('WebSocket no inicializado. Proporciona una URL.');
    }
    return wsInstance;
};

export const resetWebSocketService = () => {
    if (wsInstance) {
        wsInstance.disconnect();
        wsInstance = null;
    }
};