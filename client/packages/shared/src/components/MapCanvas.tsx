import { useRef, useEffect } from 'react';
import type { Token, Scene } from '../models';

interface MapCanvasProps {
    scene: Scene;
    tokens: Token[];
    selectedTokenId?: number;
    onTokenSelect: (id: number | undefined) => void;
    onTokenMove: (tokenId: number, x: number, y: number) => void;
}

const PALETTE = ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c', '#38bdf8', '#4ade80'];

function tokenColor(id: number) {
    return PALETTE[id % PALETTE.length];
}

interface View { panX: number; panY: number; zoom: number; }

export default function MapCanvas({ scene, tokens, selectedTokenId, onTokenSelect, onTokenMove }: MapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const view = useRef<View>({ panX: 0, panY: 0, zoom: 1 });
    const localPos = useRef(new Map<number, { x: number; y: number }>());
    const dragging = useRef<{
        tokenId: number;
        grabDx: number;
        grabDy: number;
    } | null>(null);
    const panning = useRef<{
        startCx: number; startCy: number;
        startPanX: number; startPanY: number;
    } | null>(null);

    // Sync store positions → localPos (skip the token being dragged)
    useEffect(() => {
        for (const t of tokens) {
            if (dragging.current?.tokenId !== t.id) {
                localPos.current.set(t.id, { x: t.x, y: t.y });
            }
        }
    }, [tokens]);

    // ── Drawing ───────────────────────────────────────────────────────────────

    const renderPropsRef = useRef({ scene, tokens, selectedTokenId });
    renderPropsRef.current = { scene, tokens, selectedTokenId };

    const redrawRef = useRef(() => {});

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas || canvas.width === 0 || canvas.height === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { panX, panY, zoom } = view.current;
        const { scene: s, tokens: toks, selectedTokenId: sel } = renderPropsRef.current;
        const W = canvas.width;
        const H = canvas.height;
        const g = s.gridSize ?? 64;
        const gZ = g * zoom;

        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = '#1e293b';
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

        // Tokens
        const r = g * 0.42 * zoom;
        for (const token of toks) {
            const pos = localPos.current.get(token.id) ?? { x: token.x, y: token.y };
            const cx = pos.x * zoom + panX;
            const cy = pos.y * zoom + panY;
            const color = tokenColor(token.id);
            const isSelected = token.id === sel;

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
                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                ctx.font = `bold ${Math.round(r * 0.65)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(token.characterId), cx, cy);
            }
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

    // ── Hit testing ───────────────────────────────────────────────────────────

    function canvasXY(e: React.PointerEvent | WheelEvent): [number, number] {
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

    // ── Pointer handlers ──────────────────────────────────────────────────────

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        canvasRef.current!.setPointerCapture(e.pointerId);
        const [cx, cy] = canvasXY(e);
        const hit = hitTest(cx, cy);

        if (hit) {
            const pos = localPos.current.get(hit.id) ?? { x: hit.x, y: hit.y };
            const { panX, panY, zoom } = view.current;
            dragging.current = {
                tokenId: hit.id,
                grabDx: cx - (pos.x * zoom + panX),
                grabDy: cy - (pos.y * zoom + panY),
            };
            onTokenSelect(hit.id);
        } else {
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
        if (dragging.current) {
            const [cx, cy] = canvasXY(e);
            const { panX, panY, zoom } = view.current;
            const g = scene.gridSize ?? 64;
            const rawX = (cx - dragging.current.grabDx - panX) / zoom;
            const rawY = (cy - dragging.current.grabDy - panY) / zoom;
            const finalX = Math.max(0, Math.min(scene.width, Math.round(rawX / g) * g));
            const finalY = Math.max(0, Math.min(scene.height, Math.round(rawY / g) * g));

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
        const finalX = Math.max(0, Math.min(scene.width, Math.round(((cx - panX) / zoom) / g) * g));
        const finalY = Math.max(0, Math.min(scene.height, Math.round(((cy - panY) / zoom) / g) * g));

        localPos.current.set(tokenId, { x: finalX, y: finalY });
        onTokenMove(tokenId, finalX, finalY);
        requestAnimationFrame(() => redrawRef.current());
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
            style={{ display: 'block', width: '100%', height: '100%' }}
            className="touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        />
    );
}
