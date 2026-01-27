import { useState } from 'react';
import Login from './components/Login';
import SignIn from './components/SignIn';
import type { LoginSuccess } from '@vtt/shared';

type ViewType = 'login' | 'signin' | 'app';

function App() {
    const [user, setUser] = useState<LoginSuccess | null>(null);
    const [currentView, setCurrentView] = useState<ViewType>('login');

    const handleLoginSuccess = (userData: LoginSuccess) => {
        setUser(userData);
        setCurrentView('app');
    };

    const handleRegisterSuccess = () => {
        setCurrentView('login');
    };

    if (currentView === 'signin') {
        return (
            <SignIn
                onBackToLogin={() => setCurrentView('login')}
                onRegisterSuccess={handleRegisterSuccess}
            />
        );
    }

    if (currentView === 'login') {
        return (
            <Login
                onLoginSuccess={handleLoginSuccess}
                onGoToSignIn={() => setCurrentView('signin')}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <h1 className="text-3xl font-bold mb-4">Bienvenido, {user?.username}!</h1>
            <p className="text-gray-300">Role: {user?.role}</p>
            <p className="text-gray-300">User ID: {user?.userId}</p>
        </div>
    );
}

export default App;
