import { useEffect, useMemo, useRef, useState } from 'react';
import { InkCanvas, type InkCanvasHandle } from './components/InkCanvas.tsx';
import { hexToRgb, type RGB } from './fluid/color.ts';
import { DEFAULT_WATER_COLOR, INK_AMOUNT_RANGE, WATER_PRESETS } from './fluid/config.ts';

/**
 * 暫定パレット。
 * 正式なプリセット定義(モノクロ/ビビッド/パステル/和色)は彩さんの確定待ち。
 * 白と黒どちらの台紙でも成立するよう、明度を揃えた高彩度の色で組んでいる。
 */
const PROVISIONAL_INKS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: '白', hex: '#ffffff' },
  { name: '空', hex: '#35b6f0' },
  { name: '珊瑚', hex: '#ff6b5b' },
  { name: '若草', hex: '#7ed957' },
  { name: '向日葵', hex: '#ffc93c' },
  { name: '藤', hex: '#b07ff0' },
];

function requireRgb(hex: string): RGB {
  const rgb = hexToRgb(hex);
  if (!rgb) throw new Error(`色の指定が不正です: ${hex}`);
  return rgb;
}

export default function App() {
  const [inkHex, setInkHex] = useState(PROVISIONAL_INKS[1].hex);
  const [waterHex, setWaterHex] = useState<string>(DEFAULT_WATER_COLOR);
  const [inkAmount, setInkAmount] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const canvasRef = useRef<InkCanvasHandle>(null);

  const inkColor = useMemo(() => requireRgb(inkHex), [inkHex]);
  const waterColor = useMemo(() => requireRgb(waterHex), [waterHex]);
  const isDarkWater = waterHex !== WATER_PRESETS[0].hex;

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

      {panelOpen && (
        <div className="panel">
          <label className="panel-row">
            <span className="panel-label">インクの量</span>
            <input
              type="range"
              min={INK_AMOUNT_RANGE.min}
              max={INK_AMOUNT_RANGE.max}
              step={INK_AMOUNT_RANGE.step}
              value={inkAmount}
              onChange={(event) => setInkAmount(Number(event.target.value))}
            />
            <span className="panel-value">{Math.round(inkAmount * 100)}%</span>
          </label>

          <div className="panel-row">
            <span className="panel-label">台紙</span>
            <div className="waters" role="radiogroup" aria-label="台紙の色">
              {WATER_PRESETS.map((water) => (
                <button
                  key={water.hex}
                  type="button"
                  role="radio"
                  aria-checked={water.hex === waterHex}
                  aria-label={`台紙 ${water.name}`}
                  title={`台紙 ${water.name}`}
                  className={`water${water.hex === waterHex ? ' is-selected' : ''}`}
                  style={{ backgroundColor: water.hex }}
                  onClick={() => setWaterHex(water.hex)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

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

        <button
          type="button"
          className={`action${panelOpen ? ' is-active' : ''}`}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          調整
        </button>

        <button type="button" className="action" onClick={() => canvasRef.current?.clear()}>
          消す
        </button>
      </div>
    </div>
  );
}
