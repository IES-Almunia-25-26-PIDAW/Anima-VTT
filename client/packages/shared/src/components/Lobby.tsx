import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { API_CONFIG } from '../config';
import { getWebSocketService } from '../websocket';
import type { Campaign } from '../models';

interface LobbyProps {
    onJoined: () => void;
}

export default function Lobby({ onJoined }: LobbyProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const currentUserId = useStore((s) => s.session.currentUserId);
    const currentUser = useStore((s) => {
        const id = s.session.currentUserId;
        return id != null ? s.entities.users[id] : null;
    });
    const activeCampaignId = useStore((s) => s.ui.activeCampaignId);

    useEffect(() => {
        fetch(`${API_CONFIG.baseURL}/api/campaigns`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((data: Campaign[]) => {
                setCampaigns(data);
                setLoading(false);
            })
            .catch((err) => {
                setError('No se pudieron cargar las campañas. Verifica que el servidor esté corriendo.');
                setLoading(false);
                console.error(err);
            });
    }, []);

    // Transition to game when SESSION_STATE arrives
    useEffect(() => {
        if (activeCampaignId != null) {
            onJoined();
        }
    }, [activeCampaignId]);

    const handleJoin = (campaignId: number) => {
        if (currentUserId == null) return;
        setJoiningId(campaignId);
        const ws = getWebSocketService();
        ws.joinCampaign({ campaignId, userId: currentUserId });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Campañas</h1>
                        <p className="text-gray-400 mt-1">Selecciona una campaña para unirte</p>
                    </div>
                    {currentUser && (
                        <div className="text-right">
                            <p className="text-white font-semibold">{currentUser.username}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${currentUser.role === 'gm' ? 'bg-purple-700 text-purple-100' : 'bg-blue-700 text-blue-100'}`}>
                                {currentUser.role.toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
                        <p className="text-red-200">{error}</p>
                    </div>
                )}

                {!loading && campaigns.length === 0 && !error && (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                        <p className="text-gray-400">No hay campañas disponibles.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {campaigns.map((c) => (
                        <div
                            key={c.id}
                            className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex items-center justify-between hover:border-gray-600 transition"
                        >
                            <div>
                                <h2 className="text-xl font-semibold text-white">{c.name}</h2>
                                {c.description && (
                                    <p className="text-gray-400 mt-1 text-sm">{c.description}</p>
                                )}
                            </div>
                            <button
                                onClick={() => handleJoin(c.id)}
                                disabled={joiningId != null}
                                className="ml-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition flex items-center gap-2 shrink-0"
                            >
                                {joiningId === c.id ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Uniéndose...
                                    </>
                                ) : 'Unirse'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
