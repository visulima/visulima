/** @jsxImportSource preact */
/* eslint-disable max-lines */
import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { originalSetTimeout } from "../inspector/freeze-animations";
import AnnotationPopup from "./annotation-popup";
import { Skeleton } from "./skeletons";
import { computeSnap, type SnapGuide as Guide, type SnapRect } from "./snap";
import { COMPONENT_MAP, DEFAULT_SIZES, type ComponentType, type DesignPlacement } from "./types";

const MIN_SIZE = 24;

type HandleDir = "e" | "n" | "ne" | "nw" | "s" | "se" | "sw" | "w";

interface DesignModeProps {
    activeComponent: ComponentType | null;
    className?: string;
    clearSignal?: number;
    deselectSignal?: number;
    exiting?: boolean;
    extraSnapRects?: SnapRect[];
    isDarkMode: boolean;
    onActiveComponentChange: (type: ComponentType | null) => void;
    onChange: (placements: DesignPlacement[]) => void;
    onDragEnd?: (dx: number, dy: number, committed: boolean) => void;
    onDragMove?: (dx: number, dy: number) => void;
    onInteractionChange?: (active: boolean) => void;
    onSelectionChange?: (selectedIds: Set<string>, isShift: boolean) => void;
    passthrough?: boolean;
    placements: DesignPlacement[];
    wireframe?: boolean;
}

