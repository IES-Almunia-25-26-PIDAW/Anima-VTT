import { useState } from 'react';
import { getWebSocketService } from '../index';

interface SignInProps {
    onBackToLogin: () => void;
    onRegisterSuccess: () => void;
}

export default function SignIn({ onBackToLogin, onRegisterSuccess }: SignInProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const handleRegister = async () => {
        setError('');
        setSuccess('');

        // Validaciones
        if (!username.trim() || !password.trim()) {
            setError('Usuario y contraseña son obligatorios');
            return;
        }

        if (username.length < 3) {
            setError('El usuario debe tener al menos 3 caracteres');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setIsRegistering(true);

        try {
            const ws = getWebSocketService();
            const result = await ws.register({
                username: username.trim(),
                password,
                email: email.trim() || undefined
            });

            setSuccess(result.message);

            // Esperar 3 segundos y volver al login
            setTimeout(() => {
                onRegisterSuccess();
            }, 3000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error en el registro');
        } finally {
            setIsRegistering(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && username && password && confirmPassword && !isRegistering) {
            handleRegister();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-gray-700">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Crear Cuenta</h1>
                    <p className="text-gray-400">Regístrate para unirte al VTT</p>
                </div>

                {success ? (
                    <div className="space-y-6">
                        <div className="bg-green-900/50 border border-green-700 rounded-lg p-6 text-center">
                            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-green-200 text-lg font-semibold mb-2">¡Registro exitoso!</p>
                            <p className="text-green-300 text-sm">{success}</p>
                            <p className="text-green-400 text-xs mt-4">Redirigiendo al login...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                                Usuario *
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="Elige un nombre de usuario"
                                disabled={isRegistering}
                                minLength={3}
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                                Email (opcional)
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="tu@email.com"
                                disabled={isRegistering}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                                Contraseña *
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="Mínimo 6 caracteres"
                                disabled={isRegistering}
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                Confirmar Contraseña *
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="Repite tu contraseña"
                                disabled={isRegistering}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                                <p className="text-red-200 text-sm">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleRegister}
                            disabled={isRegistering || !username || !password || !confirmPassword}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                        >
                            {isRegistering ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Registrando...</span>
                                </>
                            ) : (
                                'Crear Cuenta'
                            )}
                        </button>

                        <div className="text-center pt-4 border-t border-gray-700">
                            <button
                                onClick={onBackToLogin}
                                disabled={isRegistering}
                                className="text-blue-400 hover:text-blue-300 transition text-sm"
                            >
                                ¿Ya tienes cuenta? Inicia sesión
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}