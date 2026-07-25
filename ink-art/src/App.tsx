import { useEffect, useMemo, useRef, useState } from 'react';
import { ColorSheet } from './components/ColorSheet.tsx';
import { InkCanvas, type InkCanvasHandle } from './components/InkCanvas.tsx';
import { hexToRgb, type RGB } from './fluid/color.ts';
import { DEFAULT_INK_HEX, DEFAULT_WATER_HEX, INK_PRESETS, isDarkHex } from './palette.ts';

function requireRgb(hex: string): RGB {
  const rgb = hexToRgb(hex);
  if (!rgb) throw new Error(`色の指定が不正です: ${hex}`);
  return rgb;
}

export default function App() {
  const [inkHex, setInkHex] = useState(DEFAULT_INK_HEX);
  const [waterHex, setWaterHex] = useState(DEFAULT_WATER_HEX);
  const [inkSetIndex, setInkSetIndex] = useState(0);
  const [inkAmount, setInkAmount] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const canvasRef = useRef<InkCanvasHandle>(null);

  const inkColor = useMemo(() => requireRgb(inkHex), [inkHex]);
  const waterColor = useMemo(() => requireRgb(waterHex), [waterHex]);
  const isDarkWater = isDarkHex(waterHex);

  // 初回のヒントは、触られるか少し経てば引っ込める
  useEffect(() => {
    const timer = window.setTimeout(() => setHintVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`app${isDarkWater ? ' is-dark-water' : ''}`}
      onPointerDownCapture={() => setHintVisible(false)}
    >
      <InkCanvas
        ref={canvasRef}
        inkColor={inkColor}
        inkAmount={inkAmount}
        waterColor={waterColor}
      />

      <p className={`hint${hintVisible ? '' : ' is-hidden'}`} aria-hidden={!hintVisible}>
        水面をタップ、なぞると流れができる
      </p>

      <ColorSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        inkHex={inkHex}
        onInkHexChange={setInkHex}
        waterHex={waterHex}
        onWaterHexChange={setWaterHex}
        inkSetIndex={inkSetIndex}
        onInkSetChange={setInkSetIndex}
        inkAmount={inkAmount}
        onInkAmountChange={setInkAmount}
      />

      <div className="toolbar">
        {/* よく使う色はワンタップで届くよう、選択中のテーマだけバーに出す */}
        <div className="swatches" role="radiogroup" aria-label="インクの色">
          {INK_PRESETS[inkSetIndex].swatches.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              role="radio"
              aria-checked={swatch.hex === inkHex}
              aria-label={swatch.name}
              title={swatch.name}
              className={`swatch${swatch.hex === inkHex ? ' is-selected' : ''}`}
              style={{ backgroundColor: swatch.hex }}
              onClick={() => setInkHex(swatch.hex)}
            />
          ))}
        </div>

        <button
          type="button"
          className={`action${sheetOpen ? ' is-active' : ''}`}
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((open) => !open)}
        >
          色
        </button>

        <button type="button" className="action" onClick={() => canvasRef.current?.clear()}>
          消す
        </button>
      </div>
    </div>
  );
}
