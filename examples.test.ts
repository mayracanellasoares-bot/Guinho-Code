import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tokenize } from '../src/lexer.ts';
import { parse } from '../src/parser.ts';
import { Game } from '../src/runtime/game.ts';

describe('Exemplos da Linguagem Bit', () => {
  it('faz parse e executa steps de examples/pong.bit', () => {
    const filePath = path.resolve(process.cwd(), 'examples/pong.bit');
    const content = fs.readFileSync(filePath, 'utf-8');

    const tokens = tokenize(content);
    expect(tokens.length).toBeGreaterThan(0);

    const ast = parse(tokens);
    expect(ast.screenWidth).toBe(160);
    expect(ast.screenHeight).toBe(120);
    expect(ast.actors.length).toBe(3); // Jogador1, Jogador2, Bola

    const game = new Game(ast);
    expect(game.actors.size).toBe(3);

    // Run 10 simulation frames
    for (let i = 0; i < 10; i++) {
      game.step();
    }
  });

  it('faz parse e executa steps de examples/nave.bit', () => {
    const filePath = path.resolve(process.cwd(), 'examples/nave.bit');
    const content = fs.readFileSync(filePath, 'utf-8');

    const tokens = tokenize(content);
    const ast = parse(tokens);
    expect(ast.actors.length).toBe(3); // Nave, Inimigo, Estrela

    const game = new Game(ast);
    for (let i = 0; i < 10; i++) {
      game.step();
    }
  });

  it('faz parse e executa steps de examples/breakout.bit', () => {
    const filePath = path.resolve(process.cwd(), 'examples/breakout.bit');
    const content = fs.readFileSync(filePath, 'utf-8');

    const tokens = tokenize(content);
    const ast = parse(tokens);
    expect(ast.actors.length).toBe(5); // Paleta, Bola, Bloco1, Bloco2, Bloco3

    const game = new Game(ast);
    for (let i = 0; i < 10; i++) {
      game.step();
    }
  });

  it('faz parse e executa steps de examples/tetris.bit', () => {
    const filePath = path.resolve(process.cwd(), 'examples/tetris.bit');
    const content = fs.readFileSync(filePath, 'utf-8');

    const tokens = tokenize(content);
    const ast = parse(tokens);
    expect(ast.actors.length).toBe(6); // BordaEsq, BordaDir, Chao, Pilha1, Pilha2, Peca

    const game = new Game(ast);
    for (let i = 0; i < 10; i++) {
      game.step();
    }
  });
});
