import { describe, it, expect } from 'vitest';
import { tokenize } from './lexer.ts';
import { parse } from './parser.ts';

describe('BIT 1.2 - gramática', () => {
  it('aceita título do jogo e operadores lógicos simbólicos', () => {
    const ast = parse(tokenize(`
      jogo "Teste BIT"
      tela 320x180
      pronto recebe verdadeiro && !falso || falso
    `));

    expect(ast.title).toBe('Teste BIT');
    expect(ast.globalStatements).toHaveLength(1);
  });

  it('aceita programa de jogo escrito como texto .bit', () => {
    const code = `
      tela 320x180
      fundo preto

      pontos recebe 0

      ator Jogador
        desenho retângulo 8, 40, branco
        posição 20, 70
        velocidade 0, 0
        limita à tela
        quando atualiza:
          se tecla("direita") então
            x recebe x + 3
          fim
        fim
      fim

      ator Bola
        desenho quadrado 8, branco
        posição 156, 86
        velocidade 2, 1
        quica nas bordas verticais
        quando colide com "Jogador":
          vx recebe absoluto(vx)
        fim
      fim
    `;

    const ast = parse(tokenize(code));

    expect(ast.screenWidth).toBe(320);
    expect(ast.screenHeight).toBe(180);
    expect(ast.backgroundColor).toBe('preto');
    expect(ast.actors.map(a => a.name)).toEqual(['Jogador', 'Bola']);
  });

  it('aceita precedência de operadores, chamadas e membros', () => {
    const ast = parse(tokenize(`
      valor recebe (2 + 3) * 4
      distanciaBola recebe distancia(0, 0, Bola.x, Bola.y)
      pronto recebe verdadeiro e não falso ou falso
    `));

    expect(ast.globalStatements).toHaveLength(3);
  });

  it('aceita versões acentuadas e sem acento das palavras documentadas', () => {
    const ast = parse(tokenize(`
      funcao teste(x)
        se não falso então
          retorne x + 1
        fim
      fim
    `));

    expect(ast.globalStatements[0].kind).toBe('func');
  });
});
