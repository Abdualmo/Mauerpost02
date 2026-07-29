import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

const OPEN_WIDTH = 96; // px — width of the delete panel behind the row
const OPEN_THRESHOLD = 40; // px swipe distance to snap open
const CLOSE_THRESHOLD = 20; // px swipe back to close

export default function SwipeableRow({
  children,
  onDelete,
  disabled = false,
  className = "",
}) {
  const [offset, setOffset] = useState(0); // negative when open
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const rowRef = useRef(null);
  const startedFromInteractive = useRef(false);

  // Close when tapping outside the row
  useEffect(() => {
    if (offset === 0) return undefined;
    const onDoc = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) setOffset(0);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [offset]);

  function pointerDown(e) {
    if (disabled) return;
    // Ignore drags that started on an interactive element inside the row
    const target = e.target;
    startedFromInteractive.current = Boolean(
      target && target.closest && target.closest("button, a, input, select, textarea"),
    );
    start.current = { x: e.clientX, y: e.clientY, offset };
    setDragging(false);
  }

  function pointerMove(e) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!dragging) {
      // Start drag only when horizontal movement dominates and exceeds a few px
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      setDragging(true);
    }
    const next = Math.max(-OPEN_WIDTH, Math.min(0, start.current.offset + dx));
    setOffset(next);
  }

  function pointerUp() {
    if (!start.current) return;
    const wasDragging = dragging;
    start.current = null;
    setDragging(false);
    if (!wasDragging) return;
    if (offset < -OPEN_THRESHOLD && Math.abs(offset) >= OPEN_WIDTH - 20) {
      setOffset(-OPEN_WIDTH);
    } else if (offset < -OPEN_THRESHOLD) {
      setOffset(-OPEN_WIDTH);
    } else if (offset > -CLOSE_THRESHOLD) {
      setOffset(0);
    } else {
      setOffset(0);
    }
  }

  function pointerCancel() {
    start.current = null;
    setDragging(false);
    if (offset > -OPEN_WIDTH / 2) setOffset(0);
    else setOffset(-OPEN_WIDTH);
  }

  const isOpen = offset < -20;

  return (
    <div
      ref={rowRef}
      className={`relative overflow-hidden ${className}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
      style={{ touchAction: "pan-y" }}
    >
      {/* Sliding foreground first — delete panel below stacks above naturally
          because it comes later in DOM. Foreground also becomes non-interactive
          when swiped open so clicks land on the delete button. */}
      <div
        className="bg-white will-change-transform relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 180ms ease",
          pointerEvents: isOpen ? "none" : "auto",
          zIndex: 0,
        }}
        onClickCapture={(e) => {
          if (offset !== 0) {
            e.stopPropagation();
            e.preventDefault();
            setOffset(0);
          }
        }}
      >
        {children}
      </div>

      {/* Delete panel on the right, above the foreground when open */}
      <button
        type="button"
        aria-label="Mitarbeiter löschen"
        className="absolute inset-y-0 right-0 flex items-center justify-center text-white"
        style={{
          width: OPEN_WIDTH,
          backgroundColor: "#D64545",
          zIndex: 1,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOffset(0);
          onDelete && onDelete();
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <Trash2 className="w-5 h-5" />
          <span className="text-[11px] font-medium">Löschen</span>
        </div>
      </button>
    </div>
  );
}
