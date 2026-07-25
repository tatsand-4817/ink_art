export interface Swatch {
  name: string;
  hex: string;
}

export interface PresetSet {
  name: string;
  swatches: readonly Swatch[];
}

/**
 * インクのプリセット。
 *
 * **暫定**。正式な色定義は彩さんの確定待ち(要件定義 §4 / §10)。
 * 既定は「ビビッド」— 明るい色でという指定を受けての並び。
 * どのセットも、白と黒どちらの台紙でも成立する明度に寄せてある。
 */
export const INK_PRESETS: readonly PresetSet[] = [
  {
    name: 'ビビッド',
    swatches: [
      { name: '白', hex: '#ffffff' },
      { name: '空', hex: '#35b6f0' },
      { name: '珊瑚', hex: '#ff6b5b' },
      { name: '若草', hex: '#7ed957' },
      { name: '向日葵', hex: '#ffc93c' },
      { name: '藤', hex: '#b07ff0' },
    ],
  },
  {
    name: 'パステル',
    swatches: [
      { name: '生成り', hex: '#fbf5e9' },
      { name: '水色', hex: '#a9d8ef' },
      { name: '桜', hex: '#f5bcc8' },
      { name: '若芽', hex: '#bfe0b0' },
      { name: 'クリーム', hex: '#f7e2a8' },
      { name: '藤鼠', hex: '#cfc3e8' },
    ],
  },
  {
    name: 'モノクロ',
    swatches: [
      { name: '白', hex: '#ffffff' },
      { name: '白鼠', hex: '#d5d8da' },
      { name: '銀鼠', hex: '#9aa1a6' },
      { name: '鈍色', hex: '#666d72' },
      { name: '濃鼠', hex: '#3a4045' },
      { name: '墨', hex: '#1a1c1e' },
    ],
  },
  {
    name: '和色',
    swatches: [
      { name: '胡粉', hex: '#f6f3ea' },
      { name: '藍', hex: '#3f6f9c' },
      { name: '朱', hex: '#e0503c' },
      { name: '萌黄', hex: '#8bb44a' },
      { name: '山吹', hex: '#f0b73c' },
      { name: '菖蒲', hex: '#8f6bb5' },
    ],
  },
];

/**
 * 台紙(水)のプリセット。
 * 既定は白。要件定義の「白〜わずかに青みがかった透明水色」は「水」として置いてある。
 */
export const WATER_PRESETS: readonly Swatch[] = [
  { name: '白', hex: '#ffffff' },
  { name: '水', hex: '#eef4f7' },
  { name: '生成り', hex: '#f6f1e7' },
  { name: '鼠', hex: '#9aa4ad' },
  { name: '藍鉄', hex: '#2a3440' },
  { name: '黒', hex: '#0f1114' },
];

export const DEFAULT_INK_HEX = INK_PRESETS[0].swatches[1].hex;
export const DEFAULT_WATER_HEX = WATER_PRESETS[0].hex;

/** 台紙が暗いかどうか。操作 UI の配色を反転させる判断に使う */
export function isDarkHex(hex: string): boolean {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  // 知覚的な明るさ。厳密さより「反転すべきか」の判定に足りればよい
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.5;
}
