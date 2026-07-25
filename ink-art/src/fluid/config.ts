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
  /** インクの滲み(拡散係数)。N-2 でユーザー調整可能にする予定 */
  dyeDiffusion: number;
  /** インク一滴の半径。画面の高さを 1 とした比率 */
  splatRadius: number;
  /** 着水時に水を押しのける強さ */
  dropImpulse: number;
  /** ドラッグ速度を水流に変換する係数 */
  splatForce: number;
  /**
   * インクの濃さ。1.0 で、原液の芯がちょうどスウォッチの色に一致する。
   * 薄まりは広がりに任せる
   */
  inkStrength: number;
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
  dyeDiffusion: 0.05,
  splatRadius: 0.055,
  dropImpulse: 0.0055,
  splatForce: 5200,
  inkStrength: 1,
  shading: true,
  maxPixelRatio: 2,
};

/** 台紙(水)のデフォルト色: 白〜わずかに青みがかった水色 */
export const DEFAULT_WATER_COLOR = '#eef4f7';
