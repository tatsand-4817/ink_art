import type { TextureFormat } from './context.ts';

export interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  /** 指定のテクスチャユニットにバインドし、そのユニット番号を返す */
  attach(unit: number): number;
}

export interface DoubleFBO {
  read: FBO;
  write: FBO;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  swap(): void;
}

export function createFBO(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  format: TextureFormat,
  filter: number,
): FBO {
  const texture = gl.createTexture();
  if (!texture) throw new Error('テクスチャを作成できませんでした。');

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    format.internalFormat,
    width,
    height,
    0,
    format.format,
    format.type,
    null,
  );

  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('フレームバッファを作成できませんでした。');

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    texture,
    fbo,
    width,
    height,
    texelSizeX: 1 / width,
    texelSizeY: 1 / height,
    attach(unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return unit;
    },
  };
}

export function createDoubleFBO(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  format: TextureFormat,
  filter: number,
): DoubleFBO {
  return {
    read: createFBO(gl, width, height, format, filter),
    write: createFBO(gl, width, height, format, filter),
    width,
    height,
    texelSizeX: 1 / width,
    texelSizeY: 1 / height,
    swap() {
      const temp = this.read;
      this.read = this.write;
      this.write = temp;
    },
  };
}

export function deleteFBO(gl: WebGL2RenderingContext, target: FBO): void {
  gl.deleteFramebuffer(target.fbo);
  gl.deleteTexture(target.texture);
}

export function deleteDoubleFBO(gl: WebGL2RenderingContext, target: DoubleFBO): void {
  deleteFBO(gl, target.read);
  deleteFBO(gl, target.write);
}