const generateId = (): string => `dp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const TEXT_PLACEHOLDERS: Partial<Record<ComponentType, string>> = {
    alert: "Alert message",
    badge: "Badge label",
    banner: "Banner text",
    breadcrumb: "Breadcrumb",
    button: "Button label",
    card: "Card title",
    cta: "Call to action text",
    hero: "Headline text",
    input: "Placeholder text",
    modal: "Dialog title",
    navigation: "Brand / nav items",
    notification: "Notification message",
    pricing: "Plan name or price",
    productCard: "Product name",
    search: "Search placeholder",
    stat: "Metric value",
    tabs: "Tab labels",
    tag: "Tag label",
    testimonial: "Quote text",
    toast: "Notification message",
};

const cornerHandles: HandleDir[] = ["nw", "ne", "se", "sw"];

export const DesignMode = ({
    activeComponent,
    className: extraClassName,
    clearSignal,
    deselectSignal,
    exiting,
    extraSnapRects,
    isDarkMode,
    onActiveComponentChange,
    onChange,
    onDragEnd,
    onDragMove,
    onInteractionChange,
    onSelectionChange,
    passthrough,
    placements,
    wireframe,
}: DesignModeProps): JSX.Element => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [drawBox, setDrawBox] = useState<{ h: number; w: number; x: number; y: number } | null>(null);
    const [selectBox, setSelectBox] = useState<{ h: number; w: number; x: number; y: number } | null>(null);
    const [sizeIndicator, setSizeIndicator] = useState<{ text: string; x: number; y: number } | null>(null);
    const [guides, setGuides] = useState<Guide[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editExiting, setEditExiting] = useState(false);
    const editHadTextRef = useRef(false);
    const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
    const lastAnnotationTextRef = useRef<Map<string, string>>(new Map());
    const interactionRef = useRef<string | null>(null);
    const placementsRef = useRef(placements);

    placementsRef.current = placements;
    const onSelectionChangeRef = useRef(onSelectionChange);

    onSelectionChangeRef.current = onSelectionChange;
    const onDragMoveRef = useRef(onDragMove);

    onDragMoveRef.current = onDragMove;
    const onDragEndRef = useRef(onDragEnd);

    onDragEndRef.current = onDragEnd;

    const deselectRef = useRef(deselectSignal);

    useEffect(() => {
        if (deselectSignal !== deselectRef.current) {
            deselectRef.current = deselectSignal;
            setSelectedIds(new Set());
        }
    }, [deselectSignal]);

    const clearRef = useRef(clearSignal);

    useEffect(() => {
        if (clearSignal !== undefined && clearSignal !== clearRef.current) {
            clearRef.current = clearSignal;

            const allIds = new Set(placementsRef.current.map((p) => p.id));

            if (allIds.size > 0) {
                setExitingIds(allIds);
                setSelectedIds(new Set());
                interactionRef.current = null;
                originalSetTimeout(() => {
                    onChange([]);
                    setExitingIds(new Set());
                }, 180);
            }
        }
    }, [clearSignal, onChange]);

    useEffect(() => {
        const handleKeyDown = (event_: KeyboardEvent): void => {
            const target = event_.target as HTMLElement;
            const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

            if (isTyping) {
                return;
            }

            if ((event_.key === "Backspace" || event_.key === "Delete") && selectedIds.size > 0) {
                event_.preventDefault();

                const toDelete = new Set(selectedIds);

                setExitingIds(toDelete);
                setSelectedIds(new Set());
                originalSetTimeout(() => {
                    onChange(placementsRef.current.filter((p) => !toDelete.has(p.id)));
                    setExitingIds(new Set());
                }, 180);

                return;
            }

            if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event_.key) && selectedIds.size > 0) {
                event_.preventDefault();

                const step = event_.shiftKey ? 20 : 1;
                const dx = event_.key === "ArrowLeft" ? -step : event_.key === "ArrowRight" ? step : 0;
                const dy = event_.key === "ArrowUp" ? -step : event_.key === "ArrowDown" ? step : 0;

                onChange(
                    placements.map((p) =>
                        (selectedIds.has(p.id) ? { ...p, x: Math.max(0, p.x + dx), y: Math.max(0, p.y + dy) } : p)),
                );

                return;
            }

            if (event_.key === "Escape") {
                if (activeComponent) {
                    onActiveComponentChange(null);
                } else if (selectedIds.size > 0) {
                    setSelectedIds(new Set());
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [selectedIds, activeComponent, placements, onChange, onActiveComponentChange]);

    const handleOverlayMouseDown = useCallback(
        (event_: JSX.TargetedMouseEvent<HTMLDivElement>) => {
            if (event_.button !== 0 || passthrough) {
                return;
            }

            const target = event_.target as HTMLElement;

            if (target.closest("[data-design-placement]")) {
                return;
            }

            event_.preventDefault();
            event_.stopPropagation();

            const { scrollY } = window;
            const startX = event_.clientX;
            const startY = event_.clientY;

            if (activeComponent) {
                interactionRef.current = "place";
                onInteractionChange?.(true);

                let isDrag = false;
                let endX = startX;
                let endY = startY;

                const onMove = (event_v: MouseEvent): void => {
                    endX = event_v.clientX;
                    endY = event_v.clientY;

                    const dx = Math.abs(endX - startX);
                    const dy = Math.abs(endY - startY);

                    if (dx > 5 || dy > 5) {
                        isDrag = true;
                    }

                    if (isDrag) {
                        const x = Math.min(startX, endX);
                        const y = Math.min(startY, endY);
                        const w = Math.abs(endX - startX);
                        const h = Math.abs(endY - startY);

                        setDrawBox({ h, w, x, y });
                        setSizeIndicator({ text: `${Math.round(w)} × ${Math.round(h)}`, x: event_v.clientX + 12, y: event_v.clientY + 12 });
                    }
                };

                const onUp = (): void => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                    setDrawBox(null);
                    setSizeIndicator(null);
                    interactionRef.current = null;
                    onInteractionChange?.(false);

                    const def = DEFAULT_SIZES[activeComponent];
                    let x: number;
                    let y: number;
                    let w: number;
                    let h: number;

                    if (isDrag) {
                        x = Math.min(startX, endX);
                        y = Math.min(startY, endY) + scrollY;
                        w = Math.max(MIN_SIZE, Math.abs(endX - startX));
                        h = Math.max(MIN_SIZE, Math.abs(endY - startY));
                    } else {
                        w = def.width;
                        h = def.height;
                        x = startX - w / 2;
                        y = startY + scrollY - h / 2;
                    }

                    x = Math.max(0, x);
                    y = Math.max(0, y);

                    const placement: DesignPlacement = {
                        height: h,
                        id: generateId(),
                        scrollY,
                        timestamp: Date.now(),
                        type: activeComponent,
                        width: w,
                        x,
                        y,
                    };

                    onChange([...placements, placement]);
                    setSelectedIds(new Set([placement.id]));
                    onActiveComponentChange(null);
                };

                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
            } else {
                if (!event_.shiftKey) {
                    setSelectedIds(new Set());
                }

                interactionRef.current = "select";

                let isDrag = false;

                const onMove = (event_v: MouseEvent): void => {
                    const dx = Math.abs(event_v.clientX - startX);
                    const dy = Math.abs(event_v.clientY - startY);

                    if (dx > 4 || dy > 4) {
                        isDrag = true;
                    }

                    if (isDrag) {
                        const x = Math.min(startX, event_v.clientX);
                        const y = Math.min(startY, event_v.clientY);

                        setSelectBox({ h: Math.abs(event_v.clientY - startY), w: Math.abs(event_v.clientX - startX), x, y });
                    }
                };

                const onUp = (event_v: MouseEvent): void => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                    interactionRef.current = null;

                    if (isDrag) {
                        const boxX = Math.min(startX, event_v.clientX);
                        const boxY = Math.min(startY, event_v.clientY) + scrollY;
                        const boxW = Math.abs(event_v.clientX - startX);
                        const boxH = Math.abs(event_v.clientY - startY);
                        const newSelected = new Set(event_.shiftKey ? selectedIds : new Set<string>());

                        for (const p of placements) {
                            if (p.x + p.width > boxX && p.x < boxX + boxW && p.y + p.height > boxY && p.y < boxY + boxH) {
                                newSelected.add(p.id);
                            }
                        }

                        setSelectedIds(newSelected);
                    }

                    setSelectBox(null);
                };

                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
            }
        },
        [activeComponent, passthrough, placements, onChange, selectedIds, onInteractionChange, onActiveComponentChange],
    );

    const handlePlacementMouseDown = useCallback(
        (event_: JSX.TargetedMouseEvent<HTMLDivElement>, id: string) => {
            if (event_.button !== 0) {
                return;
            }

            const target = event_.target as HTMLElement;

            if (target.closest("[data-vdt-handle]") || target.closest("[data-vdt-delete]") || target.closest("[data-vdt-edge]")) {
                return;
            }

            event_.preventDefault();
            event_.stopPropagation();

            let newSelected: Set<string>;

            if (event_.shiftKey) {
                newSelected = new Set(selectedIds);

                if (newSelected.has(id)) {
                    newSelected.delete(id);
                } else {
                    newSelected.add(id);
                }
            } else if (selectedIds.has(id)) {
                newSelected = new Set(selectedIds);
            } else {
                newSelected = new Set([id]);
            }

            setSelectedIds(newSelected);

            const changed = newSelected.size !== selectedIds.size || [...newSelected].some((x) => !selectedIds.has(x));

            if (changed) {
                onSelectionChangeRef.current?.(newSelected, event_.shiftKey);
            }

            const startX = event_.clientX;
            const startY = event_.clientY;
            const startPositions = new Map<string, { x: number; y: number }>();

            for (const p of placements) {
                if (newSelected.has(p.id)) {
                    startPositions.set(p.id, { x: p.x, y: p.y });
                }
            }

            interactionRef.current = "move";
            onInteractionChange?.(true);

            let moved = false;
            let duplicated = false;
            let basePlacements = placements;
            let lastSnappedDx = 0;
            let lastSnappedDy = 0;
            const selSizes = new Map<string, { h: number; w: number }>();

            for (const p of placements) {
                if (startPositions.has(p.id)) {
                    selSizes.set(p.id, { h: p.height, w: p.width });
                }
            }

            const onMove = (event_v: MouseEvent): void => {
                const dx = event_v.clientX - startX;
                const dy = event_v.clientY - startY;

                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    moved = true;
                }

                if (!moved) {
                    return;
                }

                if (event_v.altKey && !duplicated) {
                    duplicated = true;
                    const clones: DesignPlacement[] = [];

                    for (const p of placements) {
                        if (startPositions.has(p.id)) {
                            clones.push({ ...p, id: generateId(), timestamp: Date.now() });
                        }
                    }

                    basePlacements = [...placements, ...clones];
                }

                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;

                for (const [id_, start] of startPositions) {
                    const sz = selSizes.get(id_);

                    if (!sz) {
                        continue;
                    }

                    minX = Math.min(minX, start.x + dx);
                    minY = Math.min(minY, start.y + dy);
                    maxX = Math.max(maxX, start.x + dx + sz.w);
                    maxY = Math.max(maxY, start.y + dy + sz.h);
                }

                const selRect = { height: maxY - minY, width: maxX - minX, x: minX, y: minY };
                const { dx: snapDx, dy: snapDy, guides: newGuides } = computeSnap(selRect, {
                    excludeIds: new Set(startPositions.keys()),
                    extraRects: extraSnapRects,
                    others: basePlacements,
                });

                setGuides(newGuides);

                const snappedDx = dx + snapDx;
                const snappedDy = dy + snapDy;

                lastSnappedDx = snappedDx;
                lastSnappedDy = snappedDy;
                onChange(
                    basePlacements.map((p) => {
                        const start = startPositions.get(p.id);

                        if (!start) {
                            return p;
                        }

                        return { ...p, x: Math.max(0, start.x + snappedDx), y: Math.max(0, start.y + snappedDy) };
                    }),
                );
                onDragMoveRef.current?.(snappedDx, snappedDy);
            };

            const onUp = (): void => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
                interactionRef.current = null;
                onInteractionChange?.(false);
                setGuides([]);
                onDragEndRef.current?.(lastSnappedDx, lastSnappedDy, moved);
            };

            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        },
        [selectedIds, placements, onChange, onInteractionChange, extraSnapRects],
    );

    const handleResizeMouseDown = useCallback(
        (event_: JSX.TargetedMouseEvent<HTMLDivElement>, id: string, dir: HandleDir) => {
            event_.preventDefault();
            event_.stopPropagation();

            const comp = placements.find((p) => p.id === id);

            if (!comp) {
                return;
            }

            setSelectedIds(new Set([id]));
            interactionRef.current = "resize";
            onInteractionChange?.(true);

            const startX = event_.clientX;
            const startY = event_.clientY;
            const startW = comp.width;
            const startH = comp.height;
            const startLeft = comp.x;
            const startTop = comp.y;
            const activeEdges = {
                bottom: dir.includes("s"),
                left: dir.includes("w"),
                right: dir.includes("e"),
                top: dir.includes("n"),
            };

            const onMove = (event_v: MouseEvent): void => {
                const dx = event_v.clientX - startX;
                const dy = event_v.clientY - startY;
                let nw = startW;
                let nh = startH;
                let nx = startLeft;
                let ny = startTop;

                if (dir.includes("e")) {
                    nw = Math.max(MIN_SIZE, startW + dx);
                }

                if (dir.includes("w")) {
                    nw = Math.max(MIN_SIZE, startW - dx);
                    nx = startLeft + startW - nw;
                }

                if (dir.includes("s")) {
                    nh = Math.max(MIN_SIZE, startH + dy);
                }

                if (dir.includes("n")) {
                    nh = Math.max(MIN_SIZE, startH - dy);
                    ny = startTop + startH - nh;
                }

                const rect = { height: nh, width: nw, x: nx, y: ny };
                const { dx: snapDx, dy: snapDy, guides: newGuides } = computeSnap(rect, {
                    activeEdges,
                    excludeIds: new Set([id]),
                    extraRects: extraSnapRects,
                    others: placementsRef.current,
                });

                setGuides(newGuides);

                if (snapDx !== 0) {
                    if (activeEdges.right) {
                        nw += snapDx;
                    } else if (activeEdges.left) {
                        nx += snapDx;
                        nw -= snapDx;
                    }
                }

                if (snapDy !== 0) {
                    if (activeEdges.bottom) {
                        nh += snapDy;
                    } else if (activeEdges.top) {
                        ny += snapDy;
                        nh -= snapDy;
                    }
                }

                onChange(
                    placementsRef.current.map((p) => (p.id === id ? { ...p, height: nh, width: nw, x: nx, y: ny } : p)),
                );
                setSizeIndicator({ text: `${Math.round(nw)} × ${Math.round(nh)}`, x: event_v.clientX + 12, y: event_v.clientY + 12 });
            };

            const onUp = (): void => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
                setSizeIndicator(null);
                interactionRef.current = null;
                onInteractionChange?.(false);
                setGuides([]);
            };

            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        },
        [placements, onChange, onInteractionChange, extraSnapRects],
    );

    const handleDelete = useCallback(
        (id: string) => {
            interactionRef.current = null;
            setExitingIds((previous) => {
                const next = new Set(previous);

                next.add(id);

                return next;
            });
            setSelectedIds((previous) => {
                const next = new Set(previous);

                next.delete(id);

                return next;
            });
            originalSetTimeout(() => {
                onChange(placementsRef.current.filter((p) => p.id !== id));
                setExitingIds((previous) => {
                    const next = new Set(previous);

                    next.delete(id);

                    return next;
                });
            }, 180);
        },
        [onChange],
    );

    const handleDoubleClick = useCallback(
        (id: string) => {
            const p = placements.find((pl) => pl.id === id);

            if (!p) {
                return;
            }

            editHadTextRef.current = Boolean(p.text);
            setEditingId(id);
            setEditExiting(false);
        },
        [placements],
    );

    const dismissEdit = useCallback(() => {
        if (!editingId) {
            return;
        }

        setEditExiting(true);
        originalSetTimeout(() => {
            setEditingId(null);
            setEditExiting(false);
        }, 150);
    }, [editingId]);

    useEffect(() => {
        if (exiting && editingId) {
            dismissEdit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exiting]);

    const submitEdit = useCallback(
        (text: string) => {
            if (!editingId) {
                return;
            }

            onChange(placements.map((p) => (p.id === editingId ? { ...p, text: text.trim() || undefined } : p)));
            dismissEdit();
        },
        [editingId, placements, onChange, dismissEdit],
    );

    const scrollY = typeof window === "undefined" ? 0 : window.scrollY;
    const arrowColor = wireframe ? "#f97316" : "#3c82f7";
    const edgeHandles: { arrow: JSX.Element; dir: HandleDir }[] = [
        { arrow: <svg fill="none" height="6" viewBox="0 0 8 6" width="8"><path d="M4 0.5L1 4.5h6z" fill={arrowColor} /></svg>, dir: "n" },
        { arrow: <svg fill="none" height="8" viewBox="0 0 6 8" width="6"><path d="M5.5 4L1.5 1v6z" fill={arrowColor} /></svg>, dir: "e" },
        { arrow: <svg fill="none" height="6" viewBox="0 0 8 6" width="8"><path d="M4 5.5L1 1.5h6z" fill={arrowColor} /></svg>, dir: "s" },
        { arrow: <svg fill="none" height="8" viewBox="0 0 6 8" width="6"><path d="M0.5 4L4.5 1v6z" fill={arrowColor} /></svg>, dir: "w" },
    ];

    const overlayClass = [
        isDarkMode ? "dark" : "",
        "fixed inset-0 z-[99995] cursor-default",
        activeComponent ? "cursor-crosshair" : "",
        passthrough ? "pointer-events-none" : "pointer-events-auto",
        exiting ? "opacity-0 transition-opacity duration-200" : "opacity-100",
        wireframe ? "data-[wireframe=true]" : "",
        extraClassName ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const accentClass = wireframe ? "border-orange-500" : "border-blue-500";
    const accentBgClass = wireframe ? "bg-orange-500/10" : "bg-blue-500/10";
    const accentRingClass = wireframe ? "ring-orange-500/20" : "ring-blue-500/20";
    const labelColorClass = wireframe ? "text-orange-500" : "text-blue-500";

    return (
        <>
            <div class={overlayClass} data-feedback-toolbar data-wireframe={wireframe ? "true" : "false"} onMouseDown={handleOverlayMouseDown} style={{ animation: "vdt-lm-overlay-fade-in 0.15s ease" }}>
                {placements.map((p) => {
                    const isSelected = selectedIds.has(p.id);
                    const label = COMPONENT_MAP[p.type]?.label || p.type;
                    const screenY = p.y - scrollY;
                    const annotation = p.text || lastAnnotationTextRef.current.get(p.id) || "";

                    if (p.text) {
                        lastAnnotationTextRef.current.set(p.id, p.text);
                    }

                    const baseColor = wireframe ? "rgba(249,115,22," : "rgba(59,130,246,";
                    const placementStyle: JSX.CSSProperties = {
                        animation: exitingIds.has(p.id) ? "none" : "vdt-lm-placement-enter 0.25s cubic-bezier(0.34,1.2,0.64,1)",
                        background: `${baseColor}${isSelected ? "0.10" : "0.08"})`,
                        border: `1.5px ${isSelected ? "solid" : "dashed"} ${baseColor}${isSelected ? "1" : "0.4"})`,
                        borderRadius: 6,
                        boxShadow: isSelected ? `0 0 0 2px ${baseColor}0.15), 0 2px 8px ${baseColor}0.15)` : "0 1px 4px rgba(0,0,0,0.08)",
                        cursor: "grab",
                        height: p.height,
                        left: p.x,
                        opacity: exitingIds.has(p.id) ? 0 : 1,
                        pointerEvents: exitingIds.has(p.id) ? "none" : "auto",
                        position: "fixed",
                        top: screenY,
                        transform: exitingIds.has(p.id) ? "scale(0.97)" : "scale(1)",
                        transition: "box-shadow 0.15s, border-color 0.15s, opacity 0.2s ease, transform 0.2s cubic-bezier(0.32,0.72,0,1)",
                        userSelect: "none",
                        width: p.width,
                    };

                    return (
                        <div
                            class="group/placement"
                            data-design-placement={p.id}
                            key={p.id}
                            onDblClick={() => handleDoubleClick(p.id)}
                            onMouseDown={(event_) => handlePlacementMouseDown(event_, p.id)}
                            style={placementStyle}
                        >
                            <span
                                class={`absolute -top-[18px] left-0 text-[10px] font-semibold whitespace-nowrap pointer-events-none font-sans ${labelColorClass}`}
                                style={{ textShadow: "0 0 4px rgba(255,255,255,0.8), 0 0 8px rgba(255,255,255,0.5)" }}
                            >
                                {label}
                            </span>
                            <span
                                class="absolute -bottom-[18px] left-0 right-0 text-[10px] text-foreground/60 whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none font-sans transition-all duration-200"
                                style={{
                                    opacity: p.text ? 1 : 0,
                                    textShadow: "0 0 4px rgba(255,255,255,0.9)",
                                    transform: p.text ? "translateY(0)" : "translateY(-2px)",
                                }}
                            >
                                {annotation}
                            </span>
                            <div class="size-full overflow-hidden pointer-events-none">
                                <Skeleton height={p.height} text={p.text} type={p.type} width={p.width} />
                            </div>
                            <div
                                class={`absolute -top-2 -right-2 size-[18px] rounded-full bg-popover/90 border border-border text-foreground/40 cursor-pointer flex items-center justify-center text-[10px] z-[15] pointer-events-auto opacity-0 scale-75 transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive hover:scale-110 ${isSelected ? "opacity-100 scale-100" : "group-hover/placement:opacity-100 group-hover/placement:scale-100"}`}
                                data-vdt-delete
                                onClick={() => handleDelete(p.id)}
                                onMouseDown={(event_) => event_.stopPropagation()}
                            >
                                ✕
                            </div>
                            {cornerHandles.map((dir) => {
                                const positions: Record<typeof dir, JSX.CSSProperties> = {
                                    ne: { cursor: "ne-resize", right: -4, top: -4 },
                                    nw: { cursor: "nw-resize", left: -4, top: -4 },
                                    se: { bottom: -4, cursor: "se-resize", right: -4 },
                                    sw: { bottom: -4, cursor: "sw-resize", left: -4 },
                                } as Record<typeof dir, JSX.CSSProperties>;

                                return (
                                    <div
                                        class={`absolute size-2 bg-card border-[1.5px] ${accentClass} rounded-sm z-[12] opacity-0 scale-50 pointer-events-none transition-all duration-200 ${isSelected ? "opacity-100 scale-100 pointer-events-auto" : "group-hover/placement:opacity-100 group-hover/placement:scale-100 group-hover/placement:pointer-events-auto"}`}
                                        data-vdt-handle
                                        key={dir}
                                        onMouseDown={(event_) => handleResizeMouseDown(event_, p.id, dir)}
                                        style={positions[dir]}
                                    />
                                );
                            })}
                            {edgeHandles.map(({ arrow, dir }) => {
                                const edgeStyles: Record<typeof dir, JSX.CSSProperties> = {
                                    e: { bottom: 12, cursor: "e-resize", right: -6, top: 12, width: 12 },
                                    n: { cursor: "n-resize", height: 12, left: 12, right: 12, top: -6 },
                                    s: { bottom: -6, cursor: "s-resize", height: 12, left: 12, right: 12 },
                                    w: { bottom: 12, cursor: "w-resize", left: -6, top: 12, width: 12 },
                                } as Record<typeof dir, JSX.CSSProperties>;

                                return (
                                    <div
                                        class="group/edge absolute z-[11] flex items-center justify-center"
                                        data-vdt-edge
                                        key={dir}
                                        onMouseDown={(event_) => handleResizeMouseDown(event_, p.id, dir)}
                                        style={edgeStyles[dir]}
                                    >
                                        <span class="opacity-0 group-hover/edge:opacity-100 transition-opacity">{arrow}</span>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {editingId
                ? (() => {
                    const ep = placements.find((p) => p.id === editingId);

                    if (!ep) {
                        return null;
                    }

                    const ey = ep.y - scrollY;
                    const centerX = ep.x + ep.width / 2;
                    const aboveY = ey - 8;
                    const belowY = ey + ep.height + 8;
                    const fitsAbove = aboveY > 200;
                    const fitsBelow = belowY < window.innerHeight - 100;
                    const popupLeft = Math.max(160, Math.min(window.innerWidth - 160, centerX));
                    const popupStyle: JSX.CSSProperties = fitsAbove
                        ? { bottom: window.innerHeight - aboveY, left: popupLeft }
                        : fitsBelow
                            ? { left: popupLeft, top: belowY }
                            : { left: popupLeft, top: Math.max(80, window.innerHeight / 2 - 80) };

                    return (
                        <AnnotationPopup
                            element={COMPONENT_MAP[ep.type]?.label || ep.type}
                            initialValue={ep.text ?? ""}
                            isExiting={editExiting}
                            lightMode={!isDarkMode}
                            onCancel={dismissEdit}
                            onDelete={editHadTextRef.current
                                ? () => {
                                    submitEdit("");
                                }
                                : undefined}
                            onSubmit={submitEdit}
                            placeholder={TEXT_PLACEHOLDERS[ep.type] ?? "Label or content text"}
                            style={popupStyle}
                            submitLabel={editHadTextRef.current ? "Save" : "Set"}
                        />
                    );
                })()
                : null}

            {drawBox ? (
                <div
                    class={`fixed pointer-events-none z-[99996] rounded-md border-2 ${accentClass} ${accentBgClass}`}
                    data-feedback-toolbar
                    style={{ height: drawBox.h, left: drawBox.x, top: drawBox.y, width: drawBox.w }}
                />
            ) : null}

            {selectBox ? (
                <div
                    class={`fixed pointer-events-none z-[99996] rounded-sm border border-dashed ${accentClass} ${accentBgClass}`}
                    data-feedback-toolbar
                    style={{ height: selectBox.h, left: selectBox.x, top: selectBox.y, width: selectBox.w }}
                />
            ) : null}

            {sizeIndicator ? (
                <div
                    class={`fixed pointer-events-none z-[100001] text-[10px] text-primary-foreground px-1.5 py-0.5 rounded font-medium font-sans whitespace-nowrap shadow-md ${wireframe ? "bg-orange-500" : "bg-primary"}`}
                    data-feedback-toolbar
                    style={{ left: sizeIndicator.x, top: sizeIndicator.y }}
                >
                    {sizeIndicator.text}
                </div>
            ) : null}

            {guides.map((g, index) => (
                <div
                    class="pointer-events-none z-[100001] bg-fuchsia-500 opacity-50"
                    data-feedback-toolbar
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${g.axis}-${g.pos}-${index}`}
                    style={
                        g.axis === "x"
                            ? { bottom: 0, left: g.pos, position: "fixed", top: 0, width: 1 }
                            : { height: 1, left: 0, position: "fixed", right: 0, top: g.pos - scrollY }
                    }
                />
            ))}
        </>
    );
};
