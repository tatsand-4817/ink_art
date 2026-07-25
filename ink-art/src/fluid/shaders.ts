/**
 * Stable Fluids(Jos Stam)の GPU 実装で使うシェーダ群。
 * GLSL ES 3.00 / WebGL2 前提。
 */

/** 全パス共通の頂点シェーダ。上下左右の近傍 UV も一緒に渡す */
export const BASE_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 texelSize;

void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/** テクスチャをそのまま写す(リサイズ時の内容引き継ぎ用) */
export const COPY_SHADER = /* glsl */ `#version 300 es
precision mediump float;
precision mediump sampler2D;

in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;

void main () {
  fragColor = texture(uTexture, vUv);
}
`;

/** 一様スケール。圧力場の減衰に使う */
export const CLEAR_SHADER = /* glsl */ `#version 300 es
precision mediump float;
precision mediump sampler2D;

in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform float value;

void main () {
  fragColor = value * texture(uTexture, vUv);
}
`;

/**
 * インク/速度の投下(F-2)。
 * ガウス分布で加算するので、染料場では吸光度が足し合わされ、
 * 重なった場所は自動的に減法混色になる(F-5)。
 */
export const SPLAT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 uValue;
uniform vec2 uPoint;
uniform float uRadius;
/** 0 = なだらかなガウス(水流向き) / 1 = 芯のある円盤(インクの粒向き) */
uniform float uHardness;

void main () {
  vec2 p = vUv - uPoint;
  p.x *= aspectRatio;

  float d = length(p) / uRadius;
  float soft = exp(-d * d * 3.0);
  // 中心はほぼ一様、外縁で一気に落とす。実際のインク滴の輪郭に近い
  float hard = smoothstep(1.0, 0.3, d);

  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + mix(soft, hard, uHardness) * uValue, 1.0);
}
`;

/** 移流。速度場に沿って場を後ろ向きに辿るセミラグランジュ法 */
export const ADVECTION_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;

#ifdef MANUAL_FILTERING
vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}
#endif

void main () {
#ifdef MANUAL_FILTERING
  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
  vec4 result = bilerp(uSource, coord, dyeTexelSize);
#else
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
  vec4 result = texture(uSource, coord);
#endif
  float decay = 1.0 + dissipation * dt;
  fragColor = result / decay;
}
`;

/**
 * インクの滲み(拡散)。
 * 移流だけでも数値拡散で多少は滲むが、明示的に足したほうが
 * 実際に水に落としたインクの縁の広がり方に近い。
 */
export const DIFFUSION_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform float uAmount;

void main () {
  vec3 center = texture(uTexture, vUv).rgb;
  vec3 neighbours = texture(uTexture, vL).rgb
                  + texture(uTexture, vR).rgb
                  + texture(uTexture, vT).rgb
                  + texture(uTexture, vB).rgb;
  fragColor = vec4(mix(center, neighbours * 0.25, uAmount), 1.0);
}
`;

/** 速度場の発散 */
export const DIVERGENCE_SHADER = /* glsl */ `#version 300 es
precision mediump float;
precision mediump sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uVelocity;

void main () {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;

  // 境界は自由すべりにせず、速度を跳ね返して器の縁のように振る舞わせる
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }

  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`;

/** 渦度(カール)。渦を維持するために使う */
export const CURL_SHADER = /* glsl */ `#version 300 es
precision mediump float;
precision mediump sampler2D;

in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uVelocity;

void main () {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}
`;

/**
 * 渦度閉じ込め。数値粘性で潰れてしまう小さな渦を押し戻す。
 * 「インクが渦を巻く」挙動はほぼこのパスが担っている。
 */
export const VORTICITY_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float dt;

void main () {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;

  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;

  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

/** 圧力方程式の Jacobi 反復 */
export const PRESSURE_SHADER = /* glsl */ `#version 300 es
precision mediump float;
precision mediump sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;

void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

/** 圧力勾配を引いて非圧縮化する */
export const GRADIENT_SUBTRACT_SHADER = /* glsl */ `#version 300 es
precision mediump float;
precision mediump sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;

void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}
`;

/**
 * 画面への合成。
 * 染料場は「吸光度」なので、Beer–Lambert 則で透過率に直し、
 * 台紙(水)の色に掛けて合成する。これで重ね塗りが減法混色になる。
 */
export const DISPLAY_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
uniform sampler2D uDye;
uniform vec3 uWaterColor;

vec3 linearToSrgb (vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

float density (vec3 absorbance) {
  return dot(max(absorbance, vec3(0.0)), vec3(1.0 / 3.0));
}

void main () {
  vec3 absorbance = max(texture(uDye, vUv).rgb, vec3(0.0));
  vec3 color = uWaterColor * exp(-absorbance);

#ifdef SHADING
  // 濃度の勾配を水面の起伏に見立てて陰影を付けると、
  // 縁が締まって「乗っている」感じが出る
  float dL = density(texture(uDye, vL).rgb);
  float dR = density(texture(uDye, vR).rgb);
  float dT = density(texture(uDye, vT).rgb);
  float dB = density(texture(uDye, vB).rgb);

  vec3 normal = normalize(vec3(dR - dL, dT - dB, 0.6));
  float lit = clamp(dot(normal, normalize(vec3(-0.35, 0.35, 1.0))), 0.0, 1.0);
  color *= mix(1.0, 0.62 + 0.53 * lit, clamp(density(absorbance), 0.0, 1.0));
#endif

  fragColor = vec4(linearToSrgb(color), 1.0);
}
`;
