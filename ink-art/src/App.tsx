import { useMemo, useRef, useState } from 'react';
import { InkCanvas, type InkCanvasHandle } from './components/InkCanvas.tsx';
import { hexToRgb, type RGB } from './fluid/color.ts';
import { DEFAULT_WATER_COLOR } from './fluid/config.ts';

/**
 * 暫定パレット。
 * 正式なプリセット定義(モノクロ/ビビッド/パステル/和色)は彩さんの確定待ち。
 * ここではコアの挙動 — とくに混色(F-5)— を確認するための最小セットを置いている。
 */
const PROVISIONAL_INKS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: '墨', hex: '#1a1a1a' },
  { name: '藍', hex: '#1f3f6e' },
  { name: '朱', hex: '#d2392b' },
  { name: '萌黄', hex: '#6b9a3a' },
  { name: '山吹', hex: '#e8b22c' },
  { name: '菖蒲', hex: '#6b4a8f' },
];

function requireRgb(hex: string): RGB {
  const rgb = hexToRgb(hex);
  if (!rgb) throw new Error(`色の指定が不正です: ${hex}`);
  return rgb;
}

export default function App() {
  const [inkHex, setInkHex] = useState(PROVISIONAL_INKS[0].hex);
  const canvasRef = useRef<InkCanvasHandle>(null);

  const inkColor = useMemo(() => requireRgb(inkHex), [inkHex]);
  const waterColor = useMemo(() => requireRgb(DEFAULT_WATER_COLOR), []);

  return (
    <div className="app">
      <InkCanvas ref={canvasRef} inkColor={inkColor} waterColor={waterColor} />

      <div className="toolbar">
        <div className="swatches" role="radiogroup" aria-label="インクの色">
          {PROVISIONAL_INKS.map((ink) => (
            <button
              key={ink.hex}
              type="button"
              role="radio"
              aria-checked={ink.hex === inkHex}
              aria-label={ink.name}
              title={ink.name}
              className={`swatch${ink.hex === inkHex ? ' is-selected' : ''}`}
              style={{ backgroundColor: ink.hex }}
              onClick={() => setInkHex(ink.hex)}
            />
          ))}
        </div>

        <button type="button" className="action" onClick={() => canvasRef.current?.clear()}>
          消す
        </button>
      </div>
    </div>
  );
}
