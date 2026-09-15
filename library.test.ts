import { describe, it, expect } from 'vitest';
import { BIT_LIBRARY } from '../src/library-data.ts';
import { criarJogoBit } from '../src/index.ts';

describe('Biblioteca do Bit', () => {
  it('contém todos os comandos e categorias principais', () => {
    expect(BIT_LIBRARY.length).toBeGreaterThan(15);

    const categories = new Set(BIT_LIBRARY.map((item) => item.category));
    expect(categories.has('cenario')).toBe(true);
    expect(categories.has('atores')).toBe(true);
    expect(categories.has('comportamento')).toBe(true);
    expect(categories.has('eventos')).toBe(true);
    expect(categories.has('controle')).toBe(true);
    expect(categories.has('funcoes')).toBe(true);
    expect(categories.has('propriedades')).toBe(true);
    expect(categories.has('cores')).toBe(true);
  });

  it('todos os itens possuem sintaxe, descrição e exemplo válidos', () => {
    for (const item of BIT_LIBRARY) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.syntax.length).toBeGreaterThan(0);
      expect(item.desc.length).toBeGreaterThan(0);
      expect(item.example.length).toBeGreaterThan(0);
    }
  });

  it('exporta criarJogoBit pela biblioteca pública index.ts', () => {
    const { game, ast } = criarJogoBit(`tela 160x120\nfundo preto\nator Teste\n  desenho quadrado 4, branco\n  posição 10, 10\nfim`);
    expect(ast.screenWidth).toBe(160);
    expect(ast.screenHeight).toBe(120);
    expect(game.actors.size).toBe(1);
    game.step();
  });
});
