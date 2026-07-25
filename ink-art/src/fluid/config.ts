/**
 * シミュレーションのチューニング値。
 * 解像度のデフォルトは実機計測後に確定させる(要件定義 §10 未確定事項)。
 */
export interface SimConfig {
  /** 速度・圧力場の解像度(短辺基準)。表示解像度とは独立 */
  simResolution: number;
  /** 染料場の解像度(短辺基準) */
  dyeResolution: number;
  /**
   * インクの減衰率。半減期はおよそ ln2 / この値[秒]。
   * 作品を作り込むアプリなので、消えるというより「ゆっくり薄まる」程度に留める
   */
  densityDissipation: number;
  /** 水の粘性による減速。半減期はおよそ ln2 / この値[秒] */
  velocityDissipation: number;
  /** 圧力場の残留率(Jacobi の初期値に前フレームを引き継ぐ量) */
  pressure: number;
  /** Jacobi 反復回数。モバイルでは 20 前後まで落とす */
  pressureIterations: number;
  /** 渦度閉じ込めの強さ。大きいほど渦が長生きする。上げすぎると発散する */
  curl: number;
  /**
   * インクの滲み(拡散係数)。1 フレームあたりに隣へ広がる割合で、
   * フレームレートに依らないよう内部で dt を掛けている。N-2 でユーザー調整可能にする予定
   */
  dyeDiffusion: number;
  /** インク一滴の半径。画面の高さを 1 とした比率 */
  splatRadius: number;
  /** 着水時に水を押しのける強さ */
  dropImpulse: number;
  /** ドラッグ速度を水流に変換する係数 */
  splatForce: number;
  /**
   * インクの量(濃さ)。1.0 で、原液の芯がちょうどスウォッチの色に一致する。
   * 下げると台紙が透ける水彩寄り、上げると顔料が前に出た不透明寄りになる
   */
  inkStrength: number;
  /**
   * 顔料 1 単位あたりの被覆の強さ。
   * 上げるほど台紙が透けなくなり、インク自身の色が前に出る
   */
  coverage: number;
  /** 濃度勾配による陰影付け */
  shading: boolean;
  /** devicePixelRatio の上限 */
  maxPixelRatio: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  simResolution: 128,
  dyeResolution: 1024,
  densityDissipation: 0.003,
  velocityDissipation: 0.25,
  pressure: 0.8,
  pressureIterations: 28,
  curl: 10,
  dyeDiffusion: 0.035,
  splatRadius: 0.055,
  dropImpulse: 0.0055,
  splatForce: 5200,
  inkStrength: 1,
  coverage: 1.6,
  shading: true,
  maxPixelRatio: 2,
};

/**
 * インクの量スライダーの範囲。1 が原液。
 * 上限を 1.5 で切っているのは、それ以上盛っても被覆率が飽和して
 * 一滴の見た目が変わらなくなるため(スライダーの上半分が死ぬ)。
 */
export const INK_AMOUNT_RANGE = { min: 0.1, max: 1.5, step: 0.05 } as const;

