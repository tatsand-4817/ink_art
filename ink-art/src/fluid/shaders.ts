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
uniform vec4 uValue;
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

  fragColor = texture(uTarget, vUv) + mix(soft, hard, uHardness) * uValue;
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

/**
 * 速度場をなめらかに読む。
 *
 * 速度場は染料場より 8 倍粗い。素直な線形補間だとテクセルの境目で
 * 微分が不連続になり、その折れ目が毎フレーム染料に転写されて
 * 縁がギザギザに崩れていく。補間の重みを smoothstep に置き換えると
 * 折れ目が消える。テクスチャの読み出しは 1 回のままで済む。
 */
vec2 smoothVelocity (vec2 uv) {
  vec2 st = uv / texelSize - 0.5;
  vec2 base = floor(st);
  vec2 f = st - base;
  f = f * f * (3.0 - 2.0 * f);
  return texture(uVelocity, (base + 0.5 + f) * texelSize).xy;
}

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
  vec2 coord = vUv - dt * smoothVelocity(vUv) * texelSize;
#ifdef MANUAL_FILTERING
  vec4 result = bilerp(uSource, coord, dyeTexelSize);
#else
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
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 texelSize;
uniform float uAmount;

void main () {
  // 上下左右 4 点の平均は縦横にだけよく広がる異方性の強い形で、
  // 何千回も重ねると滲みの縁が菱形に角張ってくる。
  // 半テクセルずらした 4 点ならハードウェアの線形補間が各点で 2x2 を
  // 平均してくれるので、同じ 4 回の読み出しで等方的な 3x3 になる
  vec2 h = 0.5 * texelSize;
  vec4 blurred = texture(uTexture, vUv + vec2(-h.x, -h.y))
               + texture(uTexture, vUv + vec2(h.x, -h.y))
               + texture(uTexture, vUv + vec2(-h.x, h.y))
               + texture(uTexture, vUv + vec2(h.x, h.y));

  // 吸光度と顔料の量は同じ割合で広がらないと、混ざった色の比率が崩れる。
  // 4 成分まとめて拡散させる
  fragColor = mix(texture(uTexture, vUv), blurred * 0.25, uAmount);
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
out vec4 fragColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float uCurlStrength;
uniform float dt;

float curlMagnitude (vec2 offset) {
  return abs(texture(uCurl, vUv + offset * texelSize).x);
}

void main () {
  // 渦を押し戻す向きは |渦度| の勾配から決める。
  // ここを上下左右 4 点の差分で取ると、グリッド 1 セル分の細かい揺らぎを
  // そのまま拾って力に増幅してしまい、染料の縁がギザギザに崩れる。
  // Sobel は 8 近傍で平滑化しながら微分するので、その増幅が起きない。
  float tl = curlMagnitude(vec2(-1.0, 1.0));
  float t = curlMagnitude(vec2(0.0, 1.0));
  float tr = curlMagnitude(vec2(1.0, 1.0));
  float l = curlMagnitude(vec2(-1.0, 0.0));
  float r = curlMagnitude(vec2(1.0, 0.0));
  float bl = curlMagnitude(vec2(-1.0, -1.0));
  float b = curlMagnitude(vec2(0.0, -1.0));
  float br = curlMagnitude(vec2(1.0, -1.0));

  vec2 gradient = vec2(
    (tr + 2.0 * r + br) - (tl + 2.0 * l + bl),
    (tl + 2.0 * t + tr) - (bl + 2.0 * b + br)
  );

  // 勾配の向きに直交する方向へ押すと渦が保たれる。
  // 平坦な場所で単位ベクトルを立てないよう、正規化に下駄を履かせている
  vec2 direction = gradient / (length(gradient) + 0.02);
  vec2 force = vec2(direction.y, -direction.x) * uCurlStrength * texture(uCurl, vUv).x;

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
 *
 * 染料場は `rgb = 吸光度` / `a = 顔料の量` で持っている。ここから 2 つの色を作る:
 *
 * 1. **台紙に透けた色** — `台紙の色 * exp(-吸光度)`。
 *    吸光度が加算されている = 透過率が乗算されているので、これが減法混色になる。
 * 2. **顔料そのものの色** — 吸光度を量で割って「濃度 1 のときの色」に戻したもの。
 *    白インクは吸光度 0 なので白になり、量だけが積み上がる。
 *
 * インクが薄いうちは 1 が、厚く乗るほど 2 が支配的になるよう混ぜる。
 * これで、白い台紙では今までどおり透けた減法混色になり、
 * 黒い台紙では顔料の色がちゃんと乗る。
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
/** 顔料 1 単位あたりの被覆の強さ */
uniform float uCoverage;

vec3 linearToSrgb (vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main () {
  vec4 dye = max(texture(uDye, vUv), vec4(0.0));
  vec3 absorbance = dye.rgb;
  float pigment = dye.a;

  vec3 throughWater = uWaterColor * exp(-absorbance);
  // 量で正規化すると、何度重ねても「そのインク自身の色」に収束する。
  // 実際、顔料を厚く盛っても黒にはならず顔料の色になる
  vec3 pigmentColor = exp(-absorbance / max(pigment, 0.001));

  float opacity = 1.0 - exp(-pigment * uCoverage);
  vec3 color = mix(throughWater, pigmentColor, opacity);

#ifdef SHADING
  // 顔料の量の勾配を水面の起伏に見立てて陰影を付けると、
  // 縁が締まって「乗っている」感じが出る。
  // 吸光度ではなく量を見ているので、白インクにも陰影が付く
  float dL = texture(uDye, vL).a;
  float dR = texture(uDye, vR).a;
  float dT = texture(uDye, vT).a;
  float dB = texture(uDye, vB).a;

  vec3 normal = normalize(vec3(dR - dL, dT - dB, 0.6));
  float lit = clamp(dot(normal, normalize(vec3(-0.35, 0.35, 1.0))), 0.0, 1.0);
  color *= mix(1.0, 0.62 + 0.53 * lit, clamp(pigment, 0.0, 1.0));
#endif

  fragColor = vec4(linearToSrgb(color), 1.0);
}
`;
