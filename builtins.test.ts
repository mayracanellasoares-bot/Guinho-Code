import { describe, it, expect } from 'vitest';
import { createBuiltins } from './builtins.ts';

describe('Built-ins - Tipos de retorno e Nomes acentuados', () => {
  it('mapa aceita funções com retornos de tipos diferentes (number, boolean)', () => {
    let touched = true;
    const builtins = createBuiltins({
      isKeyDown: (k) => k === 'espaco',
      isTouchActive: () => touched,
      checkCollision: () => true
    });

    const aleatorio = builtins.get('aleatorio')!([10, 20]);
    expect(typeof aleatorio).toBe('number');
    expect(aleatorio).toBeGreaterThanOrEqual(10);
    expect(aleatorio).toBeLessThanOrEqual(20);

    const dist = builtins.get('distancia')!([0, 0, 3, 4]);
    expect(typeof dist).toBe('number');
    expect(dist).toBe(5);

    const col = builtins.get('colide')!([{}, {}]);
    expect(typeof col).toBe('boolean');
    expect(col).toBe(true);

    const tec = builtins.get('tecla')!(['espaco']);
    expect(typeof tec).toBe('boolean');
    expect(tec).toBe(true);

    const toq = builtins.get('toque')!([]);
    expect(typeof toq).toBe('boolean');
    expect(toq).toBe(true);
  });

  it('trata consistentemente nomes acentuados e sem acento', () => {
    const builtins = createBuiltins();

    expect(builtins.has('aleatorio')).toBe(true);
    expect(builtins.has('aleatório')).toBe(true);
    expect(builtins.has('distancia')).toBe(true);
    expect(builtins.has('distância')).toBe(true);

    const fn1 = builtins.get('aleatorio');
    const fn2 = builtins.get('aleatório');
    expect(fn1).toBe(fn2);

    const dist1 = builtins.get('distancia');
    const dist2 = builtins.get('distância');
    expect(dist1).toBe(dist2);
  });

  it('funções matemáticas retornam number', () => {
    const builtins = createBuiltins();

    expect(builtins.get('seno')!([90])).toBeCloseTo(1);
    expect(builtins.get('cosseno')!([0])).toBeCloseTo(1);
    expect(builtins.get('raiz')!([16])).toBe(4);
    expect(builtins.get('absoluto')!([-42])).toBe(42);
    expect(builtins.get('piso')!([3.9])).toBe(3);
    expect(builtins.get('teto')!([3.1])).toBe(4);
    expect(builtins.get('arredonda')!([3.6])).toBe(4);
  });
});
