export type Builtin = (args: unknown[]) => unknown;

export interface BuiltinContext {
  isKeyDown: (key: string) => boolean;
  isTouchActive: () => boolean;
  getActor: (name: string) => { x: number; y: number; width: number; height: number } | undefined;
  checkCollision: (a: unknown, b: unknown) => boolean;
  getTime: () => number;
}

export function createBuiltins(context?: Partial<BuiltinContext>): Map<string, Builtin> {
  const isKeyDown = context?.isKeyDown ?? (() => false);
  const isTouchActive = context?.isTouchActive ?? (() => false);
  const checkCollision = context?.checkCollision ?? (() => false);
  const getTime = context?.getTime ?? (() => performance.now() / 1000);

  const aleatorioFn: Builtin = (args: unknown[]): number => {
    const min = typeof args[0] === 'number' ? args[0] : 0;
    const max = typeof args[1] === 'number' ? args[1] : 100;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const distanciaFn: Builtin = (args: unknown[]): number => {
    const x1 = Number(args[0]) || 0;
    const y1 = Number(args[1]) || 0;
    const x2 = Number(args[2]) || 0;
    const y2 = Number(args[3]) || 0;
    return Math.hypot(x2 - x1, y2 - y1);
  };

  const colideFn: Builtin = (args: unknown[]): boolean => {
    return checkCollision(args[0], args[1]);
  };

  const teclaFn: Builtin = (args: unknown[]): boolean => {
    const aliases: Record<string, string> = {
      esquerda: 'arrowleft', direita: 'arrowright', cima: 'arrowup', baixo: 'arrowdown',
      espaco: ' ', espaço: ' ', enter: 'enter'
    };
    const raw = String(args[0] ?? '').toLowerCase();
    const key = aliases[raw] ?? raw;
    return isKeyDown(key);
  };

  const toqueFn: Builtin = (): boolean => {
    return isTouchActive();
  };

  const senoFn: Builtin = (args: unknown[]): number => {
    const ang = Number(args[0]) || 0;
    return Math.sin((ang * Math.PI) / 180);
  };

  const cossenoFn: Builtin = (args: unknown[]): number => {
    const ang = Number(args[0]) || 0;
    return Math.cos((ang * Math.PI) / 180);
  };

  const raizFn: Builtin = (args: unknown[]): number => {
    const val = Number(args[0]) || 0;
    return Math.sqrt(Math.max(0, val));
  };

  const absolutoFn: Builtin = (args: unknown[]): number => {
    return Math.abs(Number(args[0]) || 0);
  };

  const pisoFn: Builtin = (args: unknown[]): number => {
    return Math.floor(Number(args[0]) || 0);
  };

  const tetoFn: Builtin = (args: unknown[]): number => {
    return Math.ceil(Number(args[0]) || 0);
  };

  const arredondaFn: Builtin = (args: unknown[]): number => {
    return Math.round(Number(args[0]) || 0);
  };

  const tempoFn: Builtin = (): number => {
    return getTime();
  };

  const builtins: Array<[string, Builtin]> = [
    ['aleatorio', aleatorioFn],
    ['aleatório', aleatorioFn],
    ['colide', colideFn],
    ['distancia', distanciaFn],
    ['distância', distanciaFn],
    ['tecla', teclaFn],
    ['toque', toqueFn],
    ['seno', senoFn],
    ['cosseno', cossenoFn],
    ['raiz', raizFn],
    ['absoluto', absolutoFn],
    ['piso', pisoFn],
    ['teto', tetoFn],
    ['arredonda', arredondaFn],
    ['tempo', tempoFn]
  ];

  return new Map<string, Builtin>(builtins);
}
