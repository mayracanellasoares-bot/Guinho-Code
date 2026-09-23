import { describe, it, expect } from 'vitest';
import { tokenize, LexerError } from './lexer.ts';

describe('Lexer', () => {
  it('tokeniza palavras-chave, números e identificadores', () => {
    const code = 'se x == 10 então diga "olá" fim';
    const tokens = tokenize(code);

    expect(tokens.map(t => t.type)).toEqual([
      'PALAVRA', // se
      'PALAVRA', // x
      'OPERADOR', // ==
      'NUMERO', // 10
      'PALAVRA', // então
      'PALAVRA', // diga
      'TEXTO', // "olá"
      'PALAVRA', // fim
      'EOF'
    ]);
  });

  it('lê dimensões de tela como 160x120', () => {
    const code = 'tela 160x120';
    const tokens = tokenize(code);
    expect(tokens[0].value).toBe('tela');
    expect(tokens[1].value).toBe('160x120');
  });

  it('lê comentários iniciados com # ou // ignorando-os', () => {
    const code = `
      # Comentário de linha
      x recebe 5 // outro comentário
    `;
    const tokens = tokenize(code);
    expect(tokens[0].value).toBe('x');
    expect(tokens[1].value).toBe('recebe');
    expect(tokens[2].value).toBe('5');
  });

  it('trata operadores compostos e simples', () => {
    const code = '<= >= == != < > + - * / % = !';
    const tokens = tokenize(code);
    const ops = tokens.filter(t => t.type === 'OPERADOR').map(t => t.value);
    expect(ops).toEqual(['<=', '>=', '==', '!=', '<', '>', '+', '-', '*', '/', '%', '=', '!']);
  });

  it('lança erro em strings não fechadas', () => {
    expect(() => tokenize('"string sem fim')).toThrow(LexerError);
  });
});
