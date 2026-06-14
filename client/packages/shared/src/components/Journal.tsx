import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { getWebSocketService } from '../websocket';
import type { JournalFolder, JournalEntry } from '../models';

interface JournalProps {
    isGM: boolean;
}

type View = { mode: 'list' } | { mode: 'read'; entry: JournalEntry } | { mode: 'edit'; entry: JournalEntry | null };

export default function Journal({ isGM }: JournalProps) {
    const folders = useStore(useShallow((s) => Object.values(s.journal.folders) as JournalFolder[]));
    const entries = useStore(useShallow((s) => Object.values(s.journal.entries) as JournalEntry[]));

    const [selectedFolderId, setSelectedFolderId] = useState<number | null | 'all'>('all');
    const [view, setView] = useState<View>({ mode: 'list' });
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolder, setShowNewFolder] = useState(false);

    // Edit form state
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editVisibility, setEditVisibility] = useState<'gm' | 'all'>('gm');
    const [editFolderId, setEditFolderId] = useState<number | null>(null);

    const visibleEntries = entries.filter((e) => {
        if (!isGM && e.visibility === 'gm') return false;
        if (selectedFolderId === 'all') return true;
        if (selectedFolderId === null) return e.folderId == null;
        return e.folderId === selectedFolderId;
    });

    const openNew = () => {
        setEditTitle('');
        setEditContent('');
        setEditVisibility('gm');
        setEditFolderId(selectedFolderId === 'all' ? null : selectedFolderId);
        setView({ mode: 'edit', entry: null });
    };

    const openEdit = (entry: JournalEntry) => {
        setEditTitle(entry.title);
        setEditContent(entry.content);
        setEditVisibility(entry.visibility);
        setEditFolderId(entry.folderId ?? null);
        setView({ mode: 'edit', entry });
    };

    const handleSave = () => {
        if (!editTitle.trim()) return;
        if (view.mode !== 'edit') return;
        if (view.entry) {
            getWebSocketService().send('UPDATE_JOURNAL_ENTRY', {
                entryId: view.entry.id,
                title: editTitle.trim(),
                content: editContent,
                visibility: editVisibility,
                folderId: editFolderId,
            });
        } else {
            getWebSocketService().send('CREATE_JOURNAL_ENTRY', {
                title: editTitle.trim(),
                content: editContent,
                visibility: editVisibility,
                folderId: editFolderId,
            });
        }
        setView({ mode: 'list' });
    };

    const handleDeleteEntry = (entryId: number) => {
        getWebSocketService().send('DELETE_JOURNAL_ENTRY', { entryId });
        if (view.mode === 'read' && view.entry.id === entryId) setView({ mode: 'list' });
        if (view.mode === 'edit' && view.entry?.id === entryId) setView({ mode: 'list' });
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        getWebSocketService().send('CREATE_JOURNAL_FOLDER', { name: newFolderName.trim() });
        setNewFolderName('');
        setShowNewFolder(false);
    };

    const handleDeleteFolder = (folderId: number) => {
        getWebSocketService().send('DELETE_JOURNAL_FOLDER', { folderId });
        if (selectedFolderId === folderId) setSelectedFolderId('all');
    };

    if (view.mode === 'read') {
        const e = view.entry;
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 shrink-0">
                    <button onClick={() => setView({ mode: 'list' })} className="text-gray-400 hover:text-white text-sm">← Volver</button>
                    {isGM && (
                        <button onClick={() => openEdit(e)} className="ml-auto text-blue-400 hover:text-blue-300 text-xs">Editar</button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white font-semibold text-sm leading-tight">{e.title}</h3>
                        {e.visibility === 'gm' && (
                            <span className="shrink-0 ml-2 text-xs bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded">GM</span>
                        )}
                    </div>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{e.content || <span className="text-gray-600 italic">Sin contenido</span>}</p>
                </div>
            </div>
        );
    }

    if (view.mode === 'edit') {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 shrink-0">
                    <button onClick={() => setView({ mode: 'list' })} className="text-gray-400 hover:text-white text-sm">← Cancelar</button>
                    <span className="text-xs text-gray-400 ml-1">{view.entry ? 'Editar entrada' : 'Nueva entrada'}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Título</label>
                        <input
                            autoFocus
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Título de la entrada"
                            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Contenido</label>
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            placeholder="Escribe aquí..."
                            rows={8}
                            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Carpeta</label>
                            <select
                                value={editFolderId ?? ''}
                                onChange={(e) => setEditFolderId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5 focus:outline-none"
                            >
                                <option value="">Sin carpeta</option>
                                {folders.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Visibilidad</label>
                            <select
                                value={editVisibility}
                                onChange={(e) => setEditVisibility(e.target.value as 'gm' | 'all')}
                                className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5 focus:outline-none"
                            >
                                <option value="gm">Solo GM</option>
                                <option value="all">Todos</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!editTitle.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-semibold transition"
                    >
                        {view.entry ? 'Guardar cambios' : 'Crear entrada'}
                    </button>
                </div>
            </div>
        );
    }

    // List view
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Folder picker */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-700 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Carpetas</span>
                    {isGM && (
                        <button
                            onClick={() => setShowNewFolder((v) => !v)}
                            className="text-gray-400 hover:text-white text-base leading-none"
                            title="Nueva carpeta"
                        >+</button>
                    )}
                </div>
                {isGM && showNewFolder && (
                    <div className="flex gap-1 mb-2">
                        <input
                            autoFocus
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder();
                                else if (e.key === 'Escape') { setNewFolderName(''); setShowNewFolder(false); }
                            }}
                            placeholder="Nombre carpeta"
                            className="flex-1 bg-gray-700 border border-blue-500 text-white text-xs rounded px-2 py-1 focus:outline-none"
                        />
                        <button onClick={handleCreateFolder} className="text-green-400 hover:text-green-300 text-sm px-1">✓</button>
                    </div>
                )}
                <div className="flex flex-wrap gap-1">
                    <button
                        onClick={() => setSelectedFolderId('all')}
                        className={`text-xs px-2 py-0.5 rounded transition ${selectedFolderId === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                    >Todas</button>
                    <button
                        onClick={() => setSelectedFolderId(null)}
                        className={`text-xs px-2 py-0.5 rounded transition ${selectedFolderId === null ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                    >Sin carpeta</button>
                    {folders.map((f) => (
                        <div key={f.id} className="group relative flex items-center">
                            <button
                                onClick={() => setSelectedFolderId(f.id)}
                                className={`text-xs px-2 py-0.5 rounded transition ${selectedFolderId === f.id ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                            >{f.name}</button>
                            {isGM && (
                                <button
                                    onClick={() => handleDeleteFolder(f.id)}
                                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-gray-900 text-red-400 hover:text-red-300 text-xs w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none"
                                    title="Eliminar carpeta"
                                >×</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Entry list */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Entradas ({visibleEntries.length})
                    </span>
                    {isGM && (
                        <button
                            onClick={openNew}
                            className="text-green-400 hover:text-green-300 text-base leading-none"
                            title="Nueva entrada"
                        >+</button>
                    )}
                </div>
                {visibleEntries.length === 0 ? (
                    <p className="text-gray-600 text-xs italic px-3 py-2">Sin entradas</p>
                ) : (
                    <ul className="space-y-0.5 px-2 pb-3">
                        {visibleEntries.map((e) => (
                            <li
                                key={e.id}
                                className="group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer transition"
                                onClick={() => setView({ mode: 'read', entry: e })}
                            >
                                <span className="flex-1 text-sm text-gray-200 truncate">{e.title}</span>
                                {e.visibility === 'gm' && (
                                    <span className="shrink-0 text-xs text-purple-400 font-bold">GM</span>
                                )}
                                {isGM && (
                                    <button
                                        onClick={(ev) => { ev.stopPropagation(); handleDeleteEntry(e.id); }}
                                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs px-0.5 leading-none transition"
                                        title="Eliminar entrada"
                                    >✕</button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
