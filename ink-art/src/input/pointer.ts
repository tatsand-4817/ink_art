import type { RGB } from '../fluid/color.ts';
import type { InkSplat } from '../fluid/simulation.ts';

export interface PointerOptions {
  /** その時点で選択されているインク色を返す */
  getColor: () => RGB;
  /** タップ/クリックによる一滴 */
  onDrop: (x: number, y: number, color: RGB) => void;
  /** ドラッグ中の一筆 */
  onStroke: (splat: InkSplat) => void;
}

interface TrackedPointer {
  x: number;
  y: number;
}

/**
 * キャンバスへのタップ/クリック/ドラッグをインク投下に変換する(F-2)。
 * マルチタッチにも対応させ、指ごとに独立した軌跡を出す。
 */
export function attachInkPointer(canvas: HTMLCanvasElement, options: PointerOptions): () => void {
  const { getColor, onDrop, onStroke } = options;
  const active = new Map<number, TrackedPointer>();

  /** 画面座標を左下原点の 0..1 に直す */
  function normalize(event: { clientX: number; clientY: number }): TrackedPointer {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    };
  }

  /**
   * UV の移動量を画面ピクセル基準の等方な流れに直す。
   * これをやらないと、縦長の画面で横ドラッグの流れだけ弱くなる。
   */
  function correctDelta(dx: number, dy: number): [number, number] {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    return aspect < 1 ? [dx * aspect, dy] : [dx, dy / aspect];
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);

    const point = normalize(event);
    active.set(event.pointerId, point);
    onDrop(point.x, point.y, getColor());
  }

  function onPointerMove(event: PointerEvent): void {
    const previous = active.get(event.pointerId);
    if (!previous) return;

    const color = getColor();
    // 高リフレッシュレート端末では 1 フレームに複数の移動が束ねられる。
    // 展開して拾わないと軌跡がカクつく
    const coalesced =
      typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    const moves = coalesced.length > 0 ? coalesced : [event];

    let last = previous;
    for (const move of moves) {
      const point = normalize(move);
      const [dx, dy] = correctDelta(point.x - last.x, point.y - last.y);
      if (dx === 0 && dy === 0) continue;
      onStroke({ x: point.x, y: point.y, dx, dy, color });
      last = point;
    }

    active.set(event.pointerId, last);
  }

  function onPointerUp(event: PointerEvent): void {
    active.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    active.clear();
  };
}
