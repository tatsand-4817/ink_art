export interface TextureFormat {
  internalFormat: number;
  format: number;
  type: number;
}

export interface GLResources {
  gl: WebGL2RenderingContext;
  /** RGBA(染料場) */
  formatRGBA: TextureFormat;
  /** RG(速度場)。非対応環境では RGBA に縮退する */
  formatRG: TextureFormat;
  /** R(圧力・発散・カール)。非対応環境では RGBA に縮退する */
  formatR: TextureFormat;
  /** 浮動小数点テクスチャに対してハードウェア線形補間が使えるか */
  linearFiltering: boolean;
  /** デバッグ表示用 */
  precision: 'half-float' | 'float';
}

export class WebGLUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebGLUnsupportedError';
  }
}

const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  depth: false,
  stencil: false,
  antialias: false,
  // 常時 true にすると描画が遅くなるため、保存(F-6)は高解像度で再描画する方式を採る
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
};

/** 指定フォーマットが FBO のカラーアタッチメントとして実際に使えるかを実測する */
function isRenderable(gl: WebGL2RenderingContext, fmt: TextureFormat): boolean {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, 4, 4, 0, fmt.format, fmt.type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(texture);

  return status === gl.FRAMEBUFFER_COMPLETE;
}

/**
 * 使えるフォーマットを実測で決める。
 * チャンネル数の少ないフォーマットが描画不可なら RGBA に縮退させる
 * (帯域は食うが、動かないよりはよい)。
 */
function resolveFormat(
  gl: WebGL2RenderingContext,
  candidate: TextureFormat,
  fallback: TextureFormat,
): TextureFormat {
  return isRenderable(gl, candidate) ? candidate : fallback;
}

export function createGLResources(canvas: HTMLCanvasElement): GLResources {
  const gl = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES);
  if (!gl) {
    throw new WebGLUnsupportedError('WebGL2 に対応していないブラウザです。');
  }

  // WebGL2 で 16F/32F を描画先にするには色バッファ拡張が要る
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  const floatLinear = gl.getExtension('OES_texture_float_linear');

  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  // iOS Safari では half float を使う。half float は WebGL2 コアで線形補間可能
  const halfRGBA: TextureFormat = {
    internalFormat: gl.RGBA16F,
    format: gl.RGBA,
    type: gl.HALF_FLOAT,
  };

  if (isRenderable(gl, halfRGBA)) {
    return {
      gl,
      formatRGBA: halfRGBA,
      formatRG: resolveFormat(
        gl,
        { internalFormat: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT },
        halfRGBA,
      ),
      formatR: resolveFormat(
        gl,
        { internalFormat: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT },
        halfRGBA,
      ),
      linearFiltering: true,
      precision: 'half-float',
    };
  }

  // half float が描画先にできない環境向けのフォールバック
  const fullRGBA: TextureFormat = {
    internalFormat: gl.RGBA32F,
    format: gl.RGBA,
    type: gl.FLOAT,
  };

  if (isRenderable(gl, fullRGBA)) {
    return {
      gl,
      formatRGBA: fullRGBA,
      formatRG: resolveFormat(
        gl,
        { internalFormat: gl.RG32F, format: gl.RG, type: gl.FLOAT },
        fullRGBA,
      ),
      formatR: resolveFormat(
        gl,
        { internalFormat: gl.R32F, format: gl.RED, type: gl.FLOAT },
        fullRGBA,
      ),
      // float の線形補間は拡張が必要。無ければシェーダ側で手動補間する
      linearFiltering: floatLinear !== null,
      precision: 'float',
    };
  }

  throw new WebGLUnsupportedError(
    '浮動小数点テクスチャへの描画に対応していないため、流体シミュレーションを実行できません。',
  );
}
