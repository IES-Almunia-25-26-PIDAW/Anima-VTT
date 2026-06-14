import { useRef, useEffect } from 'react';
import type { Token, Scene } from '../models';
import type { MapPing, MapArea } from '../store/state';
import { API_CONFIG } from '../config';

interface MapCanvasProps {
    scene: Scene;
    tokens: Token[];
    selectedTokenId?: number;
    currentTurnTokenId?: number;
    onTokenSelect: (id: number | undefined) => void;
    onTokenMove: (tokenId: number, x: number, y: number) => void;
    hpMap?: Record<number, [number, number]>; // tokenId → [current, max]
    currentUserId?: number;
    isGM?: boolean;
    fogOfWar?: boolean;
    revealedCells?: string[];
    fogPaintMode?: 'reveal' | 'hide' | null;
    onFogCellPaint?: (cells: string[], revealed: boolean) => void;
    portraits?: Record<number, string>; // characterId → server-relative portrait path
    rulerMode?: 'free' | 'snap';
    pings?: MapPing[];
    pingMode?: boolean;
    onPing?: (x: number, y: number) => void;
    areas?: MapArea[];
    areaMode?: 'circle' | 'rect';
    areaSnap?: 'free' | 'center' | 'corner';
    areaColor?: string;
    onAreaCreate?: (area: Omit<MapArea, 'id' | 'ownerUserId' | 'username'>) => void;
    onAreaRemove?: (areaId: string) => void;
}

const PALETTE = ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c', '#38bdf8', '#4ade80'];

function tokenColor(id: number) {
    return PALETTE[id % PALETTE.length];
}

interface View { panX: number; panY: number; zoom: number; }

