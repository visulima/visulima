/** @jsxImportSource preact */

import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { originalSetTimeout } from "../inspector/freeze-animations";
import AnnotationPopup from "./annotation-popup";
import { captureElement } from "./section-detection";
import type { SnapGuide as Guide, SnapRect } from "./snap";
import { computeSnap } from "./snap";
import type { DetectedSection, RearrangeState } from "./types";

const SECTION_COLOR = { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.5)", pill: "#3b82f6" };
const HANDLES: HandleDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const MIN_SIZE = 24;
const MIN_CAPTURE_SIZE = 16;

type HandleDir = "e" | "n" | "ne" | "nw" | "s" | "se" | "sw" | "w";

const SKIP_TAGS = new Set(["br", "hr", "link", "meta", "noscript", "script", "style"]);

interface RearrangeOverlayProps {
    blankCanvas?: boolean;
    className?: string;
    clearSignal?: number;
    deselectSignal?: number;
    exiting?: boolean;
    extraSnapRects?: SnapRect[];
    isDarkMode: boolean;
    onChange: (state: RearrangeState) => void;
    onDragEnd?: (dx: number, dy: number, committed: boolean) => void;
    onDragMove?: (dx: number, dy: number) => void;
    onSelectionChange?: (selectedIds: Set<string>, isShift: boolean) => void;
    rearrangeState: RearrangeState;
}

const computeSectionSnap = (
    rect: SnapRect,
    sections: DetectedSection[],
    excludeIds: Set<string>,
    extraRects?: SnapRect[],
) => computeSnap(rect, {
    excludeIds,
    extraRects,
    others: sections.map((s) => { return { ...s.currentRect, id: s.id }; }),
});

const pickTarget = (element_: HTMLElement): HTMLElement | null => {
    let current: HTMLElement | null = element_;

    while (current && current !== document.body && current !== document.documentElement) {
        if (current.closest("[data-feedback-toolbar]")) {
            return null;
        }

        if (SKIP_TAGS.has(current.tagName.toLowerCase())) {
            current = current.parentElement;

            continue;
        }

        const rect = current.getBoundingClientRect();

        if (rect.width >= MIN_CAPTURE_SIZE && rect.height >= MIN_CAPTURE_SIZE) {
            return current;
        }

        current = current.parentElement;
    }

    return null;
};

const hasChanged = (s: DetectedSection): boolean => {
    const o = s.originalRect;
    const c = s.currentRect;

    return Math.abs(o.x - c.x) > 1 || Math.abs(o.y - c.y) > 1 || Math.abs(o.width - c.width) > 1 || Math.abs(o.height - c.height) > 1;
};

const isMoved = (s: DetectedSection): boolean => {
    const o = s.originalRect;
    const c = s.currentRect;

    return Math.abs(o.x - c.x) > 1 || Math.abs(o.y - c.y) > 1;
};

const isResized = (s: DetectedSection): boolean => {
    const o = s.originalRect;
    const c = s.currentRect;

    return Math.abs(o.width - c.width) > 1 || Math.abs(o.height - c.height) > 1;
};

