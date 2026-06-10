import { useRef, useState } from 'react';
import { Check as CheckIcon, Trash2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onSwipeRight?: () => void; // complete
  onSwipeLeft?: () => void; // delete
  className?: string;
}

const TRIGGER = 72;

/** Touch swipe: right to complete, left to delete, with revealed hints. */
export default function SwipeRow({ children, onSwipeRight, onSwipeLeft, className }: Props) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiping.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!start.current) return;
    const ddx = e.touches[0].clientX - start.current.x;
    const ddy = e.touches[0].clientY - start.current.y;
    if (!swiping.current && Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
      swiping.current = true;
    }
    if (swiping.current) {
      const limited =
        (ddx > 0 && !onSwipeRight) || (ddx < 0 && !onSwipeLeft) ? ddx / 4 : ddx;
      setDx(Math.max(-140, Math.min(140, limited)));
    }
  }

  function onTouchEnd() {
    if (dx > TRIGGER && onSwipeRight) onSwipeRight();
    else if (dx < -TRIGGER && onSwipeLeft) onSwipeLeft();
    setDx(0);
    start.current = null;
    swiping.current = false;
  }

  return (
    <div className={`swipe-wrap ${className ?? ''}`}>
      <div className={`swipe-hint left ${dx > 24 ? 'visible' : ''}`}>
        <CheckIcon size={18} strokeWidth={2} />
      </div>
      <div className={`swipe-hint right ${dx < -24 ? 'visible' : ''}`}>
        <Trash2 size={18} strokeWidth={2} />
      </div>
      <div
        className="swipe-content"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
