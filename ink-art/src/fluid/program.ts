function withDefines(source: string, defines: readonly string[]): string {
  if (defines.length === 0) return source;
  // #version は必ず先頭行でなければならないので、その直後に差し込む
  const newline = source.indexOf('\n');
  const versionLine = source.slice(0, newline + 1);
  const body = source.slice(newline + 1);
  return versionLine + defines.map((name) => `#define ${name}\n`).join('') + body;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  defines: readonly string[],
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('シェーダを作成できませんでした。');

  gl.shaderSource(shader, withDefines(source, defines));
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`シェーダのコンパイルに失敗しました: ${log ?? '(詳細不明)'}`);
  }

  return shader;
}

/** シェーダプログラムと、その uniform ロケーションをまとめたもの */
export class GLProgram {
  readonly program: WebGLProgram;
  readonly uniforms: Record<string, WebGLUniformLocation> = {};

  private readonly gl: WebGL2RenderingContext;

  constructor(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    defines: readonly string[] = [],
  ) {
    this.gl = gl;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource, defines);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, defines);

    const program = gl.createProgram();
    if (!program) throw new Error('シェーダプログラムを作成できませんでした。');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // リンク後はシェーダ本体を保持する必要がない
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`シェーダのリンクに失敗しました: ${log ?? '(詳細不明)'}`);
    }

    this.program = program;

    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (!info) continue;
      const location = gl.getUniformLocation(program, info.name);
      if (location) this.uniforms[info.name] = location;
    }
  }

  bind(): void {
    this.gl.useProgram(this.program);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
