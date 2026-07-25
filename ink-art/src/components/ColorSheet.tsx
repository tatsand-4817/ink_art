import { useEffect, useMemo, useState } from 'react';
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl, type HSL, type RGB } from '../fluid/color.ts';
import { INK_AMOUNT_RANGE, QUALITY_PRESETS } from '../fluid/config.ts';
import { INK_PRESETS, WATER_PRESETS } from '../palette.ts';

type Target = 'ink' | 'water';
type Mode = 'preset' | 'custom';

const BLACK: RGB = { r: 0, g: 0, b: 0 };

interface CustomEditorProps {
  hex: string;
  onChange: (hex: string) => void;
}

/**
 * HEX / RGB / HSL の 3 つの入力。どれを操作しても他の 2 つが追従する。
 *
 * 色の正は親が持つ HEX。ただし HSL だけは派生値にできない。
 * 無彩色(彩度 0)や真っ黒・真っ白では色相が定義できず、
 * RGB から復元するたびに色相が 0 に飛んでしまうため、
 * ここでだけ HSL を状態として保持している。
 */
function CustomEditor({ hex, onChange }: CustomEditorProps) {
  const rgb = useMemo(() => hexToRgb(hex) ?? BLACK, [hex]);
  const [hsl, setHsl] = useState<HSL>(() => rgbToHsl(rgb));
  const [draftHex, setDraftHex] = useState(hex);

  useEffect(() => {
    setDraftHex(hex);
    // 自分が作った色と一致するなら書き戻さない。
    // 往復の丸めで色相がじりじり動くのを防ぐ
    if (rgbToHex(hslToRgb(hsl)) === hex) return;

    const next = rgbToHsl(rgb);
    setHsl((previous) => ({ h: next.s === 0 ? previous.h : next.h, s: next.s, l: next.l }));
  }, [hex, rgb, hsl]);

  function commitRgb(patch: Partial<RGB>): void {
    onChange(rgbToHex({ ...rgb, ...patch }));
  }

  function commitHsl(patch: Partial<HSL>): void {
    const next = { ...hsl, ...patch };
    setHsl(next);
    onChange(rgbToHex(hslToRgb(next)));
  }

  const rgbChannels = [
    { key: 'r', label: 'R' },
    { key: 'g', label: 'G' },
    { key: 'b', label: 'B' },
  ] as const;

  const hslChannels = [
    { key: 'h', label: 'H', max: 360, unit: '°' },
    { key: 's', label: 'S', max: 100, unit: '%' },
    { key: 'l', label: 'L', max: 100, unit: '%' },
  ] as const;

  return (
    <div className="custom">
      <div className="custom-head">
        <span className="custom-preview" style={{ backgroundColor: hex }} />
        <label className="custom-hex">
          <span className="sheet-label">HEX</span>
          <input
            type="text"
            value={draftHex}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-label="HEX 入力"
            onChange={(event) => {
              const value = event.target.value;
              setDraftHex(value);
              const parsed = hexToRgb(value);
              if (parsed) onChange(rgbToHex(parsed));
            }}
            onBlur={() => setDraftHex(hex)}
          />
        </label>
      </div>

      <div className="custom-group">
        {rgbChannels.map(({ key, label }) => (
          <label key={key} className="slider-row">
            <span className="slider-name">{label}</span>
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={Math.round(rgb[key] * 255)}
              onChange={(event) => commitRgb({ [key]: Number(event.target.value) / 255 })}
            />
            <span className="slider-value">{Math.round(rgb[key] * 255)}</span>
          </label>
        ))}
      </div>

      <div className="custom-group">
        {hslChannels.map(({ key, label, max, unit }) => (
          <label key={key} className="slider-row">
            <span className="slider-name">{label}</span>
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={Math.round(hsl[key])}
              onChange={(event) => commitHsl({ [key]: Number(event.target.value) })}
            />
            <span className="slider-value">
              {Math.round(hsl[key])}
              {unit}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  inkHex: string;
  onInkHexChange: (hex: string) => void;
  waterHex: string;
  onWaterHexChange: (hex: string) => void;
  inkSetIndex: number;
  onInkSetChange: (index: number) => void;
  inkAmount: number;
  onInkAmountChange: (amount: number) => void;
  qualityIndex: number;
  onQualityChange: (index: number) => void;
}

/** 色選択のボトムシート(F-3 / F-4) */
export function ColorSheet({
  open,
  onClose,
  inkHex,
  onInkHexChange,
  waterHex,
  onWaterHexChange,
  inkSetIndex,
  onInkSetChange,
  inkAmount,
  onInkAmountChange,
  qualityIndex,
  onQualityChange,
}: Props) {
  const [target, setTarget] = useState<Target>('ink');
  const [mode, setMode] = useState<Mode>('preset');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isInk = target === 'ink';
  const currentHex = isInk ? inkHex : waterHex;
  const commit = isInk ? onInkHexChange : onWaterHexChange;

  return (
    <>
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="色選択を閉じる"
        onClick={onClose}
      />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="色を選ぶ">
        <div className="sheet-tabs" role="tablist" aria-label="対象">
          {(['ink', 'water'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={target === value}
              className={`sheet-tab${target === value ? ' is-selected' : ''}`}
              onClick={() => setTarget(value)}
            >
              <span
                className="sheet-tab-chip"
                style={{ backgroundColor: value === 'ink' ? inkHex : waterHex }}
              />
              {value === 'ink' ? 'インク' : '台紙'}
            </button>
          ))}

          <button type="button" className="sheet-close" onClick={onClose} aria-label="閉じる">
            閉じる
          </button>
        </div>

        <div className="sheet-modes" role="tablist" aria-label="選び方">
          {(['preset', 'custom'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              className={`sheet-mode${mode === value ? ' is-selected' : ''}`}
              onClick={() => setMode(value)}
            >
              {value === 'preset' ? 'プリセット' : 'カスタム'}
            </button>
          ))}
        </div>

        <div className="sheet-body">
          {mode === 'preset' ? (
            isInk ? (
              <>
                <div className="theme-row" role="radiogroup" aria-label="テーマ">
                  {INK_PRESETS.map((set, index) => (
                    <button
                      key={set.name}
                      type="button"
                      role="radio"
                      aria-checked={index === inkSetIndex}
                      className={`theme${index === inkSetIndex ? ' is-selected' : ''}`}
                      onClick={() => onInkSetChange(index)}
                    >
                      {set.name}
                    </button>
                  ))}
                </div>

                <div className="preset-grid" role="radiogroup" aria-label="インクの色">
                  {INK_PRESETS[inkSetIndex].swatches.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      role="radio"
                      aria-checked={swatch.hex === inkHex}
                      className={`preset${swatch.hex === inkHex ? ' is-selected' : ''}`}
                      onClick={() => onInkHexChange(swatch.hex)}
                    >
                      <span className="preset-chip" style={{ backgroundColor: swatch.hex }} />
                      {swatch.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="preset-grid" role="radiogroup" aria-label="台紙の色">
                {WATER_PRESETS.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    role="radio"
                    aria-checked={swatch.hex === waterHex}
                    className={`preset${swatch.hex === waterHex ? ' is-selected' : ''}`}
                    onClick={() => onWaterHexChange(swatch.hex)}
                  >
                    <span className="preset-chip" style={{ backgroundColor: swatch.hex }} />
                    {swatch.name}
                  </button>
                ))}
              </div>
            )
          ) : (
            <CustomEditor hex={currentHex} onChange={commit} />
          )}

          {/* インクの量と画質はどちらのタブでも触れる全体設定なので、末尾にまとめる */}
          <div className="sheet-footer">
            <label className="slider-row">
              <span className="slider-name">量</span>
              <input
                type="range"
                min={INK_AMOUNT_RANGE.min}
                max={INK_AMOUNT_RANGE.max}
                step={INK_AMOUNT_RANGE.step}
                value={inkAmount}
                onChange={(event) => onInkAmountChange(Number(event.target.value))}
              />
              <span className="slider-value">{Math.round(inkAmount * 100)}%</span>
            </label>

            <div className="slider-row">
              <span className="slider-name quality-name">画質</span>
              <div className="theme-row" role="radiogroup" aria-label="画質">
                {QUALITY_PRESETS.map((quality, index) => (
                  <button
                    key={quality.name}
                    type="button"
                    role="radio"
                    aria-checked={index === qualityIndex}
                    className={`theme${index === qualityIndex ? ' is-selected' : ''}`}
                    onClick={() => onQualityChange(index)}
                  >
                    {quality.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
