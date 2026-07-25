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
 * インク色を Beer–Lambert の吸光度に変換する。
 *
 * 描画側は `水の色 * exp(-吸光度)` で合成するので、吸光度は染料場の上で
 * 単純な加算になり、2 色が重なると透過率の積 = 減法混色になる。
 * (青 + 黄 → 緑。加算 RGB でやると白っぽく濁るのでこの形にしている)
 */
export function inkAbsorbance(color: RGB, strength: number): [number, number, number] {
  const linear = toLinearTriplet(color);
  return [
    -Math.log(Math.max(linear[0], MIN_TRANSMITTANCE)) * strength,
    -Math.log(Math.max(linear[1], MIN_TRANSMITTANCE)) * strength,
    -Math.log(Math.max(linear[2], MIN_TRANSMITTANCE)) * strength,
  ];
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
