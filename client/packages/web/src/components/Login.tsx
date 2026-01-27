import { useState, useEffect } from 'react';
import { getWebSocketService } from '@vtt/shared';
import type { LoginSuccess } from '@vtt/shared';

interface LoginProps {
    onLoginSuccess: (user: LoginSuccess) => void;
    onGoToSignIn: () => void;
}

export default function Login({ onLoginSuccess, onGoToSignIn }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isConnecting, setIsConnecting] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1000/game';
        const ws = getWebSocketService(wsUrl);

        ws.connect()
            .then(() => {
                setIsConnecting(false);
                setError('');
            })
            .catch((err) => {
                setIsConnecting(false);
                setError('No se pudo conectar al servidor. Verifica que esté corriendo.');
                console.error('Error de conexión:', err);
            });

        return () => {
        };
    }, []);

    const handleLogin = async () => {
        setError('');
        setIsLoggingIn(true);

        try {
            const ws = getWebSocketService();
            const userData = await ws.login({ username, password });
            onLoginSuccess(userData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error en el login');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && username && password && !isLoggingIn) {
            handleLogin();
        }
    };

    if (isConnecting) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-gray-700">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-300 text-lg">Conectando al servidor...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-gray-700">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">VTT Login</h1>
                    <p className="text-gray-400">Ingresa tus credenciales</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                            Usuario
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            placeholder="Ingresa tu usuario"
                            disabled={isLoggingIn}
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            placeholder="Ingresa tu contraseña"
                            disabled={isLoggingIn}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                            <p className="text-red-200 text-sm">{error}</p>
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={isLoggingIn || !username || !password}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                    >
                        {isLoggingIn ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Iniciando sesión...</span>
                            </>
                        ) : (
                            'Iniciar Sesión'
                        )}
                    </button>

                    <div className="text-center pt-4 border-t border-gray-700">
                        <button
                            onClick={onGoToSignIn}
                            disabled={isLoggingIn}
                            className="text-blue-400 hover:text-blue-300 transition text-sm"
                        >
                            ¿No tienes cuenta? Regístrate
                        </button>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-700">
                    <p className="text-center text-gray-400 text-sm">
                        Conectado a: <span className="text-blue-400 font-mono">{import.meta.env.VITE_WS_URL || 'ws://localhost:1000/game'}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}