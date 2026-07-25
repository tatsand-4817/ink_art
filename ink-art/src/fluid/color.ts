export interface RGB {
  /** 0..1, sRGB */
  r: number;
  g: number;
  b: number;
}

/**
 * インクを「吸光度(absorbance)」に変換するときの下限透過率。
 * 0 に近いほど濃い墨が表現できるが、小さくしすぎると 1 滴で真っ黒に潰れる。
 */
const MIN_TRANSMITTANCE = 0.005;

export function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

export function toLinearTriplet(color: RGB): [number, number, number] {
  return [srgbToLinear(color.r), srgbToLinear(color.g), srgbToLinear(color.b)];
}

/**
 * インク色を、染料場へ加算する 1 回分の量に変換する。
 *
 * 返すのは `[吸光度 R, G, B, 顔料の量]` の 4 成分。
 *
 * - **吸光度** は Beer–Lambert の吸光度。描画側が `exp(-吸光度)` で透過率に直すので、
 *   染料場の上では単純な加算 = 透過率の乗算 = 減法混色になる。
 *   (青 + 黄 → 緑。加算 RGB でやると白っぽく濁るのでこの形にしている)
 * - **顔料の量** は「どれだけインクが乗っているか」。吸光度と別に持つ理由は白インク。
 *   白は何も吸収しないので吸光度が全チャンネル 0 になり、量を別に数えないと
 *   「インクが無い」と区別が付かず、黒い台紙の上に置けない。
 *
 * 描画側はこの 2 つから、台紙に透けた色と顔料そのものの色を作り分ける。
 */
export function inkDeposit(color: RGB, amount: number): [number, number, number, number] {
  const linear = toLinearTriplet(color);
  return [
    -Math.log(Math.max(linear[0], MIN_TRANSMITTANCE)) * amount,
    -Math.log(Math.max(linear[1], MIN_TRANSMITTANCE)) * amount,
    -Math.log(Math.max(linear[2], MIN_TRANSMITTANCE)) * amount,
    amount,
  ];
}

export interface HSL {
  /** 色相 0..360 */
  h: number;
  /** 彩度 0..100 */
  s: number;
  /** 明度 0..100 */
  l: number;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function rgbToHsl(color: RGB): HSL {
  const { r, g, b } = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  // 無彩色では色相が定義できない。呼び出し側で直前の色相を保つ
  if (delta === 0) return { h: 0, s: 0, l: lightness * 100 };

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;

  return {
    h: hue,
    s: (delta / (1 - Math.abs(2 * lightness - 1))) * 100,
    l: lightness * 100,
  };
}

export function hslToRgb(hsl: HSL): RGB {
  const hue = ((hsl.h % 360) + 360) % 360;
  const saturation = clamp01(hsl.s / 100);
  const lightness = clamp01(hsl.l / 100);

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - chroma / 2;

  let triplet: [number, number, number];
  switch (Math.floor(hue / 60) % 6) {
    case 0:
      triplet = [chroma, second, 0];
      break;
    case 1:
      triplet = [second, chroma, 0];
      break;
    case 2:
      triplet = [0, chroma, second];
      break;
    case 3:
      triplet = [0, second, chroma];
      break;
    case 4:
      triplet = [second, 0, chroma];
      break;
    default:
      triplet = [chroma, 0, second];
  }

  return {
    r: triplet[0] + offset,
    g: triplet[1] + offset,
    b: triplet[2] + offset,
  };
}

export function hexToRgb(hex: string): RGB | null {
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  let body = match[1];
  if (body.length === 3) {
    body = body[0] + body[0] + body[1] + body[1] + body[2] + body[2];
  }

  return {
    r: parseInt(body.slice(0, 2), 16) / 255,
    g: parseInt(body.slice(2, 4), 16) / 255,
    b: parseInt(body.slice(4, 6), 16) / 255,
  };
}

export function rgbToHex(color: RGB): string {
  const channel = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}
