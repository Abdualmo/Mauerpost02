import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

// "Swipe-to-delete" that mirrors the iOS Mail / Gmail pattern:
//   - Drag the row leftward: a red background is revealed with a trash icon.
//   - Release past the threshold (~55 % of the row width): the delete
//     handler runs. The parent typically shows a confirm dialog and, if the
//     user cancels, the row springs back into place.
//   - Release below the threshold: the row snaps back.
// No separate button — the swipe itself is the action.

const DELETE_THRESHOLD_RATIO = 0.55;

export default function SwipeableRow({
  children,
  onDelete,
  disabled = false,
  className = "",
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(0);
  const rowRef = useRef(null);
  const start = useRef(null);
  const pendingDelete = useRef(false);

  // Measure once mounted and on resize so the threshold scales.
  useEffect(() => {
    if (!rowRef.current) return undefined;
    const el = rowRef.current;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function pointerDown(e) {
    if (disabled) return;
    start.current = { x: e.clientX, y: e.clientY, offset };
    setDragging(false);
  }

  function pointerMove(e) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!dragging) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      setDragging(true);
      // Capture the pointer so we keep receiving events even if the finger
      // leaves the element.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    // Only allow left swipe; clamp to -width (row fully off-screen).
    const next = Math.max(-width, Math.min(0, start.current.offset + dx));
    setOffset(next);
  }

  async function pointerUp(e) {
    if (!start.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const wasDragging = dragging;
    start.current = null;
    setDragging(false);
    if (!wasDragging) return;

    const threshold = width * DELETE_THRESHOLD_RATIO;
    if (Math.abs(offset) >= threshold && onDelete) {
      // Fully commit: slide off-screen and ask the parent to delete.
      pendingDelete.current = true;
      setOffset(-width);
      const ok = await Promise.resolve(onDelete());
      pendingDelete.current = false;
      // If the parent returned false (user cancelled) or the row still
      // exists after the async wait, spring it back.
      if (ok === false) setOffset(0);
    } else {
      setOffset(0);
    }
  }

  function pointerCancel() {
    start.current = null;
    setDragging(false);
    if (!pendingDelete.current) setOffset(0);
  }

  const revealRatio = width > 0 ? Math.min(1, Math.abs(offset) / width) : 0;
  const bgOpacity = 0.15 + 0.85 * revealRatio;

  return (
    <div
      ref={rowRef}
      className={`relative overflow-hidden select-none ${className}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
      style={{ touchAction: "pan-y" }}
    >
      {/* Red background, revealed as the row is dragged left. Icon on the
          right side to hint at the direction. */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end pr-6 text-white"
        style={{
          backgroundColor: `rgba(214, 69, 69, ${bgOpacity.toFixed(2)})`,
          opacity: offset === 0 ? 0 : 1,
          transition: dragging ? "none" : "opacity 160ms ease",
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <Trash2 className="w-5 h-5" />
          <span className="text-[11px] font-medium">Löschen</span>
        </div>
      </div>

      {/* Sliding row content */}
      <div
        className="bg-white relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        onClickCapture={(e) => {
          // Swallow the click that fires at the end of a real drag so the
          // row's own onClick doesn't open the detail page.
          if (dragging || (start.current === null && Math.abs(offset) > 4)) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
