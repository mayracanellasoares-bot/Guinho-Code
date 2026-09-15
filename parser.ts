import { Token, ProgramAST, ActorDecl, Stmt, Expr, DrawShape, ControlledBy, BounceConfig } from './types.ts';
import { normalizeColorName } from './colors.ts';

export class ParseError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(`[Linha ${line}, Coluna ${col}] ${message}`);
    this.name = 'ParseError';
    this.line = line;
    this.col = col;
  }
}

function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function parse(tokens: Token[]): ProgramAST {
  let current = 0;

  function peek(): Token {
    return tokens[current] ?? tokens[tokens.length - 1];
  }

  function previous(): Token {
    return tokens[current - 1] ?? tokens[0];
  }

  function isAtEnd(): boolean {
    return peek().type === 'EOF';
  }

  function advance(): Token {
    if (!isAtEnd()) current++;
    return previous();
  }

  function formatEncontrado(t: Token): string {
    if (t.type === 'EOF') {
      return 'fim de arquivo';
    }
    return `"${t.value}"`;
  }

  function checkId(...names: string[]): boolean {
    if (isAtEnd()) return false;
    const t = peek();
    if (t.type !== 'PALAVRA') return false;
    const norm = normalizeId(t.value);
    return names.some(n => normalizeId(n) === norm);
  }

  function matchId(...names: string[]): boolean {
    if (checkId(...names)) {
      advance();
      return true;
    }
    return false;
  }

  function expectId(expectedName: string, customMsg?: string): Token {
    const t = peek();
    if (checkId(expectedName)) {
      return advance();
    }
    const encontrado = formatEncontrado(t);
    const msg = customMsg ?? `Esperava "${expectedName}", encontrei ${encontrado}.`;
    throw new ParseError(msg, t.line, t.col);
  }

  function matchOp(...ops: string[]): boolean {
    if (isAtEnd()) return false;
    const t = peek();
    if (t.type === 'OPERADOR' && ops.includes(t.value)) {
      advance();
      return true;
    }
    return false;
  }

  function matchPunct(punct: string): boolean {
    if (isAtEnd()) return false;
    const t = peek();
    if (t.type === 'PONTUACAO' && t.value === punct) {
      advance();
      return true;
    }
    return false;
  }

  function expectPunct(punct: string, customMsg?: string): Token {
    const t = peek();
    if (matchPunct(punct)) {
      return previous();
    }
    const encontrado = formatEncontrado(t);
    const msg = customMsg ?? `Esperava "${punct}", encontrei ${encontrado}.`;
    throw new ParseError(msg, t.line, t.col);
  }

  // Expression parser
  function parseExpr(): Expr {
    return parseLogicalOr();
  }

  function parseLogicalOr(): Expr {
    let expr = parseLogicalAnd();
    while (matchId('ou') || matchOp('||')) {
      const op = 'ou';
      const right = parseLogicalAnd();
      expr = { kind: 'binary', op, left: expr, right };
    }
    return expr;
  }

  function parseLogicalAnd(): Expr {
    let expr = parseEquality();
    while (matchId('e') || matchOp('&&')) {
      const op = 'e';
      const right = parseEquality();
      expr = { kind: 'binary', op, left: expr, right };
    }
    return expr;
  }

  function parseEquality(): Expr {
    let expr = parseComparison();
    while (matchOp('==', '!=')) {
      const op = previous().value;
      const right = parseComparison();
      expr = { kind: 'binary', op, left: expr, right };
    }
    return expr;
  }

  function parseComparison(): Expr {
    let expr = parseTerm();
    while (matchOp('<', '<=', '>', '>=')) {
      const op = previous().value;
      const right = parseTerm();
      expr = { kind: 'binary', op, left: expr, right };
    }
    return expr;
  }

  function parseTerm(): Expr {
    let expr = parseFactor();
    while (matchOp('+', '-')) {
      const op = previous().value;
      const right = parseFactor();
      expr = { kind: 'binary', op, left: expr, right };
    }
    return expr;
  }

  function parseFactor(): Expr {
    let expr = parseUnary();
    while (matchOp('*', '/', '%')) {
      const op = previous().value;
      const right = parseUnary();
      expr = { kind: 'binary', op, left: expr, right };
    }
    return expr;
  }

  function parseUnary(): Expr {
    if (matchOp('-') || matchOp('!') || matchId('nao', 'não')) {
      const op = previous().value;
      const right = parseUnary();
      return { kind: 'unary', op, expr: right };
    }
    return parseCallOrPrimary();
  }

  function parseCallOrPrimary(): Expr {
    const expr = parsePrimary();

    // Member access: ator.x
    if (expr.kind === 'identifier' && matchPunct('.')) {
      const t = peek();
      if (t.type !== 'PALAVRA') {
        const encontrado = formatEncontrado(t);
        throw new ParseError(`Esperava nome da propriedade após ".", encontrei ${encontrado}.`, t.line, t.col);
      }
      advance();
      return { kind: 'member', object: expr.name, property: previous().value };
    }

    // Call expr: func(args)
    if (expr.kind === 'identifier' && matchPunct('(')) {
      const args: Expr[] = [];
      if (!checkPunct(')')) {
        do {
          args.push(parseExpr());
        } while (matchPunct(','));
      }
      expectPunct(')', `Esperava ")" ao fechar argumentos da função, encontrei ${formatEncontrado(peek())}.`);
      return { kind: 'call', callee: expr.name, args };
    }

    return expr;
  }

  function checkPunct(punct: string): boolean {
    if (isAtEnd()) return false;
    const t = peek();
    return t.type === 'PONTUACAO' && t.value === punct;
  }

  function parsePrimary(): Expr {
    const t = peek();

    if (t.type === 'NUMERO') {
      advance();
      return { kind: 'literal', value: parseFloat(t.value) };
    }

    if (t.type === 'TEXTO') {
      advance();
      return { kind: 'literal', value: t.value };
    }

    if (checkId('verdadeiro')) {
      advance();
      return { kind: 'literal', value: true };
    }

    if (checkId('falso')) {
      advance();
      return { kind: 'literal', value: false };
    }

    if (t.type === 'PALAVRA') {
      advance();
      return { kind: 'identifier', name: t.value };
    }

    if (matchPunct('(')) {
      const expr = parseExpr();
      expectPunct(')', `Esperava ")" após expressão agrupada, encontrei ${formatEncontrado(peek())}.`);
      return expr;
    }

    const encontrado = formatEncontrado(t);
    throw new ParseError(`Expressão inválida, encontrei ${encontrado}.`, t.line, t.col);
  }

  // Statements
  function parseBlock(stopKeywords: string[]): Stmt[] {
    const statements: Stmt[] = [];
    while (!isAtEnd() && !checkId(...stopKeywords)) {
      statements.push(parseStmt());
    }
    return statements;
  }

  // IF-THEN-ELSE-IF (SENÃO SE) AUDITED
  const parseIf = (consumeFim = true): Stmt => {
    expectId('se');

    const cond = parseExpr();

    if (!matchId('entao', 'então')) {
      const encontrado = formatEncontrado(peek());
      throw new ParseError(
        `Faltou "então" depois do "se". Tente: se CONDIÇÃO então, encontrei ${encontrado}.`,
        peek().line,
        peek().col
      );
    }

    const then = parseBlock(['fim', 'senao', 'senão']);

    let els: Stmt[] | undefined;

    if (matchId('senao', 'senão')) {
      if (checkId('se')) {
        // Encadeamento senão se: o if interno NÃO consome fim!
        els = [parseIf(false)];
      } else {
        els = parseBlock(['fim']);
      }
    }

    if (consumeFim) {
      expectId('fim');
    }

    return {
      kind: 'if',
      cond,
      then,
      els
    };
  };

  function parseStmt(): Stmt {
    const t = peek();

    // se ...
    if (checkId('se')) {
      return parseIf(true);
    }

    // repita N vezes ... fim
    if (matchId('repita')) {
      const times = parseExpr();
      expectId('vezes');
      const body = parseBlock(['fim']);
      expectId('fim');
      return { kind: 'repeat', times, body };
    }

    // enquanto COND ... fim
    if (matchId('enquanto')) {
      const cond = parseExpr();
      matchId('faca', 'faça'); // opcional "faça"
      const body = parseBlock(['fim']);
      expectId('fim');
      return { kind: 'while', cond, body };
    }

    // funcao / função NOME(params) ... fim
    if (matchId('funcao', 'função')) {
      const nameTok = peek();
      if (nameTok.type !== 'PALAVRA') {
        throw new ParseError(`Esperava nome da função, encontrei ${formatEncontrado(nameTok)}.`, nameTok.line, nameTok.col);
      }
      advance();
      const name = nameTok.value;
      expectPunct('(', `Esperava "(" após nome da função "${name}", encontrei ${formatEncontrado(peek())}.`);
      const params: string[] = [];
      if (!checkPunct(')')) {
        do {
          const p = peek();
          if (p.type !== 'PALAVRA') {
            throw new ParseError(`Esperava nome do parâmetro, encontrei ${formatEncontrado(p)}.`, p.line, p.col);
          }
          advance();
          params.push(p.value);
        } while (matchPunct(','));
      }
      expectPunct(')', `Esperava ")" ao fechar parâmetros da função "${name}", encontrei ${formatEncontrado(peek())}.`);
      const body = parseBlock(['fim']);
      expectId('fim');
      return { kind: 'func', name, params, body };
    }

    // retorne EXPR
    if (matchId('retorne')) {
      let value: Expr | undefined;
      if (!isAtEnd() && !checkId('fim', 'senao', 'senão')) {
        value = parseExpr();
      }
      return { kind: 'return', value };
    }

    // diga EXPR
    if (matchId('diga')) {
      const expr = parseExpr();
      return { kind: 'say', expr };
    }

    // vira EXPR
    if (matchId('vira')) {
      const angle = parseExpr();
      return { kind: 'turn', angle };
    }

    // Eventos: quando atualiza: ... fim / ao colidir com "Nome": ... fim
    if (matchId('quando', 'ao')) {
      let eventType = 'atualiza';
      let arg: string | undefined;

      if (matchId('atualiza', 'atualizar', 'quadro', 'frame')) {
        eventType = 'atualiza';
      } else if (matchId('colide', 'colidir', 'tocar')) {
        eventType = 'colide';
        if (matchId('com')) {
          const targetTok = peek();
          if (targetTok.type === 'TEXTO' || targetTok.type === 'PALAVRA') {
            advance();
            arg = targetTok.value;
          }
        }
      }
      matchPunct(':');
      const body = parseBlock(['fim']);
      expectId('fim');
      return { kind: 'event', event: eventType, arg, body };
    }

    // Atribuição: x recebe expr  OU  x = expr  OU  ator.prop recebe expr
    if (t.type === 'PALAVRA') {
      const nextTok = tokens[current + 1];
      const nextNextTok = tokens[current + 2];

      // ator.prop recebe expr  OU  ator.prop = expr
      if (nextTok && nextTok.type === 'PONTUACAO' && nextTok.value === '.') {
        advance(); // object
        const objName = t.value;
        advance(); // dot
        const propTok = peek();
        if (propTok.type !== 'PALAVRA') {
          throw new ParseError(`Esperava propriedade após ".", encontrei ${formatEncontrado(propTok)}.`, propTok.line, propTok.col);
        }
        advance(); // prop
        const propName = propTok.value;

        if (matchId('recebe') || matchOp('=')) {
          const val = parseExpr();
          return { kind: 'assign', target: objName, property: propName, value: val };
        }
      }

      // x recebe expr  OU  x = expr
      if (nextTok && (
        (nextTok.type === 'PALAVRA' && normalizeId(nextTok.value) === 'recebe') ||
        (nextTok.type === 'OPERADOR' && nextTok.value === '=')
      )) {
        advance(); // identifier
        const varName = t.value;
        advance(); // recebe or =
        const val = parseExpr();
        return { kind: 'assign', target: varName, value: val };
      }
    }

    // Fallback: Expressão isolada (ex: chamada de função)
    const expr = parseExpr();
    return { kind: 'call_stmt', expr };
  }

  // Top level parsing
  let screenWidth = 160;
  let screenHeight = 120;
  let backgroundColor = '#000000';
  let title = 'BIT';
  const actors: ActorDecl[] = [];
  const globalStatements: Stmt[] = [];

  while (!isAtEnd()) {
    if (matchId('jogo')) {
      const titleTok = peek();
      if (titleTok.type !== 'TEXTO') {
        throw new ParseError(`Esperava o título do jogo entre aspas, encontrei ${formatEncontrado(titleTok)}.`, titleTok.line, titleTok.col);
      }
      title = advance().value;
      continue;
    }

    // tela 160x120 or tela 160, 120
    if (matchId('tela')) {
      const dimTok = peek();
      if (dimTok.type === 'PALAVRA' && dimTok.value.includes('x')) {
        advance();
        const [wStr, hStr] = dimTok.value.split('x');
        screenWidth = parseInt(wStr, 10);
        screenHeight = parseInt(hStr, 10);
      } else if (dimTok.type === 'NUMERO') {
        advance();
        screenWidth = parseInt(dimTok.value, 10);
        if (matchPunct(',') || matchOp('*') || matchId('x')) {
          // consumed
        } else {
          const t = peek();
          throw new ParseError(`Esperava separador entre largura e altura, encontrei ${formatEncontrado(t)}.`, t.line, t.col);
        }
        const hTok = peek();
        if (hTok.type !== 'NUMERO') {
          throw new ParseError(`Esperava a altura da tela, encontrei ${formatEncontrado(hTok)}.`, hTok.line, hTok.col);
        }
        advance();
        screenHeight = parseInt(hTok.value, 10);
      } else {
        throw new ParseError(`Esperava uma dimensão como 320x180, encontrei ${formatEncontrado(dimTok)}.`, dimTok.line, dimTok.col);
      }
      if (!Number.isFinite(screenWidth) || !Number.isFinite(screenHeight) || screenWidth <= 0 || screenHeight <= 0) {
        const t = previous();
        throw new ParseError('A largura e a altura da tela devem ser maiores que zero.', t.line, t.col);
      }
      continue;
    }

    // fundo <cor>
    if (matchId('fundo')) {
      const colorTok = peek();
      if (colorTok.type !== 'PALAVRA' && colorTok.type !== 'TEXTO') {
        throw new ParseError(`Esperava uma cor depois de "fundo", encontrei ${formatEncontrado(colorTok)}.`, colorTok.line, colorTok.col);
      }
      advance();
      backgroundColor = colorTok.value;
      continue;
    }

    // ator <Nome> ... fim
    if (matchId('ator')) {
      const nameTok = peek();
      if (nameTok.type !== 'PALAVRA') {
        throw new ParseError(`Esperava nome do ator, encontrei ${formatEncontrado(nameTok)}.`, nameTok.line, nameTok.col);
      }
      advance();
      const actorName = nameTok.value;

      let shape: DrawShape | undefined;
      let x = Math.floor(screenWidth / 2);
      let y = Math.floor(screenHeight / 2);
      let vx = 0;
      let vy = 0;
      let controlledBy: ControlledBy = 'nenhum';
      let limitToScreen = false;
      const bounceBorders: BounceConfig = { top: false, bottom: false, left: false, right: false };
      const events: { [key: string]: Stmt[] } = {};
      const statements: Stmt[] = [];

      while (!isAtEnd() && !checkId('fim')) {
        // desenho quadrado <tam>, <cor>
        // desenho retangulo <w>, <h>, <cor>
        // desenho circulo <raio>, <cor>
        if (matchId('desenho')) {
          if (matchId('quadrado')) {
            const tamTok = peek();
            let size = 8;
            if (tamTok.type === 'NUMERO') {
              advance();
              size = parseFloat(tamTok.value);
            }
            matchPunct(',');
            let cor = 'branco';
            const corTok = peek();
            if (corTok.type === 'PALAVRA' || corTok.type === 'TEXTO') {
              advance();
              cor = corTok.value;
            }
            shape = { type: 'quadrado', width: size, height: size, color: cor };
            continue;
          }

          if (matchId('retangulo', 'retângulo')) {
            let w = 16;
            let h = 8;
            if (peek().type === 'NUMERO') {
              w = parseFloat(advance().value);
            }
            matchPunct(',');
            if (peek().type === 'NUMERO') {
              h = parseFloat(advance().value);
            }
            matchPunct(',');
            let cor = 'branco';
            const corTok = peek();
            if (corTok.type === 'PALAVRA' || corTok.type === 'TEXTO') {
              advance();
              cor = corTok.value;
            }
            shape = { type: 'retangulo', width: w, height: h, color: cor };
            continue;
          }

          if (matchId('circulo', 'círculo')) {
            let raio = 4;
            if (peek().type === 'NUMERO') {
              raio = parseFloat(advance().value);
            }
            matchPunct(',');
            let cor = 'branco';
            const corTok = peek();
            if (corTok.type === 'PALAVRA' || corTok.type === 'TEXTO') {
              advance();
              cor = corTok.value;
            }
            shape = { type: 'circulo', width: raio * 2, height: raio * 2, radius: raio, color: cor };
            continue;
          }

          if (matchId('texto')) {
            let size = 10;
            if (peek().type === 'NUMERO') {
              size = parseFloat(advance().value);
            }
            matchPunct(',');
            let content = '';
            if (peek().type === 'TEXTO') {
              content = advance().value;
            }
            matchPunct(',');
            let cor = 'branco';
            const corTok = peek();
            if (corTok.type === 'PALAVRA' || corTok.type === 'TEXTO') {
              advance();
              cor = corTok.value;
            }
            shape = { type: 'texto', width: size * 5, height: size, text: content, color: cor };
            continue;
          }
        }

        // posicao X, Y  ou  posição X, Y
        if (matchId('posicao', 'posição')) {
          if (peek().type === 'NUMERO') {
            x = parseFloat(advance().value);
          }
          matchPunct(',');
          if (peek().type === 'NUMERO') {
            y = parseFloat(advance().value);
          }
          continue;
        }

        // velocidade VX, VY
        if (matchId('velocidade')) {
          let signX = 1;
          if (matchOp('-')) signX = -1;
          if (peek().type === 'NUMERO') {
            vx = signX * parseFloat(advance().value);
          }
          matchPunct(',');
          let signY = 1;
          if (matchOp('-')) signY = -1;
          if (peek().type === 'NUMERO') {
            vy = signY * parseFloat(advance().value);
          }
          continue;
        }

        // controlado por setas / controlado por toque / controlado por mouse
        if (matchId('controlado')) {
          expectId('por');
          if (matchId('setas')) controlledBy = 'setas';
          else if (matchId('toque')) controlledBy = 'toque';
          else if (matchId('mouse')) controlledBy = 'mouse';
          continue;
        }

        // limita à tela / limita a tela
        if (matchId('limita')) {
          if (matchId('a', 'à')) {
            // consumed
          }
          expectId('tela');
          limitToScreen = true;
          continue;
        }

        // quica nas bordas / quica nas bordas verticais / quica nas bordas horizontais
        if (matchId('quica')) {
          expectId('nas');
          expectId('bordas');
          if (matchId('verticais')) {
            bounceBorders.top = true;
            bounceBorders.bottom = true;
          } else if (matchId('horizontais')) {
            bounceBorders.left = true;
            bounceBorders.right = true;
          } else {
            // Em todas as bordas
            bounceBorders.top = true;
            bounceBorders.bottom = true;
            bounceBorders.left = true;
            bounceBorders.right = true;
          }
          continue;
        }

        // Statements or events inside actor
        const stmt = parseStmt();
        if (stmt.kind === 'event') {
          const key = stmt.event === 'colide' && stmt.arg ? `colide:${stmt.arg}` : stmt.event;
          events[key] = stmt.body;
        } else {
          statements.push(stmt);
        }
      }

      expectId('fim');
      actors.push({
        name: actorName,
        shape,
        x,
        y,
        vx,
        vy,
        controlledBy,
        limitToScreen,
        bounceBorders,
        events,
        statements
      });
      continue;
    }

    // Global statements
    globalStatements.push(parseStmt());
  }

  return {
    title,
    screenWidth,
    screenHeight,
    backgroundColor,
    actors,
    globalStatements
  };
}
