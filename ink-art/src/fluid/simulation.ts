import { inkDeposit, toLinearTriplet, type RGB } from './color.ts';
import { DEFAULT_SIM_CONFIG, type SimConfig } from './config.ts';
import { createGLResources, type GLResources, type TextureFormat } from './context.ts';
import {
  createDoubleFBO,
  createFBO,
  deleteDoubleFBO,
  deleteFBO,
  type DoubleFBO,
  type FBO,
} from './framebuffer.ts';
import { GLProgram } from './program.ts';
import {
  ADVECTION_SHADER,
  BASE_VERTEX_SHADER,
  CLEAR_SHADER,
  COPY_SHADER,
  CURL_SHADER,
  DIFFUSION_SHADER,
  DISPLAY_SHADER,
  DIVERGENCE_SHADER,
  GRADIENT_SUBTRACT_SHADER,
  PRESSURE_SHADER,
  SPLAT_SHADER,
  VORTICITY_SHADER,
} from './shaders.ts';

/** ドラッグ中の一筆。座標は左下原点の 0..1 正規化座標 */
export interface InkSplat {
  x: number;
  y: number;
  /** 直前の位置からの移動量。水流に変換される */
  dx: number;
  dy: number;
  color: RGB;
}

/** 実際に描画キューへ積まれる単位 */
interface QueuedSplat {
  x: number;
  y: number;
  radius: number;
  /** 0 = なだらかなガウス / 1 = 芯のある円盤 */
  hardness: number;
  /** 速度場に加える量。0 なら速度パスを飛ばす */
  velocity: [number, number] | null;
  /** 染料場に加える量 `[吸光度 R, G, B, 顔料の量]`。null なら染料パスを飛ばす */
  deposit: [number, number, number, number] | null;
}

interface Resolution {
  width: number;
  height: number;
}

function scaledResolution(gl: WebGL2RenderingContext, shortSide: number): Resolution {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const aspect = width > height ? width / height : height / width;
  const min = Math.max(Math.round(shortSide), 1);
  const max = Math.max(Math.round(shortSide * aspect), 1);
  return width > height ? { width: max, height: min } : { width: min, height: max };
}

export class InkSimulation {
  private readonly canvas: HTMLCanvasElement;
  private readonly resources: GLResources;
  private readonly gl: WebGL2RenderingContext;

  private readonly copyProgram: GLProgram;
  private readonly clearProgram: GLProgram;
  private readonly splatProgram: GLProgram;
  private readonly advectionProgram: GLProgram;
  private readonly diffusionProgram: GLProgram;
  private readonly divergenceProgram: GLProgram;
  private readonly curlProgram: GLProgram;
  private readonly vorticityProgram: GLProgram;
  private readonly pressureProgram: GLProgram;
  private readonly gradientProgram: GLProgram;
  private readonly displayProgram: GLProgram;

  private velocity!: DoubleFBO;
  private dye!: DoubleFBO;
  private pressure!: DoubleFBO;
  private divergence!: FBO;
  private curl!: FBO;

  private config: SimConfig;
  private waterColor: [number, number, number];
  private readonly pending: QueuedSplat[] = [];