export default function MapCanvas({ scene, tokens, selectedTokenId, currentTurnTokenId, onTokenSelect, onTokenMove, hpMap, currentUserId, isGM, fogOfWar, revealedCells, fogPaintMode, onFogCellPaint, portraits, rulerMode, pings, pingMode, onPing, areas, areaMode, areaSnap, areaColor, onAreaCreate, onAreaRemove }: MapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const view = useRef<View>({ panX: 0, panY: 0, zoom: 1 });
    const localPos = useRef(new Map<number, { x: number; y: number }>());
    // Always-current ref so the keydown effect (registered once) can call the latest callback
    const onTokenMoveRef = useRef(onTokenMove);
    onTokenMoveRef.current = onTokenMove;
    const onFogCellPaintRef = useRef(onFogCellPaint);
    onFogCellPaintRef.current = onFogCellPaint;
    // Tracks cells painted in the current drag stroke to batch the send
    const fogPaintedThisStroke = useRef<Set<string>>(new Set());
    const fogPainting = useRef(false);
    const dragging = useRef<{
        tokenId: number;
        grabDx: number;
        grabDy: number;
    } | null>(null);
    const panning = useRef<{
        startCx: number; startCy: number;
        startPanX: number; startPanY: number;
    } | null>(null);
    const panAnimRef = useRef<number | null>(null);
    // Exposes fitScene so it can be called on scene changes after mount
    const fitSceneRef = useRef(() => {});
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    // Reused offscreen canvas for the fog-of-war layer (avoids per-frame allocation)
    const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
    // Portrait image cache: url → HTMLImageElement (loaded) | null (loading/error)
    const portraitImgCache = useRef(new Map<string, HTMLImageElement | null>());
    // Ruler: world-space start/end, null when no line is set
    const rulerRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
    const rulerDragging = useRef(false);
    // Ping animation RAF active flag to avoid multiple loops
    const pingAnimActive = useRef(false);
    const onPingRef = useRef(onPing);
    onPingRef.current = onPing;
    // Area drawing state
    const areaDrawing = useRef(false);
    const areaPreviewRef = useRef<{ type: 'circle' | 'rect'; x: number; y: number; x2: number; y2: number; color: string } | null>(null);
    const onAreaCreateRef = useRef(onAreaCreate);
    onAreaCreateRef.current = onAreaCreate;
    const onAreaRemoveRef = useRef(onAreaRemove);
    onAreaRemoveRef.current = onAreaRemove;

    // Load background image whenever the path changes
    useEffect(() => {
        const url = scene.backgroundImagePath;
        if (!url) {
            bgImageRef.current = null;
            redrawRef.current();
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.onload = () => { if (!cancelled) { bgImageRef.current = img; redrawRef.current(); } };
        img.onerror = () => { if (!cancelled) { bgImageRef.current = null; redrawRef.current(); } };
        // Resolve server-relative paths against the API base URL
        img.src = url.startsWith('/') ? `${API_CONFIG.baseURL}${url}` : url;
        return () => { cancelled = true; };
    }, [scene.backgroundImagePath]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync store positions → localPos (skip the token being dragged)
    useEffect(() => {
        for (const t of tokens) {
            if (dragging.current?.tokenId !== t.id) {
                localPos.current.set(t.id, { x: t.x, y: t.y });
            }
        }
    }, [tokens]);

    // Clear ruler when mode is toggled off
    useEffect(() => {
        if (!rulerMode) {
            rulerRef.current = null;
            requestAnimationFrame(() => redrawRef.current());
        }
    }, [rulerMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear area preview when area mode is toggled off
    useEffect(() => {
        if (!areaMode) {
            areaDrawing.current = false;
            areaPreviewRef.current = null;
            requestAnimationFrame(() => redrawRef.current());
        }
    }, [areaMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Helpers ───────────────────────────────────────────────────────────────

    function snapToCell(wx: number, wy: number, g: number): [number, number] {
        return [Math.floor(wx / g) * g + g / 2, Math.floor(wy / g) * g + g / 2];
    }

    function snapAreaPoint(wx: number, wy: number, g: number): [number, number] {
        const snap = renderPropsRef.current.areaSnap;
        if (snap === 'center') return [Math.floor(wx / g) * g + g / 2, Math.floor(wy / g) * g + g / 2];
        if (snap === 'corner') return [Math.round(wx / g) * g, Math.round(wy / g) * g];
        return [wx, wy];
    }

    // ── Drawing ───────────────────────────────────────────────────────────────

    const renderPropsRef = useRef({ scene, tokens, selectedTokenId, currentTurnTokenId, hpMap, currentUserId, isGM, fogOfWar, revealedCells, fogPaintMode, portraits, rulerMode, pings, pingMode, areas, areaMode, areaSnap, areaColor });
    renderPropsRef.current = { scene, tokens, selectedTokenId, currentTurnTokenId, hpMap, currentUserId, isGM, fogOfWar, revealedCells, fogPaintMode, portraits, rulerMode, pings, pingMode, areas, areaMode, areaSnap, areaColor };

    const redrawRef = useRef(() => {});

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas || canvas.width === 0 || canvas.height === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { panX, panY, zoom } = view.current;
        const { scene: s, tokens: toks, selectedTokenId: sel, currentTurnTokenId: activeTurnId, hpMap: hp, isGM: gm, fogOfWar: fog, currentUserId: uid, revealedCells: revealed, fogPaintMode: paintMode, portraits: portraitsMap, pings: activePings, rulerMode: rMode } = renderPropsRef.current;
        const W = canvas.width;
        const H = canvas.height;
        const g = s.gridSize ?? 64;
        const gZ = g * zoom;

        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);

        // Scene background image
        const bgImg = bgImageRef.current;
        if (bgImg) {
            ctx.drawImage(bgImg, panX, panY, s.width * zoom, s.height * zoom);
        }

        // Grid
        ctx.strokeStyle = bgImg ? 'rgba(0,0,0,0.35)' : '#1e293b';
        ctx.lineWidth = 1;
        const ox = ((panX % gZ) + gZ) % gZ;
        const oy = ((panY % gZ) + gZ) % gZ;
        for (let x = ox - gZ; x < W + gZ; x += gZ) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = oy - gZ; y < H + gZ; y += gZ) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Scene border
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(panX, panY, s.width * zoom, s.height * zoom);

        // Areas (drawn before fog so fog can obscure them for players)
        const { areas: areaList, areaColor: aCl } = renderPropsRef.current;
        const areaPreview = areaPreviewRef.current;
        type AreaEntry = { type: 'circle' | 'rect'; x: number; y: number; x2: number; y2: number; color: string };
        const allAreas: AreaEntry[] = [
            ...(areaList ?? []),
            ...(areaPreview ? [areaPreview] : []),
        ];
        for (const area of allAreas) {
            const ax = area.x * zoom + panX;
            const ay = area.y * zoom + panY;
            const bx = area.x2 * zoom + panX;
            const by = area.y2 * zoom + panY;
            ctx.save();
            if (area.type === 'circle') {
                const radius = Math.hypot(bx - ax, by - ay);
                ctx.beginPath();
                ctx.arc(ax, ay, radius, 0, Math.PI * 2);
                ctx.fillStyle = area.color;
                ctx.globalAlpha = 0.18;
                ctx.fill();
                ctx.globalAlpha = 0.85;
                ctx.strokeStyle = area.color;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                // Center dot
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = area.color;
                ctx.beginPath();
                ctx.arc(ax, ay, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const rx = Math.min(ax, bx);
                const ry = Math.min(ay, by);
                const rw = Math.abs(bx - ax);
                const rh = Math.abs(by - ay);
                ctx.fillStyle = area.color;
                ctx.globalAlpha = 0.18;
                ctx.fillRect(rx, ry, rw, rh);
                ctx.globalAlpha = 0.85;
                ctx.strokeStyle = area.color;
                ctx.lineWidth = 2.5;
                ctx.strokeRect(rx, ry, rw, rh);
            }
            ctx.restore();
        }
        void aCl; // suppress unused warning — stored in renderPropsRef for pointer handlers

        // Fog of war — non-GM players see darkness; GM in paint mode sees a semi-transparent tint
        if (fog) {
            let fogCanvas = fogCanvasRef.current;
            if (!fogCanvas || fogCanvas.width !== W || fogCanvas.height !== H) {
                fogCanvas = document.createElement('canvas');
                fogCanvas.width = W;
                fogCanvas.height = H;
                fogCanvasRef.current = fogCanvas;
            }
            const fCtx = fogCanvas.getContext('2d')!;
            fCtx.clearRect(0, 0, W, H);

            fCtx.globalCompositeOperation = 'source-over';
            // GM in paint mode: faint tint so they can see what they're painting
            fCtx.fillStyle = gm ? 'rgba(30, 10, 80, 0.35)' : 'rgba(0, 0, 0, 0.88)';
            fCtx.fillRect(0, 0, W, H);

            fCtx.globalCompositeOperation = 'destination-out';

            // Cut holes for GM-revealed cells
            if (revealed) {
                for (const key of revealed) {
                    const [cx, cy] = key.split(',').map(Number);
                    const px = cx * gZ + panX;
                    const py = cy * gZ + panY;
                    fCtx.fillStyle = 'rgba(0,0,0,1)';
                    fCtx.fillRect(px, py, gZ, gZ);
                }
            }

            // Cut vision circles for player-owned tokens (players only)
            if (!gm) {
                const visionR = 5 * gZ;
                for (const token of toks) {
                    if (token.ownerUserId !== uid) continue;
                    const pos = localPos.current.get(token.id) ?? { x: token.x, y: token.y };
                    const tcx = pos.x * zoom + panX;
                    const tcy = pos.y * zoom + panY;
                    const grad = fCtx.createRadialGradient(tcx, tcy, visionR * 0.45, tcx, tcy, visionR);
                    grad.addColorStop(0, 'rgba(0,0,0,1)');
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    fCtx.fillStyle = grad;
                    fCtx.beginPath();
                    fCtx.arc(tcx, tcy, visionR, 0, Math.PI * 2);
                    fCtx.fill();
                }
            }

            fCtx.globalCompositeOperation = 'source-over';
            ctx.drawImage(fogCanvas, 0, 0);

            // Paint mode cursor hint for GM: highlight the cell under the pointer
            if (gm && paintMode) {
                ctx.strokeStyle = paintMode === 'reveal' ? 'rgba(99,255,99,0.8)' : 'rgba(255,99,99,0.8)';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 3]);
                // Cursor cell is drawn via pointer move — we just set the style here
                ctx.setLineDash([]);
            }
        }

        // Tokens
        const r = g * 0.42 * zoom;
        for (const token of toks) {
            const pos = localPos.current.get(token.id) ?? { x: token.x, y: token.y };
            const cx = pos.x * zoom + panX;
            const cy = pos.y * zoom + panY;
            const color = tokenColor(token.id);
            const isSelected = token.id === sel;

            // Token auras — drawn behind everything else on this token
            if (token.auras && token.auras.length > 0) {
                for (const aura of token.auras) {
                    const aw = aura.size * gZ;
                    const ah = (aura.sizeH ?? aura.size) * gZ;
                    ctx.save();
                    ctx.strokeStyle = aura.color;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 3]);
                    if (aura.type === 'circle') {
                        ctx.beginPath();
                        ctx.arc(cx, cy, aw, 0, Math.PI * 2);
                        ctx.fillStyle = aura.color;
                        ctx.globalAlpha = 0.12;
                        ctx.fill();
                        ctx.globalAlpha = 0.8;
                        ctx.stroke();
                        if (aura.label) {
                            ctx.setLineDash([]);
                            ctx.globalAlpha = 0.9;
                            ctx.font = 'bold 10px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillStyle = aura.color;
                            ctx.fillText(aura.label, cx, cy - aw - 3);
                        }
                    } else {
                        ctx.fillStyle = aura.color;
                        ctx.globalAlpha = 0.12;
                        ctx.fillRect(cx - aw, cy - ah, aw * 2, ah * 2);
                        ctx.globalAlpha = 0.8;
                        ctx.strokeRect(cx - aw, cy - ah, aw * 2, ah * 2);
                        if (aura.label) {
                            ctx.setLineDash([]);
                            ctx.globalAlpha = 0.9;
                            ctx.font = 'bold 10px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillStyle = aura.color;
                            ctx.fillText(aura.label, cx, cy - ah - 3);
                        }
                    }
                    ctx.restore();
                }
            }

            // Active turn indicator — drawn first so other rings sit on top
            if (activeTurnId != null && token.id === activeTurnId) {
                ctx.beginPath();
                ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
                ctx.setLineDash([8, 4]);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (isSelected) {
                ctx.beginPath();
                ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (r > 10) {
                const portraitPath = portraitsMap?.[token.characterId];
                const portraitUrl = portraitPath ? `${API_CONFIG.baseURL}${portraitPath}` : null;
                const cachedImg = portraitUrl != null ? portraitImgCache.current.get(portraitUrl) : undefined;

                if (portraitUrl != null && cachedImg === undefined) {
                    portraitImgCache.current.set(portraitUrl, null);
                    const img = new Image();
                    img.onload = () => {
                        portraitImgCache.current.set(portraitUrl, img);
                        requestAnimationFrame(() => redrawRef.current());
                    };
                    img.src = portraitUrl;
                }

                if (cachedImg instanceof HTMLImageElement) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(cachedImg, cx - r, cy - r, r * 2, r * 2);
                    ctx.restore();
                } else {
                    ctx.fillStyle = 'rgba(0,0,0,0.85)';
                    ctx.font = `bold ${Math.round(r * 0.65)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const label = token.characterName ? token.characterName.charAt(0).toUpperCase() : String(token.characterId);
                    ctx.fillText(label, cx, cy);
                }
            }

            // HP bar below the token circle
            const hpEntry = hp?.[token.id];
            if (hpEntry && hpEntry[1] > 0) {
                const [current, max] = hpEntry;
                const pct = Math.max(0, Math.min(1, current / max));
                const barW = r * 1.6;
                const barH = Math.max(3, r * 0.18);
                const barX = cx - barW / 2;
                const barY = cy + r + 4;
                const barColor = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';

                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

                ctx.fillStyle = '#374151';
                ctx.fillRect(barX, barY, barW, barH);

                ctx.fillStyle = barColor;
                ctx.fillRect(barX, barY, barW * pct, barH);
            }
        }

        // Ruler overlay — drawn on top of everything
        const ruler = rulerRef.current;
        if (ruler) {
            const csx = ruler.startX * zoom + panX;
            const csy = ruler.startY * zoom + panY;
            const cex = ruler.endX * zoom + panX;
            const cey = ruler.endY * zoom + panY;

            const dx = ruler.endX - ruler.startX;
            const dy = ruler.endY - ruler.startY;
            const dist = rMode === 'snap'
                ? (Math.abs(dx) + Math.abs(dy)) / g
                : Math.sqrt(dx * dx + dy * dy) / g;

            ctx.save();

            ctx.strokeStyle = rMode === 'snap' ? '#22d3ee' : '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(csx, csy);
            ctx.lineTo(cex, cey);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = rMode === 'snap' ? '#22d3ee' : '#fbbf24';
            for (const { x, y } of [{ x: csx, y: csy }, { x: cex, y: cey }]) {
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            const label = rMode === 'snap' ? `${Math.round(dist)} celdas` : `${dist.toFixed(1)} celdas`;
            const mx = (csx + cex) / 2;
            const my = (csy + cey) / 2;
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(mx - tw / 2 - 6, my - 10, tw + 12, 20);
            ctx.fillStyle = rMode === 'snap' ? '#22d3ee' : '#fbbf24';
            ctx.fillText(label, mx, my);

            ctx.restore();
        }

        // Ping markers — animated expanding rings
        const now = Date.now();
        let hasPingsThisFrame = false;
        if (activePings && activePings.length > 0) {
            for (const ping of activePings) {
                const elapsed = now - ping.startMs;
                const duration = 3000;
                if (elapsed > duration) continue;
                hasPingsThisFrame = true;
                const t = elapsed / duration;
                const px = ping.x * zoom + panX;
                const py = ping.y * zoom + panY;

                ctx.save();

                // Three expanding rings
                for (let i = 0; i < 3; i++) {
                    const ringT = (t + i / 3) % 1;
                    const alpha = Math.max(0, 1 - ringT) * (1 - t * 0.5);
                    const radius = ringT * gZ * 1.8;
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(px, py, radius, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Center dot
                ctx.globalAlpha = Math.max(0, 1 - t);
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.arc(px, py, 5, 0, Math.PI * 2);
                ctx.fill();

                // Username label
                ctx.globalAlpha = Math.min(1, (1 - t) * 3);
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                const tw = ctx.measureText(ping.username).width;
                ctx.fillStyle = 'rgba(0,0,0,0.75)';
                ctx.fillRect(px - tw / 2 - 4, py + gZ * 0.4, tw + 8, 18);
                ctx.fillStyle = '#fed7aa';
                ctx.fillText(ping.username, px, py + gZ * 0.4 + 2);

                ctx.restore();
            }
        }

        // Drive a self-sustaining RAF loop while pings are animating
        if (hasPingsThisFrame && !pingAnimActive.current) {
            pingAnimActive.current = true;
            function pingLoop() {
                if (!renderPropsRef.current.pings || renderPropsRef.current.pings.length === 0) {
                    pingAnimActive.current = false;
                    return;
                }
                redrawRef.current();
                requestAnimationFrame(pingLoop);
            }
            requestAnimationFrame(pingLoop);
        }
        if (!hasPingsThisFrame) {
            pingAnimActive.current = false;
        }
    }

    redrawRef.current = draw;

    // Redraw after every render
    useEffect(() => {
        const id = requestAnimationFrame(() => redrawRef.current());
        return () => cancelAnimationFrame(id);
    });

    // Fit scene to canvas, then start observing resizes
    useEffect(() => {
        const canvas = canvasRef.current!;

        function resize() {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }

        function fitScene() {
            const W = canvas.width;
            const H = canvas.height;
            if (W === 0 || H === 0) return;
            const { scene: s } = renderPropsRef.current;
            const zoom = Math.min(W / s.width, H / s.height) * 0.85;
            view.current = {
                zoom,
                panX: (W - s.width * zoom) / 2,
                panY: (H - s.height * zoom) / 2,
            };
        }

        fitSceneRef.current = fitScene;
        resize();
        fitScene();
        redrawRef.current();

        const ro = new ResizeObserver(() => {
            resize();
            redrawRef.current();
        });
        ro.observe(canvas);
        return () => ro.disconnect();
    }, []);

    // Re-fit the view whenever the scene itself switches (scene.id changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (panAnimRef.current) {
            cancelAnimationFrame(panAnimRef.current);
            panAnimRef.current = null;
        }
        fitSceneRef.current();
        requestAnimationFrame(() => redrawRef.current());
    }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Smooth-pan to the active turn token whenever it changes
    useEffect(() => {
        if (currentTurnTokenId == null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Skip if this token is not in the current scene (e.g. scene switched mid-combat,
        // or the token is hidden and absent from entities.tokens)
        if (!renderPropsRef.current.tokens.find((t) => t.id === currentTurnTokenId)) return;
        const pos = localPos.current.get(currentTurnTokenId);
        if (!pos || !isFinite(pos.x) || !isFinite(pos.y)) return;

        const { zoom } = view.current;
        const targetPanX = canvas.width  / 2 - pos.x * zoom;
        const targetPanY = canvas.height / 2 - pos.y * zoom;

        if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current);

        function step() {
            const dx = targetPanX - view.current.panX;
            const dy = targetPanY - view.current.panY;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                view.current.panX = targetPanX;
                view.current.panY = targetPanY;
                redrawRef.current();
                panAnimRef.current = null;
                return;
            }
            view.current.panX += dx * 0.12;
            view.current.panY += dy * 0.12;
            redrawRef.current();
            panAnimRef.current = requestAnimationFrame(step);
        }
        panAnimRef.current = requestAnimationFrame(step);
    }, [currentTurnTokenId]);

    // Arrow-key movement for the selected token
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            // Don't steal keys from text inputs
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            const { selectedTokenId: sel, scene: s, tokens: toks, currentUserId: uid, isGM: gm } = renderPropsRef.current;
            if (sel == null) return;
            const selToken = toks.find((t) => t.id === sel);
            if (selToken && !gm && selToken.ownerUserId !== uid) return;

            const g = s.gridSize ?? 64;
            let dx = 0, dy = 0;
            if (e.key === 'ArrowLeft')  dx = -g;
            else if (e.key === 'ArrowRight') dx = g;
            else if (e.key === 'ArrowUp')    dy = -g;
            else if (e.key === 'ArrowDown')  dy = g;
            else return;

            e.preventDefault();

            const tokenId = sel as number;
            const pos = localPos.current.get(tokenId) ?? { x: 0, y: 0 };
            const rawX = pos.x + dx;
            const rawY = pos.y + dy;
            const finalX = Math.max(g / 2, Math.min(s.width  - g / 2, Math.floor(rawX / g) * g + g / 2));
            const finalY = Math.max(g / 2, Math.min(s.height - g / 2, Math.floor(rawY / g) * g + g / 2));

            localPos.current.set(tokenId, { x: finalX, y: finalY });
            onTokenMoveRef.current(tokenId, finalX, finalY);
            requestAnimationFrame(() => redrawRef.current());
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ── Area hit testing ──────────────────────────────────────────────────────

    function hitTestArea(cx: number, cy: number): MapArea | null {
        const { panX, panY, zoom } = view.current;
        const { areas: areaList } = renderPropsRef.current;
        if (!areaList || areaList.length === 0) return null;
        const wx = (cx - panX) / zoom;
        const wy = (cy - panY) / zoom;
        for (let i = areaList.length - 1; i >= 0; i--) {
            const a = areaList[i];
            if (a.type === 'circle') {
                if (Math.hypot(wx - a.x, wy - a.y) <= Math.hypot(a.x2 - a.x, a.y2 - a.y)) return a;
            } else {
                if (wx >= Math.min(a.x, a.x2) && wx <= Math.max(a.x, a.x2) &&
                    wy >= Math.min(a.y, a.y2) && wy <= Math.max(a.y, a.y2)) return a;
            }
        }
        return null;
    }

    // ── Hit testing ───────────────────────────────────────────────────────────

    function canvasXY(e: { clientX: number; clientY: number }): [number, number] {
        const rect = canvasRef.current!.getBoundingClientRect();
        // Scale from CSS pixels to canvas pixels
        const scaleX = canvasRef.current!.width / rect.width;
        const scaleY = canvasRef.current!.height / rect.height;
        return [
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY,
        ];
    }

    function hitTest(cx: number, cy: number): Token | null {
        const { panX, panY, zoom } = view.current;
        const g = scene.gridSize ?? 64;
        // Use a generously sized hit zone (half grid cell)
        const hitR = g * 0.5 * zoom;
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            const pos = localPos.current.get(t.id) ?? { x: t.x, y: t.y };
            const tx = pos.x * zoom + panX;
            const ty = pos.y * zoom + panY;
            if (Math.hypot(cx - tx, cy - ty) <= hitR) return t;
        }
        return null;
    }

    // ── Fog paint helpers ─────────────────────────────────────────────────────

    function canvasToCellKey(cx: number, cy: number): string {
        const { panX, panY, zoom } = view.current;
        const g = renderPropsRef.current.scene.gridSize ?? 64;
        const gZ = g * zoom;
        const cellX = Math.floor((cx - panX) / gZ);
        const cellY = Math.floor((cy - panY) / gZ);
        return `${cellX},${cellY}`;
    }

    function paintFogCell(cx: number, cy: number) {
        const { fogPaintMode: mode } = renderPropsRef.current;
        if (!mode) return;
        const key = canvasToCellKey(cx, cy);
        if (fogPaintedThisStroke.current.has(key)) return;
        fogPaintedThisStroke.current.add(key);
        onFogCellPaintRef.current?.([key], mode === 'reveal');
    }

    // ── Pointer handlers ──────────────────────────────────────────────────────

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        canvasRef.current!.setPointerCapture(e.pointerId);
        const [cx, cy] = canvasXY(e);

        // Ping mode: drop a ping on click
        if (renderPropsRef.current.pingMode) {
            const { panX, panY, zoom } = view.current;
            const wx = (cx - panX) / zoom;
            const wy = (cy - panY) / zoom;
            onPingRef.current?.(wx, wy);
            return;
        }

        // Ruler mode intercepts all pointer input
        if (renderPropsRef.current.rulerMode) {
            const { panX, panY, zoom } = view.current;
            const g = renderPropsRef.current.scene.gridSize ?? 64;
            let wx = (cx - panX) / zoom;
            let wy = (cy - panY) / zoom;
            if (renderPropsRef.current.rulerMode === 'snap') [wx, wy] = snapToCell(wx, wy, g);
            rulerRef.current = { startX: wx, startY: wy, endX: wx, endY: wy };
            rulerDragging.current = true;
            requestAnimationFrame(() => redrawRef.current());
            return;
        }

        // Area mode: start drawing a new area
        if (renderPropsRef.current.areaMode) {
            const { panX, panY, zoom } = view.current;
            const g = renderPropsRef.current.scene.gridSize ?? 64;
            const [sx, sy] = snapAreaPoint((cx - panX) / zoom, (cy - panY) / zoom, g);
            areaPreviewRef.current = {
                type: renderPropsRef.current.areaMode,
                x: sx, y: sy, x2: sx, y2: sy,
                color: renderPropsRef.current.areaColor ?? '#ef4444',
            };
            areaDrawing.current = true;
            requestAnimationFrame(() => redrawRef.current());
            return;
        }

        // Fog paint mode intercepts all pointer input
        if (renderPropsRef.current.fogPaintMode) {
            fogPainting.current = true;
            fogPaintedThisStroke.current = new Set();
            paintFogCell(cx, cy);
            return;
        }

        const hit = hitTest(cx, cy);

        if (hit) {
            const { currentUserId: uid, isGM: gm } = renderPropsRef.current;
            const canDrag = gm || hit.ownerUserId === uid;
            const pos = localPos.current.get(hit.id) ?? { x: hit.x, y: hit.y };
            const { panX, panY, zoom } = view.current;
            if (canDrag) {
                dragging.current = {
                    tokenId: hit.id,
                    grabDx: cx - (pos.x * zoom + panX),
                    grabDy: cy - (pos.y * zoom + panY),
                };
            }
            onTokenSelect(hit.id);
        } else {
            if (panAnimRef.current) {
                cancelAnimationFrame(panAnimRef.current);
                panAnimRef.current = null;
            }
            panning.current = {
                startCx: cx, startCy: cy,
                startPanX: view.current.panX,
                startPanY: view.current.panY,
            };
            onTokenSelect(undefined);
        }
    }

    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
        const [cx, cy] = canvasXY(e);

        if (rulerDragging.current && rulerRef.current) {
            const { panX, panY, zoom } = view.current;
            const g = renderPropsRef.current.scene.gridSize ?? 64;
            let endX = (cx - panX) / zoom;
            let endY = (cy - panY) / zoom;
            if (renderPropsRef.current.rulerMode === 'snap') [endX, endY] = snapToCell(endX, endY, g);
            rulerRef.current = { ...rulerRef.current, endX, endY };
            requestAnimationFrame(() => redrawRef.current());
            return;
        }

        if (areaDrawing.current && areaPreviewRef.current) {
            const { panX, panY, zoom } = view.current;
            const g = renderPropsRef.current.scene.gridSize ?? 64;
            const [ex, ey] = snapAreaPoint((cx - panX) / zoom, (cy - panY) / zoom, g);
            areaPreviewRef.current = { ...areaPreviewRef.current, x2: ex, y2: ey };
            requestAnimationFrame(() => redrawRef.current());
            return;
        }

        if (fogPainting.current) {
            paintFogCell(cx, cy);
            return;
        }

        if (dragging.current) {
            const { panX, panY, zoom } = view.current;
            const wx = (cx - dragging.current.grabDx - panX) / zoom;
            const wy = (cy - dragging.current.grabDy - panY) / zoom;
            localPos.current.set(dragging.current.tokenId, { x: wx, y: wy });
            requestAnimationFrame(() => redrawRef.current());
        } else if (panning.current) {
            view.current.panX = panning.current.startPanX + (cx - panning.current.startCx);
            view.current.panY = panning.current.startPanY + (cy - panning.current.startCy);
            requestAnimationFrame(() => redrawRef.current());
        }
    }

    function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
        if (rulerDragging.current) {
            rulerDragging.current = false;
            rulerRef.current = null;
            requestAnimationFrame(() => redrawRef.current());
            return;
        }

        if (areaDrawing.current && areaPreviewRef.current) {
            const preview = { ...areaPreviewRef.current };
            areaDrawing.current = false;
            areaPreviewRef.current = null;
            const g = scene.gridSize ?? 64;
            const dx = Math.abs(preview.x2 - preview.x);
            const dy = Math.abs(preview.y2 - preview.y);
            const valid = preview.type === 'circle'
                ? Math.hypot(dx, dy) >= g / 4
                : dx >= g / 4 && dy >= g / 4;
            if (valid) onAreaCreateRef.current?.(preview);
            requestAnimationFrame(() => redrawRef.current());
            return;
        }

        if (fogPainting.current) {
            fogPainting.current = false;
            fogPaintedThisStroke.current = new Set();
            return;
        }

        if (dragging.current) {
            const [cx, cy] = canvasXY(e);
            const { panX, panY, zoom } = view.current;
            const g = scene.gridSize ?? 64;
            const rawX = (cx - dragging.current.grabDx - panX) / zoom;
            const rawY = (cy - dragging.current.grabDy - panY) / zoom;
            const finalX = Math.max(g / 2, Math.min(scene.width - g / 2, Math.floor(rawX / g) * g + g / 2));
            const finalY = Math.max(g / 2, Math.min(scene.height - g / 2, Math.floor(rawY / g) * g + g / 2));

            localPos.current.set(dragging.current.tokenId, { x: finalX, y: finalY });
            onTokenMove(dragging.current.tokenId, finalX, finalY);
            dragging.current = null;
            requestAnimationFrame(() => redrawRef.current());
        }
        panning.current = null;
    }

    function handleDragOver(e: React.DragEvent<HTMLCanvasElement>) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(e: React.DragEvent<HTMLCanvasElement>) {
        e.preventDefault();
        const tokenId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(tokenId)) return;

        const rect = canvasRef.current!.getBoundingClientRect();
        const scaleX = canvasRef.current!.width / rect.width;
        const scaleY = canvasRef.current!.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const { panX, panY, zoom } = view.current;
        const g = scene.gridSize ?? 64;
        const rawX = (cx - panX) / zoom;
        const rawY = (cy - panY) / zoom;
        const finalX = Math.max(g / 2, Math.min(scene.width - g / 2, Math.floor(rawX / g) * g + g / 2));
        const finalY = Math.max(g / 2, Math.min(scene.height - g / 2, Math.floor(rawY / g) * g + g / 2));

        localPos.current.set(tokenId, { x: finalX, y: finalY });
        onTokenMove(tokenId, finalX, finalY);
        requestAnimationFrame(() => redrawRef.current());
    }

    function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
        if (!renderPropsRef.current.areaMode) return;
        e.preventDefault();
        const [cx, cy] = canvasXY(e);
        const hit = hitTestArea(cx, cy);
        if (!hit) return;
        const { currentUserId: uid, isGM: gm } = renderPropsRef.current;
        if (gm || hit.ownerUserId === uid) {
            onAreaRemoveRef.current?.(hit.id);
        }
    }

    function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
        e.preventDefault();
        const [cx, cy] = canvasXY(e);
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = Math.max(0.1, Math.min(5, view.current.zoom * factor));
        view.current.panX = cx - (cx - view.current.panX) * (newZoom / view.current.zoom);
        view.current.panY = cy - (cy - view.current.panY) * (newZoom / view.current.zoom);
        view.current.zoom = newZoom;
        requestAnimationFrame(() => redrawRef.current());
    }

    return (
        <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: pingMode || rulerMode || areaMode ? 'crosshair' : fogPaintMode === 'reveal' ? 'cell' : fogPaintMode === 'hide' ? 'not-allowed' : undefined }}
            className="touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        />
    );
}