export const RearrangeOverlay = ({
    blankCanvas,
    className: extraClassName,
    clearSignal,
    deselectSignal,
    exiting,
    extraSnapRects,
    isDarkMode,
    onChange,
    onDragEnd,
    onDragMove,
    onSelectionChange,
    rearrangeState,
}: RearrangeOverlayProps): JSX.Element => {
    const { sections } = rearrangeState;
    const rearrangeStateRef = useRef(rearrangeState);

    rearrangeStateRef.current = rearrangeState;

    const [selectedIds, setSelectedIds] = useState(new Set<string>());
    const [exitingAll, setExitingAll] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editExiting, setEditExiting] = useState(false);
    const editHadNoteRef = useRef(false);
    const [exitingIds, setExitingIds] = useState(new Set<string>());
    const lastNoteTextRef = useRef(new Map<string, string>());
    const [hoverHighlight, setHoverHighlight] = useState<{ h: number; w: number; x: number; y: number } | null>(null);
    const [sizeIndicator, setSizeIndicator] = useState<{ text: string; x: number; y: number } | null>(null);
    const [snapGuides, setSnapGuides] = useState<Guide[]>([]);
    const [scrollY, setScrollY] = useState(0);
    const interactionRef = useRef<string | null>(null);
    const seenGhostIdsRef = useRef(new Set<string>());
    const firstActionRef = useRef(new Map<string, "move" | "resize">());
    const [dragPositions, setDragPositions] = useState(new Map<string, { height: number; width: number; x: number; y: number }>());
    const onSelectionChangeRef = useRef(onSelectionChange);

    onSelectionChangeRef.current = onSelectionChange;
    const onDragMoveRef = useRef(onDragMove);

    onDragMoveRef.current = onDragMove;
    const onDragEndRef = useRef(onDragEnd);

    onDragEndRef.current = onDragEnd;

    const clearRef = useRef(clearSignal);

    useEffect(() => {
        if (clearSignal !== undefined && clearSignal !== clearRef.current) {
            clearRef.current = clearSignal;

            if (sections.length > 0) {
                setExitingAll(true);
            }
        }
    }, [clearSignal, sections.length]);

    const deselectRef = useRef(deselectSignal);

    useEffect(() => {
        if (deselectSignal !== deselectRef.current) {
            deselectRef.current = deselectSignal;
            setSelectedIds(new Set());
        }
    }, [deselectSignal]);

    useEffect(() => {
        if (blankCanvas) {
            setSelectedIds(new Set());
        }
    }, [blankCanvas]);

    const capturedSelectors = useRef(new Set<string>());

    useEffect(() => {
        capturedSelectors.current = new Set(sections.map((s) => s.selector));
    }, [sections]);

    useEffect(() => {
        const onScroll = (): void => {
            setScrollY(window.scrollY);
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, []);

    useEffect(() => {
        const handleMouseMove = (event_: MouseEvent): void => {
            if (interactionRef.current) {
                setHoverHighlight(null);

                return;
            }

            const element_ = document.elementFromPoint(event_.clientX, event_.clientY) as HTMLElement | null;

            if (!element_ || element_.closest("[data-feedback-toolbar]") || element_.closest("[data-design-placement]") || element_.closest("[data-annotation-popup]")) {
                setHoverHighlight(null);

                return;
            }

            const target = pickTarget(element_);

            if (!target) {
                setHoverHighlight(null);

                return;
            }

            for (const sel of capturedSelectors.current) {
                try {
                    const captured = document.querySelector(sel);

                    if (captured && (captured === target || target.contains(captured))) {
                        setHoverHighlight(null);

                        return;
                    }
                } catch {
                    /* invalid selector */
                }
            }

            const rect = target.getBoundingClientRect();

            setHoverHighlight({ h: rect.height, w: rect.width, x: rect.x, y: rect.y });
        };

        document.addEventListener("mousemove", handleMouseMove, { passive: true });

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, [sections]);

    useEffect(() => {
        const previous = document.body.style.userSelect;

        document.body.style.userSelect = "none";

        return () => {
            document.body.style.userSelect = previous;
        };
    }, []);

    useEffect(() => {
        const handleMouseDown = (event_: MouseEvent): void => {
            if (interactionRef.current || event_.button !== 0) {
                return;
            }

            const element_ = event_.target as HTMLElement;

            if (!element_ || element_.closest("[data-feedback-toolbar]") || element_.closest("[data-design-placement]") || element_.closest("[data-annotation-popup]")) {
                return;
            }

            const target = pickTarget(element_);
            let alreadyCaptured = false;

            if (target) {
                for (const sel of capturedSelectors.current) {
                    try {
                        const captured = document.querySelector(sel);

                        if (captured && (captured === target || target.contains(captured))) {
                            alreadyCaptured = true;

                            break;
                        }
                    } catch {
                        /* invalid */
                    }
                }
            }

            const isShift = Boolean(event_.shiftKey || event_.metaKey || event_.ctrlKey);

            if (target && !alreadyCaptured) {
                event_.preventDefault();
                event_.stopPropagation();

                const section = captureElement(target);
                const newSections = [...sections, section];
                const newOrder = [...rearrangeState.originalOrder, section.id];

                onChange({ ...rearrangeState, originalOrder: newOrder, sections: newSections });

                const newIds = new Set([section.id]);

                setSelectedIds(newIds);
                onSelectionChangeRef.current?.(newIds, isShift);
                setHoverHighlight(null);
            } else if (!isShift) {
                setSelectedIds(new Set());
                onSelectionChangeRef.current?.(new Set(), false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown, true);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown, true);
        };
    }, [sections, rearrangeState, onChange]);

    useEffect(() => {
        const handleKeyDown = (event_: KeyboardEvent): void => {
            const target = event_.target as HTMLElement;

            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
                return;
            }

            if ((event_.key === "Backspace" || event_.key === "Delete") && selectedIds.size > 0) {
                event_.preventDefault();

                const idsToDelete = new Set(selectedIds);

                setExitingIds((previous) => {
                    const next = new Set(previous);

                    for (const id of idsToDelete) {
                        next.add(id);
                    }

                    return next;
                });
                setSelectedIds(new Set());
                originalSetTimeout(() => {
                    const rs = rearrangeStateRef.current;

                    onChange({
                        ...rs,
                        originalOrder: rs.originalOrder.filter((id) => !idsToDelete.has(id)),
                        sections: rs.sections.filter((s) => !idsToDelete.has(s.id)),
                    });
                    setExitingIds((previous) => {
                        const next = new Set(previous);

                        for (const id of idsToDelete) {
                            next.delete(id);
                        }

                        return next;
                    });
                }, 180);

                return;
            }

            if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event_.key) && selectedIds.size > 0) {
                event_.preventDefault();

                const step = event_.shiftKey ? 20 : 1;
                const dx = event_.key === "ArrowLeft" ? -step : event_.key === "ArrowRight" ? step : 0;
                const dy = event_.key === "ArrowUp" ? -step : event_.key === "ArrowDown" ? step : 0;

                onChange({
                    ...rearrangeState,
                    sections: sections.map((s) =>
                        (selectedIds.has(s.id)
                            ? {
                                ...s,
                                currentRect: { ...s.currentRect, x: Math.max(0, s.currentRect.x + dx), y: Math.max(0, s.currentRect.y + dy) },
                            }
                            : s)),
                });

                return;
            }

            if (event_.key === "Escape" && selectedIds.size > 0) {
                setSelectedIds(new Set());
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [selectedIds, sections, rearrangeState, onChange]);

    const handleOutlineMouseDown = useCallback(
        (event_: JSX.TargetedMouseEvent<HTMLDivElement>, id: string) => {
            if (event_.button !== 0) {
                return;
            }

            const target = event_.target as HTMLElement;

            if (target.closest("[data-vdt-handle]") || target.closest("[data-vdt-delete]")) {
                return;
            }

            event_.preventDefault();
            event_.stopPropagation();

            let newSelected: Set<string>;

            if (event_.shiftKey || event_.metaKey || event_.ctrlKey) {
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
                onSelectionChangeRef.current?.(newSelected, Boolean(event_.shiftKey || event_.metaKey || event_.ctrlKey));
            }

            const startX = event_.clientX;
            const startY = event_.clientY;
            const startPositions = new Map<string, { x: number; y: number }>();

            for (const s of sections) {
                if (newSelected.has(s.id)) {
                    startPositions.set(s.id, { x: s.currentRect.x, y: s.currentRect.y });
                }
            }

            interactionRef.current = "move";

            let moved = false;
            let lastDx = 0;
            let lastDy = 0;
            const dragEls = new Map<string, { curH: number; curW: number; outlineEl: HTMLElement | null }>();

            for (const s of sections) {
                if (newSelected.has(s.id)) {
                    const outlineEl = document.querySelector<HTMLElement>(`[data-rearrange-section="${s.id}"]`);

                    dragEls.set(s.id, { curH: s.currentRect.height, curW: s.currentRect.width, outlineEl });
                }
            }

            const onMove = (event_v: MouseEvent): void => {
                const rawDx = event_v.clientX - startX;
                const rawDy = event_v.clientY - startY;

                if (rawDx === 0 && rawDy === 0) {
                    return;
                }

                moved = true;

                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;

                for (const [id_, { curH, curW }] of dragEls) {
                    const start = startPositions.get(id_);

                    if (!start) {
                        continue;
                    }

                    const cx = start.x + rawDx;
                    const cy = start.y + rawDy;

                    minX = Math.min(minX, cx);
                    minY = Math.min(minY, cy);
                    maxX = Math.max(maxX, cx + curW);
                    maxY = Math.max(maxY, cy + curH);
                }

                const snap = computeSectionSnap(
                    { height: maxY - minY, width: maxX - minX, x: minX, y: minY },
                    sections,
                    newSelected,
                    extraSnapRects,
                );
                const dx = rawDx + snap.dx;
                const dy = rawDy + snap.dy;

                lastDx = dx;
                lastDy = dy;
                setSnapGuides(snap.guides);

                for (const [, { outlineEl }] of dragEls) {
                    if (outlineEl) {
                        outlineEl.style.transform = `translate(${dx}px, ${dy}px)`;
                    }
                }

                const livePos = new Map<string, { height: number; width: number; x: number; y: number }>();

                for (const [id_, { curH, curW }] of dragEls) {
                    const start = startPositions.get(id_);

                    if (start) {
                        livePos.set(id_, { height: curH, width: curW, x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) });
                    }
                }

                setDragPositions(livePos);
                onDragMoveRef.current?.(dx, dy);
            };

            const onUp = (event_v: MouseEvent): void => {
                globalThis.removeEventListener("mousemove", onMove);
                globalThis.removeEventListener("mouseup", onUp);
                interactionRef.current = null;
                setSnapGuides([]);
                setDragPositions(new Map());

                for (const [, { outlineEl }] of dragEls) {
                    if (outlineEl) {
                        outlineEl.style.transform = "";
                    }
                }

                if (moved) {
                    const totalDx = event_v.clientX - startX;
                    const totalDy = event_v.clientY - startY;

                    if (Math.abs(totalDx) < 5 && Math.abs(totalDy) < 5) {
                        onChange({
                            ...rearrangeState,
                            sections: sections.map((s) => {
                                const start = startPositions.get(s.id);

                                if (!start) {
                                    return s;
                                }

                                return { ...s, currentRect: { ...s.currentRect, x: start.x, y: start.y } };
                            }),
                        });
                    } else {
                        onChange({
                            ...rearrangeState,
                            sections: sections.map((s) => {
                                const start = startPositions.get(s.id);

                                if (!start) {
                                    return s;
                                }

                                return {
                                    ...s,
                                    currentRect: { ...s.currentRect, x: Math.max(0, start.x + lastDx), y: Math.max(0, start.y + lastDy) },
                                };
                            }),
                        });
                        onDragEndRef.current?.(lastDx, lastDy, true);

                        return;
                    }
                }

                onDragEndRef.current?.(0, 0, false);
            };

            globalThis.addEventListener("mousemove", onMove);
            globalThis.addEventListener("mouseup", onUp);
        },
        [selectedIds, sections, rearrangeState, onChange, extraSnapRects],
    );

    const handleResizeMouseDown = useCallback(
        (event_: JSX.TargetedMouseEvent<HTMLDivElement>, id: string, dir: HandleDir) => {
            event_.preventDefault();
            event_.stopPropagation();

            const section = sections.find((s) => s.id === id);

            if (!section) {
                return;
            }

            setSelectedIds(new Set([id]));
            interactionRef.current = "resize";

            const startX = event_.clientX;
            const startY = event_.clientY;
            const startRect = { ...section.currentRect };
            const aspectRatio = startRect.width / startRect.height;
            let lastRect = { ...startRect };
            const resizeOutlineEl = document.querySelector<HTMLElement>(`[data-rearrange-section="${id}"]`);

            const onMove = (event_v: MouseEvent): void => {
                const dx = event_v.clientX - startX;
                const dy = event_v.clientY - startY;
                let nx = startRect.x;
                let ny = startRect.y;
                let nw = startRect.width;
                let nh = startRect.height;

                if (dir.includes("e")) {
                    nw = Math.max(MIN_SIZE, startRect.width + dx);
                }

                if (dir.includes("w")) {
                    nw = Math.max(MIN_SIZE, startRect.width - dx);
                    nx = startRect.x + startRect.width - nw;
                }

                if (dir.includes("s")) {
                    nh = Math.max(MIN_SIZE, startRect.height + dy);
                }

                if (dir.includes("n")) {
                    nh = Math.max(MIN_SIZE, startRect.height - dy);
                    ny = startRect.y + startRect.height - nh;
                }

                if (event_v.shiftKey) {
                    const isCorner = dir.length === 2;

                    if (isCorner) {
                        const wDelta = Math.abs(nw - startRect.width);
                        const hDelta = Math.abs(nh - startRect.height);

                        if (wDelta > hDelta) {
                            nh = nw / aspectRatio;
                        } else {
                            nw = nh * aspectRatio;
                        }

                        if (dir.includes("w")) {
                            nx = startRect.x + startRect.width - nw;
                        }

                        if (dir.includes("n")) {
                            ny = startRect.y + startRect.height - nh;
                        }
                    } else {
                        if (dir === "e" || dir === "w") {
                            nh = nw / aspectRatio;
                        } else {
                            nw = nh * aspectRatio;
                        }

                        if (dir === "w") {
                            nx = startRect.x + startRect.width - nw;
                        }

                        if (dir === "n") {
                            ny = startRect.y + startRect.height - nh;
                        }
                    }
                }

                lastRect = { height: nh, width: nw, x: nx, y: ny };

                if (resizeOutlineEl) {
                    resizeOutlineEl.style.left = `${nx}px`;
                    resizeOutlineEl.style.top = `${ny - scrollY}px`;
                    resizeOutlineEl.style.width = `${nw}px`;
                    resizeOutlineEl.style.height = `${nh}px`;
                }

                setSizeIndicator({ text: `${Math.round(nw)} × ${Math.round(nh)}`, x: event_v.clientX + 12, y: event_v.clientY + 12 });
                setDragPositions(new Map([[id, lastRect]]));
            };

            const onUp = (): void => {
                globalThis.removeEventListener("mousemove", onMove);
                globalThis.removeEventListener("mouseup", onUp);
                setSizeIndicator(null);
                interactionRef.current = null;
                setDragPositions(new Map());
                onChange({
                    ...rearrangeState,
                    sections: sections.map((s) => (s.id === id ? { ...s, currentRect: lastRect } : s)),
                });
            };

            globalThis.addEventListener("mousemove", onMove);
            globalThis.addEventListener("mouseup", onUp);
        },
        [sections, rearrangeState, onChange, scrollY],
    );

    const handleDelete = useCallback(
        (id: string) => {
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
                const rs = rearrangeStateRef.current;

                onChange({
                    ...rs,
                    originalOrder: rs.originalOrder.filter((oid) => oid !== id),
                    sections: rs.sections.filter((s) => s.id !== id),
                });
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
            const s = sections.find((sec) => sec.id === id);

            if (!s) {
                return;
            }

            editHadNoteRef.current = Boolean(s.note);
            setEditingId(id);
            setEditExiting(false);
        },
        [sections],
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

    const submitEdit = useCallback(
        (text: string) => {
            if (!editingId) {
                return;
            }

            onChange({
                ...rearrangeState,
                sections: sections.map((s) => (s.id === editingId ? { ...s, note: text.trim() || undefined } : s)),
            });
            dismissEdit();
        },
        [editingId, sections, rearrangeState, onChange, dismissEdit],
    );

    useEffect(() => {
        if (exiting && editingId) {
            dismissEdit();
        }
    }, [exiting]);

    for (const s of sections) {
        if (!firstActionRef.current.has(s.id)) {
            if (isMoved(s)) {
                firstActionRef.current.set(s.id, "move");
            } else if (isResized(s)) {
                firstActionRef.current.set(s.id, "resize");
            }
        }
    }

    for (const id of firstActionRef.current.keys()) {
        if (!sections.some((s) => s.id === id)) {
            firstActionRef.current.delete(id);
        }
    }

    const visibleSections = sections.filter((s) => {
        try {
            if (exitingIds.has(s.id) || selectedIds.has(s.id)) {
                return true;
            }

            const element_ = document.querySelector(s.selector);

            if (!element_) {
                return false;
            }

            const rect = element_.getBoundingClientRect();
            const expected = s.originalRect;
            const sizeDiff = Math.abs(rect.width - expected.width) + Math.abs(rect.height - expected.height);

            return sizeDiff < 200;
        } catch {
            return false;
        }
    });

    const changedSections = visibleSections.filter((s) => hasChanged(s));
    const unchangedSections = visibleSections.filter((s) => !hasChanged(s));
    const currentChangedIds = new Set(changedSections.map((s) => s.id));

    for (const id of seenGhostIdsRef.current) {
        if (!currentChangedIds.has(id)) {
            seenGhostIdsRef.current.delete(id);
        }
    }

    const overlayClass = [
        isDarkMode ? "dark" : "",
        "fixed inset-0 z-[99995] cursor-default select-none",
        "pointer-events-none",
        exiting ? "opacity-0 transition-opacity duration-200" : "opacity-100",
        extraClassName ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const renderOutline = (section: DetectedSection, ghost: boolean): JSX.Element => {
        const rect = section.currentRect;
        const screenY = section.isFixed ? rect.y : rect.y - scrollY;
        const isSelected = selectedIds.has(section.id);
        const moved = isMoved(section);
        const resized = isResized(section);
        const annotation = section.note || lastNoteTextRef.current.get(section.id) || "";

        if (section.note) {
            lastNoteTextRef.current.set(section.id, section.note);
        }

        const isExitingNow = exitingAll || exiting || exitingIds.has(section.id);
        const baseClass = "group/sec absolute rounded-sm cursor-grab active:cursor-grabbing select-none pointer-events-auto";
        const outlineStyle: JSX.CSSProperties = {
            animation: ghost ? "vdt-lm-ghost-enter 0.25s ease" : "vdt-lm-section-enter 0.2s ease",
            backgroundColor: ghost ? "rgba(59, 130, 246, 0.04)" : SECTION_COLOR.bg,
            border: `2px solid ${ghost ? (isSelected ? "#3b82f6" : "rgba(59,130,246,0.4)") : SECTION_COLOR.border}`,
            borderRadius: 4,
            boxShadow: isSelected ? "0 0 0 2px rgba(59,130,246,0.15), 0 2px 8px rgba(59,130,246,0.15)" : undefined,
            height: rect.height,
            left: rect.x,
            opacity: isExitingNow ? 0 : ghost ? (isSelected ? 1 : 0.5) : 1,
            pointerEvents: isExitingNow ? "none" : "auto",
            position: "fixed",
            top: screenY,
            transform: isExitingNow ? "scale(0.97)" : "scale(1)",
            transition: "box-shadow 0.15s, border-color 0.3s, opacity 0.25s, transform 0.2s cubic-bezier(0.32,0.72,0,1)",
            width: rect.width,
        };

        return (
            <div
                class={baseClass}
                data-rearrange-section={section.id}
                key={section.id}
                onDblClick={() => handleDoubleClick(section.id)}
                onMouseDown={(event_) => handleOutlineMouseDown(event_, section.id)}
                style={outlineStyle}
            >
                <span
                    class="absolute top-1 left-1 text-[10px] font-semibold text-white px-2 py-0.5 rounded whitespace-nowrap pointer-events-none font-sans shadow-sm max-w-[calc(100%-8px)] overflow-hidden text-ellipsis"
                    style={{ backgroundColor: SECTION_COLOR.pill }}
                >
                    {section.label}
                </span>
                <span
                    class="absolute -bottom-[18px] left-0 right-0 text-[10px] text-blue-500/70 whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none font-sans transition-all duration-200"
                    style={{
                        opacity: section.note ? 1 : 0,
                        textShadow: "0 0 4px rgba(255,255,255,0.9)",
                        transform: section.note ? "translateY(0)" : "translateY(-2px)",
                    }}
                >
                    {annotation}
                </span>
                <span class="absolute bottom-1 right-1 text-[9px] font-medium text-white/70 bg-black/50 px-1.5 py-px rounded-sm whitespace-nowrap pointer-events-none font-sans">
                    {Math.round(rect.width)} × {Math.round(rect.height)}
                </span>
                <div
                    class={`absolute -top-2 -right-2 size-[18px] rounded-full bg-popover/90 border border-border text-foreground/40 cursor-pointer flex items-center justify-center text-[10px] z-[15] transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive hover:scale-110 ${isSelected ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none group-hover/sec:opacity-100 group-hover/sec:scale-100 group-hover/sec:pointer-events-auto"}`}
                    data-vdt-delete
                    onClick={() => handleDelete(section.id)}
                    onMouseDown={(event_) => event_.stopPropagation()}
                >
                    ✕
                </div>
                {HANDLES.map((dir) => {
                    const positions: Record<string, JSX.CSSProperties> = {
                        e: { cursor: "e-resize", right: -4, top: "calc(50% - 4px)" },
                        n: { cursor: "n-resize", left: "calc(50% - 4px)", top: -4 },
                        ne: { cursor: "ne-resize", right: -4, top: -4 },
                        nw: { cursor: "nw-resize", left: -4, top: -4 },
                        s: { bottom: -4, cursor: "s-resize", left: "calc(50% - 4px)" },
                        se: { bottom: -4, cursor: "se-resize", right: -4 },
                        sw: { bottom: -4, cursor: "sw-resize", left: -4 },
                        w: { cursor: "w-resize", left: -4, top: "calc(50% - 4px)" },
                    };

                    return (
                        <div
                            class={`absolute size-2 bg-card border-[1.5px] border-blue-500 rounded-sm z-[12] transition-all duration-200 ${isSelected ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-50 pointer-events-none group-hover/sec:opacity-100 group-hover/sec:scale-100 group-hover/sec:pointer-events-auto"}`}
                            data-vdt-handle
                            key={dir}
                            onMouseDown={(event_) => handleResizeMouseDown(event_, section.id, dir)}
                            style={positions[dir]}
                        />
                    );
                })}
                {ghost ? (
                    <span
                        class="absolute -top-[18px] left-0 text-[9px] font-semibold text-blue-600 bg-blue-500/10 border border-blue-500/20 px-1.5 py-px rounded-sm whitespace-nowrap pointer-events-none font-sans tracking-wide"
                        style={{ animation: "vdt-lm-badge-slide-in 0.2s ease both" }}
                    >
                        {`Suggested ${moved && resized ? "Move & Resize" : resized ? "Resize" : "Move"}`}
                    </span>
                ) : null}
            </div>
        );
    };

    return (
        <>
            <div class={overlayClass} data-feedback-toolbar style={{ animation: "vdt-lm-overlay-fade-in 0.15s ease" }}>
                {hoverHighlight ? (
                    <div
                        class="fixed pointer-events-none z-[99994] border-2 border-dashed border-blue-500/50 rounded-sm bg-blue-500/5 animate-in fade-in"
                        style={{ height: hoverHighlight.h, left: hoverHighlight.x, top: hoverHighlight.y, width: hoverHighlight.w }}
                    />
                ) : null}
                {unchangedSections.map((section) => renderOutline(section, false))}
                {changedSections.map((section) => {
                    if (blankCanvas && !selectedIds.has(section.id)) {
                        return null;
                    }

                    return renderOutline(section, true);
                })}
            </div>

            {!blankCanvas && changedSections.length > 0 ? (
                <svg class="fixed inset-0 size-full pointer-events-none z-[99996]">
                    {changedSections.map((s) => {
                        const orig = s.originalRect;
                        const target = dragPositions.get(s.id) ?? s.currentRect;
                        const ox = orig.x + orig.width / 2;
                        const oy = (s.isFixed ? orig.y : orig.y - scrollY) + orig.height / 2;
                        const cx = target.x + target.width / 2;
                        const cy = (s.isFixed ? target.y : target.y - scrollY) + target.height / 2;
                        const ddx = cx - ox;
                        const ddy = cy - oy;
                        const dist = Math.hypot(ddx, ddy);

                        if (dist < 2) {
                            return null;
                        }

                        const proximityScale = Math.min(1, dist / 40);
                        const perpOffset = Math.min(dist * 0.3, 60);
                        const nx = -ddy / dist;
                        const ny = ddx / dist;
                        const cpx = (ox + cx) / 2 + nx * perpOffset;
                        const cpy = (oy + cy) / 2 + ny * perpOffset;

                        return (
                            <g key={`conn-${s.id}`}>
                                <path
                                    d={`M ${ox} ${oy} Q ${cpx} ${cpy} ${cx} ${cy}`}
                                    fill="none"
                                    opacity={0.6 * proximityScale}
                                    stroke="rgba(59, 130, 246, 0.45)"
                                    strokeWidth="1.5"
                                />
                                <circle cx={ox} cy={oy} fill="rgba(59, 130, 246, 0.8)" opacity={proximityScale} r={4 * proximityScale} stroke="#fff" strokeWidth="1.5" />
                                <circle cx={cx} cy={cy} fill="rgba(59, 130, 246, 0.8)" opacity={proximityScale} r={4 * proximityScale} stroke="#fff" strokeWidth="1.5" />
                            </g>
                        );
                    })}
                </svg>
            ) : null}

            {editingId
                ? (() => {
                    const es = sections.find((s) => s.id === editingId);

                    if (!es) {
                        return null;
                    }

                    const rect = es.currentRect;
                    const anchorY = es.isFixed ? rect.y + scrollY : rect.y;

                    return (
                        <AnnotationPopup
                            anchorRect={{ height: rect.height, width: rect.width, x: rect.x, y: anchorY }}
                            element={es.label}
                            initialValue={es.note ?? ""}
                            isExiting={editExiting}
                            lightMode={!isDarkMode}
                            onCancel={dismissEdit}
                            onDelete={editHadNoteRef.current
                                ? () => {
                                    submitEdit("");
                                }
                                : undefined}
                            onSubmit={submitEdit}
                            placeholder="Add a note about this section"
                            submitLabel={editHadNoteRef.current ? "Save" : "Set"}
                        />
                    );
                })()
                : null}

            {sizeIndicator ? (
                <div class="fixed pointer-events-none z-[100001] text-[10px] text-primary-foreground bg-primary px-1.5 py-0.5 rounded font-medium font-sans whitespace-nowrap shadow-md" data-feedback-toolbar style={{ left: sizeIndicator.x, top: sizeIndicator.y }}>
                    {sizeIndicator.text}
                </div>
            ) : null}

            {snapGuides.map((g, index) => (
                <div
                    class="pointer-events-none z-[100001] bg-fuchsia-500 opacity-50"
                    key={`${g.axis}-${g.pos}-${index}`}
                    style={
                        g.axis === "x"
                            ? { height: "100vh", left: g.pos, position: "fixed", top: 0, width: 1 }
                            : { height: 1, left: 0, position: "fixed", top: g.pos - scrollY, width: "100vw" }
                    }
                />
            ))}
        </>
    );
};
