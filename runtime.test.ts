import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer.ts';
import { parse } from '../src/parser.ts';
import { Game } from '../src/runtime/game.ts';
import { checkAABB } from '../src/runtime/collision.ts';

describe('Runtime - Atores, Quique e Pontuação de Pong', () => {
  it('permite que a bola saia da tela na horizontal para pontuar quando quique é vertical', () => {
    const code = `
      tela 160x120
      fundo preto

      pontos2 recebe 0

      ator Bola
        desenho quadrado 4, branco
        posição 1, 50
        velocidade -5, 0
        quica nas bordas verticais
        quando atualiza:
          se x < 0 então
            pontos2 recebe pontos2 + 1
          fim
        fim
      fim
    `;
    const ast = parse(tokenize(code));
    const game = new Game(ast);

    const bola = game.actors.get('bola')!;
    expect(bola.x).toBe(1);

    // Step 1 frame
    game.step();

    // The ball must have moved to 1 - 5 = -4, WITHOUT being clamped to 0!
    expect(bola.x).toBeLessThan(0);
    // And the point was scored!
    expect(game.interpreter.globalEnv.get('pontos2')).toBe(1);
  });

  it('quica nas bordas verticais inverte velocidade vertical sem prender o ator', () => {
    const code = `
      tela 160x120
      fundo preto

      ator Bola
        desenho quadrado 4, branco
        posição 50, 2
        velocidade 0, -4
        quica nas bordas verticais
      fim
    `;
    const ast = parse(tokenize(code));
    const game = new Game(ast);
    const bola = game.actors.get('bola')!;

    // Step: moves to 2 - 4 = -2, hits top border (y <= 0)
    game.step();

    expect(bola.y).toBe(0);
    expect(bola.vy).toBeGreaterThan(0); // vy inverted to positive!
  });

  it('limita à tela impede que o jogador saia dos limites', () => {
    const code = `
      tela 160x120

      ator Raquete
        desenho retângulo 4, 20, branco
        posição 10, 115
        velocidade 0, 10
        limita à tela
      fim
    `;
    const ast = parse(tokenize(code));
    const game = new Game(ast);
    const raquete = game.actors.get('raquete')!;

    // Attempt to move past bottom (115 + 10 = 125, but max is 120 - 20 = 100)
    game.step();

    expect(raquete.y).toBe(100);
  });

  it('detecta colisão AABB entre dois atores', () => {
    const boxA = { x: 10, y: 10, width: 20, height: 20 };
    const boxB = { x: 25, y: 25, width: 20, height: 20 };
    const boxC = { x: 60, y: 60, width: 20, height: 20 };

    expect(checkAABB(boxA, boxB)).toBe(true);
    expect(checkAABB(boxA, boxC)).toBe(false);
  });

  it('dispara eventos de colisão entre atores', () => {
    const code = `
      tela 160x120
      bateu recebe 0

      ator Bola
        desenho quadrado 4, branco
        posição 20, 20
        quando colide com "Bloco":
          bateu recebe 1
        fim
      fim

      ator Bloco
        desenho retângulo 10, 10, vermelho
        posição 22, 22
      fim
    `;
    const ast = parse(tokenize(code));
    const game = new Game(ast);

    game.step();
    expect(game.interpreter.globalEnv.get('bateu')).toBe(1);
  });
});