  private animationFrame = 0;
  private lastTime = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, waterColor: RGB, config: Partial<SimConfig> = {}) {
    this.canvas = canvas;
    this.config = { ...DEFAULT_SIM_CONFIG, ...config };
    this.waterColor = toLinearTriplet(waterColor);

    this.resources = createGLResources(canvas);
    this.gl = this.resources.gl;

    // 浮動小数点テクスチャの線形補間が使えない環境ではシェーダ側で補間する
    const advectionDefines = this.resources.linearFiltering ? [] : ['MANUAL_FILTERING'];

    const gl = this.gl;
    this.copyProgram = new GLProgram(gl, BASE_VERTEX_SHADER, COPY_SHADER);
    this.clearProgram = new GLProgram(gl, BASE_VERTEX_SHADER, CLEAR_SHADER);
    this.splatProgram = new GLProgram(gl, BASE_VERTEX_SHADER, SPLAT_SHADER);
    this.advectionProgram = new GLProgram(gl, BASE_VERTEX_SHADER, ADVECTION_SHADER, advectionDefines);
    this.diffusionProgram = new GLProgram(gl, BASE_VERTEX_SHADER, DIFFUSION_SHADER);
    this.divergenceProgram = new GLProgram(gl, BASE_VERTEX_SHADER, DIVERGENCE_SHADER);
    this.curlProgram = new GLProgram(gl, BASE_VERTEX_SHADER, CURL_SHADER);
    this.vorticityProgram = new GLProgram(gl, BASE_VERTEX_SHADER, VORTICITY_SHADER);
    this.pressureProgram = new GLProgram(gl, BASE_VERTEX_SHADER, PRESSURE_SHADER);
    this.gradientProgram = new GLProgram(gl, BASE_VERTEX_SHADER, GRADIENT_SUBTRACT_SHADER);
    this.displayProgram = new GLProgram(gl, BASE_VERTEX_SHADER, DISPLAY_SHADER);

    this.setupQuad();
    this.syncCanvasSize();
    this.initFramebuffers();
  }

  // ---------------------------------------------------------------- public API

  get precision(): string {
    return this.resources.precision;
  }

  get simulationSize(): Resolution {
    return { width: this.velocity.width, height: this.velocity.height };
  }

  get dyeSize(): Resolution {
    return { width: this.dye.width, height: this.dye.height };
  }

  setWaterColor(color: RGB): void {
    this.waterColor = toLinearTriplet(color);
  }

  updateConfig(patch: Partial<SimConfig>): void {
    const needsResize =
      (patch.simResolution !== undefined && patch.simResolution !== this.config.simResolution) ||
      (patch.dyeResolution !== undefined && patch.dyeResolution !== this.config.dyeResolution);

    this.config = { ...this.config, ...patch };
    if (needsResize) this.initFramebuffers();
  }

  /**
   * ドラッグ中の一筆。動かした向きがそのまま水流になる(F-2)。
   * 実際の反映は次フレーム。
   */
  splat(splat: InkSplat): void {
    const { splatRadius, splatForce, inkStrength } = this.config;

    this.pending.push({
      x: splat.x,
      y: splat.y,
      radius: splatRadius * 1.5,
      hardness: 0,
      velocity: [splat.dx * splatForce, splat.dy * splatForce],
      deposit: null,
    });

    // 一筆の濃さは「動いた距離」で決める。
    // ポインタイベントの発火頻度に比例させてしまうと、120Hz 端末で同じ
    // ドラッグをしただけでインクが倍載って真っ黒に潰れる。
    // 半径 2 つ分だけ動けば一滴と同じ濃さになるように正規化している。
    const travel = Math.hypot(splat.dx, splat.dy);
    const density = Math.min(travel / (2 * splatRadius), 1);
    if (density <= 0) return;

    this.pending.push({
      x: splat.x,
      y: splat.y,
      radius: splatRadius,
      hardness: 1,
      velocity: null,
      deposit: inkDeposit(splat.color, inkStrength * density),
    });
  }

  /**
   * タップによる一滴(F-2)。
   * 染料を落とすと同時に、着水点の周囲へ外向きの流れを作る。
   * これが無いと静止タップのインクがその場で丸く滲むだけになってしまう。
   */
  drop(x: number, y: number, color: RGB): void {
    const { splatRadius, splatForce, dropImpulse, inkStrength } = this.config;
    const aspect = this.canvas.width / this.canvas.height;

    this.pending.push({
      x,
      y,
      radius: splatRadius,
      hardness: 1,
      velocity: null,
      deposit: inkDeposit(color, inkStrength),
    });

    const petals = 8;
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      this.pending.push({
        // 滴の縁に沿って押し出すと、水面を押しのけたような広がり方になる
        x: x + (ux * splatRadius) / aspect,
        y: y + uy * splatRadius,
        radius: splatRadius,
        hardness: 0,
        // 速度は画面ピクセル基準で等方なので、向きはそのまま渡してよい
        velocity: [ux * dropImpulse * splatForce, uy * dropImpulse * splatForce],
        deposit: null,
      });
    }
  }

  clear(): void {
    const gl = this.gl;
    for (const target of [this.dye.read, this.dye.write, this.velocity.read, this.velocity.write, this.pressure.read, this.pressure.write]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pending.length = 0;
  }

  /**
   * デバッグ/検証用。表示内容を再描画して 1 ピクセル読み出す。
   * 座標は左下原点の 0..1。混色が意図どおり起きているかの確認に使う。
   */
  samplePixel(u: number, v: number): [number, number, number] {
    this.render();
    const pixel = new Uint8Array(4);
    this.gl.readPixels(
      Math.round(u * (this.canvas.width - 1)),
      Math.round(v * (this.canvas.height - 1)),
      1,
      1,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      pixel,
    );
    return [pixel[0], pixel[1], pixel[2]];
  }

  start(): void {
    if (this.animationFrame !== 0 || this.disposed) return;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.animationFrame = requestAnimationFrame(loop);
      this.tick(now);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animationFrame !== 0) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  dispose(): void {
    this.stop();
    this.disposed = true;

    const gl = this.gl;
    deleteDoubleFBO(gl, this.velocity);
    deleteDoubleFBO(gl, this.dye);
    deleteDoubleFBO(gl, this.pressure);
    deleteFBO(gl, this.divergence);
    deleteFBO(gl, this.curl);

    for (const program of [
      this.copyProgram,
      this.clearProgram,
      this.splatProgram,
      this.advectionProgram,
      this.diffusionProgram,
      this.divergenceProgram,
      this.curlProgram,
      this.vorticityProgram,
      this.pressureProgram,
      this.gradientProgram,
      this.displayProgram,
    ]) {
      program.dispose();
    }
  }

  // ------------------------------------------------------------------ internals

  private setupQuad(): void {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);

    const indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
  }

  private blit(target: FBO | null): void {
    const gl = this.gl;
    if (target === null) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  /** CSS サイズと devicePixelRatio から描画バッファのサイズを合わせる */
  private syncCanvasSize(): boolean {
    const cssWidth = Math.max(this.canvas.clientWidth, 1);
    const cssHeight = Math.max(this.canvas.clientHeight, 1);

    let ratio = Math.min(window.devicePixelRatio || 1, this.config.maxPixelRatio);
    // 画面が大きいほど等倍の負荷が効いてくるので、総ピクセル数で頭打ちにする
    const budget = this.config.maxCanvasPixels / (cssWidth * cssHeight);
    if (ratio * ratio > budget) ratio = Math.sqrt(budget);

    const width = Math.max(Math.floor(cssWidth * ratio), 1);
    const height = Math.max(Math.floor(cssHeight * ratio), 1);

    if (this.canvas.width === width && this.canvas.height === height) return false;

    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  private initFramebuffers(): void {
    const gl = this.gl;
    const { formatRGBA, formatRG, formatR, linearFiltering } = this.resources;
    const filter = linearFiltering ? gl.LINEAR : gl.NEAREST;

    const sim = scaledResolution(gl, this.config.simResolution);
    const dye = scaledResolution(gl, this.config.dyeResolution);

    this.velocity = this.velocity
      ? this.resizeDoubleFBO(this.velocity, sim, formatRG, filter)
      : createDoubleFBO(gl, sim.width, sim.height, formatRG, filter);

    this.dye = this.dye
      ? this.resizeDoubleFBO(this.dye, dye, formatRGBA, filter)
      : createDoubleFBO(gl, dye.width, dye.height, formatRGBA, filter);

    // 圧力・発散・カールは毎フレーム作り直されるので中身を引き継ぐ必要がない
    if (this.pressure) deleteDoubleFBO(gl, this.pressure);
    if (this.divergence) deleteFBO(gl, this.divergence);
    if (this.curl) deleteFBO(gl, this.curl);

    this.pressure = createDoubleFBO(gl, sim.width, sim.height, formatR, gl.NEAREST);
    this.divergence = createFBO(gl, sim.width, sim.height, formatR, gl.NEAREST);
    this.curl = createFBO(gl, sim.width, sim.height, formatR, gl.NEAREST);
  }

  /** リサイズ時に中身を引き継ぐ(描きかけの模様を消さない) */
  private resizeDoubleFBO(
    target: DoubleFBO,
    size: Resolution,
    format: TextureFormat,
    filter: number,
  ): DoubleFBO {
    if (target.width === size.width && target.height === size.height) return target;

    const gl = this.gl;
    const next = createDoubleFBO(gl, size.width, size.height, format, filter);

    this.copyProgram.bind();
    gl.uniform2f(this.copyProgram.uniforms.texelSize, next.texelSizeX, next.texelSizeY);
    gl.uniform1i(this.copyProgram.uniforms.uTexture, target.read.attach(0));
    this.blit(next.read);

    deleteDoubleFBO(gl, target);
    return next;
  }

  private tick(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 60);
    this.lastTime = now;

    if (this.syncCanvasSize()) this.initFramebuffers();

    this.applyPendingSplats();
    this.step(dt);
    this.render();
  }

  private applyPendingSplats(): void {
    if (this.pending.length === 0) return;

    const gl = this.gl;
    const program = this.splatProgram;
    program.bind();
    gl.uniform1f(program.uniforms.aspectRatio, this.canvas.width / this.canvas.height);

    for (const splat of this.pending) {
      gl.uniform2f(program.uniforms.uPoint, splat.x, splat.y);
      gl.uniform1f(program.uniforms.uRadius, splat.radius);
      gl.uniform1f(program.uniforms.uHardness, splat.hardness);

      if (splat.velocity) {
        gl.uniform1i(program.uniforms.uTarget, this.velocity.read.attach(0));
        gl.uniform4f(program.uniforms.uValue, splat.velocity[0], splat.velocity[1], 0, 0);
        this.blit(this.velocity.write);
        this.velocity.swap();
      }

      if (splat.deposit) {
        // 染料場には吸光度を加算する。重なれば自動的に減法混色になる(F-5)
        gl.uniform1i(program.uniforms.uTarget, this.dye.read.attach(0));
        gl.uniform4f(
          program.uniforms.uValue,
          splat.deposit[0],
          splat.deposit[1],
          splat.deposit[2],
          splat.deposit[3],
        );
        this.blit(this.dye.write);
        this.dye.swap();
      }
    }

    this.pending.length = 0;
  }

  private step(dt: number): void {
    const gl = this.gl;
    const { velocity, dye, pressure, divergence, curl, config } = this;

    // --- 渦度を求めて、潰れかけた渦を押し戻す
    this.curlProgram.bind();
    gl.uniform2f(this.curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(this.curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    this.blit(curl);

    this.vorticityProgram.bind();
    gl.uniform2f(this.vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(this.vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(this.vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(this.vorticityProgram.uniforms.uCurlStrength, config.curl);
    gl.uniform1f(this.vorticityProgram.uniforms.dt, dt);
    this.blit(velocity.write);
    velocity.swap();

    // --- 発散を求める
    this.divergenceProgram.bind();
    gl.uniform2f(this.divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(this.divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    this.blit(divergence);

    // --- 前フレームの圧力を減衰させて初期値にすると収束が速い
    this.clearProgram.bind();
    gl.uniform2f(this.clearProgram.uniforms.texelSize, pressure.texelSizeX, pressure.texelSizeY);
    gl.uniform1i(this.clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(this.clearProgram.uniforms.value, config.pressure);
    this.blit(pressure.write);
    pressure.swap();

    // --- 圧力を Jacobi 反復で解く
    this.pressureProgram.bind();
    gl.uniform2f(this.pressureProgram.uniforms.texelSize, pressure.texelSizeX, pressure.texelSizeY);
    gl.uniform1i(this.pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.pressureIterations; i++) {
      gl.uniform1i(this.pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      this.blit(pressure.write);
      pressure.swap();
    }

    // --- 圧力勾配を引いて非圧縮にする
    this.gradientProgram.bind();
    gl.uniform2f(this.gradientProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(this.gradientProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(this.gradientProgram.uniforms.uVelocity, velocity.read.attach(1));
    this.blit(velocity.write);
    velocity.swap();

    // --- 移流(速度場そのもの → 染料場)
    this.advectionProgram.bind();
    gl.uniform2f(this.advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!this.resources.linearFiltering) {
      gl.uniform2f(
        this.advectionProgram.uniforms.dyeTexelSize,
        velocity.texelSizeX,
        velocity.texelSizeY,
      );
    }
    gl.uniform1f(this.advectionProgram.uniforms.dt, dt);
    gl.uniform1i(this.advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(this.advectionProgram.uniforms.uSource, velocity.read.attach(0));
    gl.uniform1f(this.advectionProgram.uniforms.dissipation, config.velocityDissipation);
    this.blit(velocity.write);
    velocity.swap();

    if (!this.resources.linearFiltering) {
      gl.uniform2f(this.advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    }
    gl.uniform1i(this.advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(this.advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(this.advectionProgram.uniforms.dissipation, config.densityDissipation);
    this.blit(dye.write);
    dye.swap();

    // --- 滲み
    if (config.dyeDiffusion > 0) {
      this.diffusionProgram.bind();
      gl.uniform2f(this.diffusionProgram.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(this.diffusionProgram.uniforms.uTexture, dye.read.attach(0));
      // フレームレートで滲み方が変わらないように dt でスケールする
      gl.uniform1f(
        this.diffusionProgram.uniforms.uAmount,
        Math.min(config.dyeDiffusion * dt * 60, 1),
      );
      this.blit(dye.write);
      dye.swap();
    }
  }

  private render(): void {
    const gl = this.gl;
    this.displayProgram.bind();
    gl.uniform2f(this.displayProgram.uniforms.texelSize, this.dye.texelSizeX, this.dye.texelSizeY);
    gl.uniform1i(this.displayProgram.uniforms.uDye, this.dye.read.attach(0));
    gl.uniform1f(this.displayProgram.uniforms.uCoverage, this.config.coverage);
    gl.uniform1f(this.displayProgram.uniforms.uShading, this.config.shading);
    gl.uniform3f(
      this.displayProgram.uniforms.uWaterColor,
      this.waterColor[0],
      this.waterColor[1],
      this.waterColor[2],
    );
    this.blit(null);
  }
}
