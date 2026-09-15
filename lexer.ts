import { Token, TokenType } from './types.ts';

export class LexerError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(`[Linha ${line}, Coluna ${col}] ${message}`);
    this.name = 'LexerError';
    this.line = line;
    this.col = col;
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let col = 1;

  function peek(): string {
    return source[index] ?? '';
  }

  function advance(): string {
    const ch = source[index++];
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
  }

  function isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  function isLetterOrUnderscore(ch: string): boolean {
    return (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_' ||
      (ch >= '\u00C0' && ch <= '\u024F')
    );
  }

  while (index < source.length) {
    const startLine = line;
    const startCol = col;
    const ch = peek();

    // Whitespace
    if (isWhitespace(ch)) {
      advance();
      continue;
    }

    // Line comments // or #
    if (ch === '#' || (ch === '/' && source[index + 1] === '/')) {
      while (index < source.length && peek() !== '\n') {
        advance();
      }
      continue;
    }

    // Numbers: 123, 123.45, or dimension tokens like 160x120 handled seamlessly
    if (isDigit(ch)) {
      let numStr = '';
      while (index < source.length && isDigit(peek())) {
        numStr += advance();
      }

      // Check for dimension format like 160x120
      if (peek() === 'x' && isDigit(source[index + 1] ?? '')) {
        numStr += advance(); // consume 'x'
        while (index < source.length && isDigit(peek())) {
          numStr += advance();
        }
        tokens.push({
          type: 'PALAVRA',
          value: numStr,
          line: startLine,
          col: startCol
        });
        continue;
      }

      if (peek() === '.' && isDigit(source[index + 1] ?? '')) {
        numStr += advance(); // consume '.'
        while (index < source.length && isDigit(peek())) {
          numStr += advance();
        }
      }

      tokens.push({
        type: 'NUMERO',
        value: numStr,
        line: startLine,
        col: startCol
      });
      continue;
    }

    // Strings: "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = advance();
      let str = '';
      while (index < source.length && peek() !== quote) {
        if (peek() === '\n') {
          throw new LexerError('Texto não fechado antes do fim da linha.', startLine, startCol);
        }
        if (peek() === '\\' && source[index + 1] !== undefined) {
          advance(); // skip backslash
          const esc = advance();
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else str += esc;
        } else {
          str += advance();
        }
      }
      if (index >= source.length) {
        throw new LexerError('Texto não fechado até o fim do arquivo.', startLine, startCol);
      }
      advance(); // consume closing quote
      tokens.push({
        type: 'TEXTO',
        value: str,
        line: startLine,
        col: startCol
      });
      continue;
    }

    // Two-character operators
    const twoChars = source.slice(index, index + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChars)) {
      advance();
      advance();
      tokens.push({
        type: 'OPERADOR',
        value: twoChars,
        line: startLine,
        col: startCol
      });
      continue;
    }

    // Single-character operators
    if ('+-*/%<>=!'.includes(ch)) {
      advance();
      tokens.push({
        type: 'OPERADOR',
        value: ch,
        line: startLine,
        col: startCol
      });
      continue;
    }

    // Punctuation
    if (',:().'.includes(ch)) {
      advance();
      tokens.push({
        type: 'PONTUACAO',
        value: ch,
        line: startLine,
        col: startCol
      });
      continue;
    }

    // Identifiers and keywords
    if (isLetterOrUnderscore(ch)) {
      let word = '';
      while (index < source.length && (isLetterOrUnderscore(peek()) || isDigit(peek()))) {
        word += advance();
      }
      tokens.push({
        type: 'PALAVRA',
        value: word,
        line: startLine,
        col: startCol
      });
      continue;
    }

    throw new LexerError(`Caractere inesperado: "${ch}".`, startLine, startCol);
  }

  tokens.push({
    type: 'EOF',
    value: '',
    line,
    col
  });

  return tokens;
}
