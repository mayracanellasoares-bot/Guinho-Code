import { describe, it, expect } from 'vitest';
import { tokenize } from './lexer.ts';
import { parse, ParseError } from './parser.ts';

describe('Parser - Auditoria de Mensagens de Erro e Interpolação', () => {
  it('formata erro com token encontrado (interpolação correta)', () => {
    const code = 'repita 5 x';
    const tokens = tokenize(code);

    try {
      parse(tokens);
      expect.fail('Deveria ter lançado ParseError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParseError);
      const msg = (err as ParseError).message;
      expect(msg).toContain('Esperava "vezes", encontrei "x".');
      expect(msg).not.toContain('${');
    }
  });

  it('formata erro quando atinge fim de arquivo', () => {
    const code = 'se 1 == 1 então diga "a"';
    const tokens = tokenize(code);

    try {
      parse(tokens);
      expect.fail('Deveria ter lançado ParseError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParseError);
      const msg = (err as ParseError).message;
      expect(msg).toContain('Esperava "fim", encontrei fim de arquivo.');
      expect(msg).not.toContain('${');
    }
  });

  it('informa erro ao faltar então depois de se', () => {
    const code = 'se 1 == 1 diga "a" fim';
    const tokens = tokenize(code);

    try {
      parse(tokens);
      expect.fail('Deveria ter lançado ParseError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParseError);
      const msg = (err as ParseError).message;
      expect(msg).toContain('Faltou "então" depois do "se". Tente: se CONDIÇÃO então, encontrei "diga".');
    }
  });
});

describe('Parser - Senão Se (Cadeia com fim único)', () => {
  it('TESTE OBRIGATÓRIO 1: se ... senão se ... senão se ... senão ... fim', () => {
    const code = `
      se 1 == 1 então
        diga "a"
      senão se 1 == 2 então
        diga "b"
      senão se 1 == 3 então
        diga "c"
      senão
        diga "d"
      fim
    `;
    const tokens = tokenize(code);
    const ast = parse(tokens);

    expect(ast.globalStatements.length).toBe(1);
    const rootIf = ast.globalStatements[0];
    expect(rootIf.kind).toBe('if');

    if (rootIf.kind === 'if') {
      expect(rootIf.then.length).toBe(1);
      expect(rootIf.els).toBeDefined();
      expect(rootIf.els!.length).toBe(1);

      const secondIf = rootIf.els![0];
      expect(secondIf.kind).toBe('if');

      if (secondIf.kind === 'if') {
        expect(secondIf.els).toBeDefined();
        const thirdIf = secondIf.els![0];
        expect(thirdIf.kind).toBe('if');

        if (thirdIf.kind === 'if') {
          expect(thirdIf.els).toBeDefined();
          expect(thirdIf.els![0].kind).toBe('say');
        }
      }
    }
  });

  it('TESTE OBRIGATÓRIO 2: se simples com fim', () => {
    const code = `
      se 1 == 1 então
        diga "a"
      fim
    `;
    const ast = parse(tokenize(code));
    expect(ast.globalStatements.length).toBe(1);
    expect(ast.globalStatements[0].kind).toBe('if');
  });

  it('TESTE OBRIGATÓRIO 3: se ... senão ... fim', () => {
    const code = `
      se 1 == 1 então
        diga "a"
      senão
        diga "b"
      fim
    `;
    const ast = parse(tokenize(code));
    expect(ast.globalStatements.length).toBe(1);
    const stmt = ast.globalStatements[0];
    expect(stmt.kind).toBe('if');
    if (stmt.kind === 'if') {
      expect(stmt.els).toBeDefined();
      expect(stmt.els!.length).toBe(1);
    }
  });

  it('TESTE OBRIGATÓRIO 4: cadeia maior (se a então ... senão se b ... senão se c ... senão se d ... senão ... fim)', () => {
    const code = `
      se a então
        diga "1"
      senão se b então
        diga "2"
      senão se c então
        diga "3"
      senão se d então
        diga "4"
      senão
        diga "5"
      fim
    `;
    const ast = parse(tokenize(code));
    expect(ast.globalStatements.length).toBe(1);
    expect(ast.globalStatements[0].kind).toBe('if');
  });
});

describe('Parser - Estruturas da Linguagem e Não-Regressão', () => {
  it('faz parse de tela 160x120 e fundo', () => {
    const code = `
      tela 160x120
      fundo azul
    `;
    const ast = parse(tokenize(code));
    expect(ast.screenWidth).toBe(160);
    expect(ast.screenHeight).toBe(120);
    expect(ast.backgroundColor).toBe('azul');
  });

  it('rejeita tela sem dimensão válida', () => {
    expect(() => parse(tokenize('tela 0x120'))).toThrow(ParseError);
    expect(() => parse(tokenize('tela 320'))).toThrow(ParseError);
  });

  it('faz parse de ator completo com desenho, controles e eventos', () => {
    const code = `
      ator Jogador
        desenho quadrado 8, azul
        posição 10, 20
        velocidade 2, -2
        controlado por setas
        limita à tela
        quica nas bordas
        quando atualiza:
          x recebe x + 1
        fim
        quando colide com "Inimigo":
          diga "Bateu"
        fim
      fim
    `;
    const ast = parse(tokenize(code));
    expect(ast.actors.length).toBe(1);
    const actor = ast.actors[0];
    expect(actor.name).toBe('Jogador');
    expect(actor.shape?.type).toBe('quadrado');
    expect(actor.shape?.width).toBe(8);
    expect(actor.x).toBe(10);
    expect(actor.y).toBe(20);
    expect(actor.vx).toBe(2);
    expect(actor.vy).toBe(-2);
    expect(actor.controlledBy).toBe('setas');
    expect(actor.limitToScreen).toBe(true);
    expect(actor.bounceBorders.top).toBe(true);
    expect(actor.bounceBorders.left).toBe(true);
    expect(actor.events['atualiza']).toBeDefined();
    expect(actor.events['colide:Inimigo']).toBeDefined();
  });

  it('faz parse de desenho retângulo', () => {
    const code = `
      ator Barra
        desenho retângulo 16, 8, vermelho
      fim
    `;
    const ast = parse(tokenize(code));
    expect(ast.actors[0].shape?.type).toBe('retangulo');
    expect(ast.actors[0].shape?.width).toBe(16);
    expect(ast.actors[0].shape?.height).toBe(8);
  });

  it('faz parse de loops, funções e comandos de controle', () => {
    const code = `
      função somar(a, b)
        retorne a + b
      fim

      repita 5 vezes
        vira 45
        diga "girando"
      fim

      enquanto x < 100
        x recebe x + 1
      fim
    `;
    const ast = parse(tokenize(code));
    expect(ast.globalStatements.length).toBe(3);
    expect(ast.globalStatements[0].kind).toBe('func');
    expect(ast.globalStatements[1].kind).toBe('repeat');
    expect(ast.globalStatements[2].kind).toBe('while');
  });

  it('faz parse de atribuições com recebe e =', () => {
    const code = `
      pontos recebe 10
      vidas = 3
      Bola.vx recebe 4
      Bola.vy = -4
    `;
    const ast = parse(tokenize(code));
    expect(ast.globalStatements.length).toBe(4);
    expect(ast.globalStatements[0].kind).toBe('assign');
    expect(ast.globalStatements[1].kind).toBe('assign');
    expect(ast.globalStatements[2].kind).toBe('assign');
    expect(ast.globalStatements[3].kind).toBe('assign');
  });
});
