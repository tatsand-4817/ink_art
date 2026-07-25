import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { RGB } from '../fluid/color.ts';
import { WebGLUnsupportedError } from '../fluid/context.ts';
import { InkSimulation } from '../fluid/simulation.ts';
import { attachInkPointer } from '../input/pointer.ts';

export interface InkCanvasHandle {
  clear: () => void;
}

interface Props {
  inkColor: RGB;
  /** 一投あたりのインクの量。1 が原液 */
  inkAmount: number;
  waterColor: RGB;
  ref?: Ref<InkCanvasHandle>;
}

export function InkCanvas({ inkColor, inkAmount, waterColor, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<InkSimulation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // シミュレーションは張り替えずに使い回すので、変化する値は ref 経由で渡す
  const inkColorRef = useRef(inkColor);
  const waterColorRef = useRef(waterColor);
  const inkAmountRef = useRef(inkAmount);
  inkColorRef.current = inkColor;

  useImperativeHandle(ref, () => ({
    clear: () => simulationRef.current?.clear(),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let simulation: InkSimulation;
    try {
      simulation = new InkSimulation(canvas, waterColorRef.current, {
        inkStrength: inkAmountRef.current,
      });
    } catch (cause) {
      setError(
        cause instanceof WebGLUnsupportedError
          ? cause.message
          : `シミュレーションを初期化できませんでした: ${String(cause)}`,
      );
      return;
    }

    simulationRef.current = simulation;
    simulation.start();

    if (import.meta.env.DEV) {
      // 実機検証時にコンソールからパラメータを触れるようにしておく
      (window as unknown as { __inkSim?: InkSimulation }).__inkSim = simulation;
    }

    const detachPointer = attachInkPointer(canvas, {
      getColor: () => inkColorRef.current,
      onDrop: (x, y, color) => simulation.drop(x, y, color),
      onStroke: (splat) => simulation.splat(splat),
    });

    return () => {
      detachPointer();
      simulation.dispose();
      simulationRef.current = null;
    };
  }, []);

  useEffect(() => {
    waterColorRef.current = waterColor;
    simulationRef.current?.setWaterColor(waterColor);
  }, [waterColor]);

  useEffect(() => {
    inkAmountRef.current = inkAmount;
    simulationRef.current?.updateConfig({ inkStrength: inkAmount });
  }, [inkAmount]);

  if (error) {
    return (
      <div className="canvas-error" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="ink-canvas" />;
}
