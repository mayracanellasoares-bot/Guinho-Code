/**
 * Bit 1.0 — Biblioteca Central do Motor de Jogos em Português
 */

export * from './types.ts';
export * from './colors.ts';
export * from './lexer.ts';
export * from './parser.ts';
export * from './builtins.ts';
export * from './interpreter.ts';
export * from './actor.ts';
export * from './game.ts';
export * from './collision.ts';

import { tokenize } from './lexer.ts';
import { parse } from './parser.ts';
import { Game } from './game.ts';
import type { ProgramAST } from './types.ts';

/**
 * Utilitário de alto nível para compilar e iniciar um jogo Bit diretamente
 */
export function criarJogoBit(codigo: string, canvas?: HTMLCanvasElement): { game: Game; ast: ProgramAST } {
  const tokens = tokenize(codigo);
  const ast = parse(tokens);
  const game = new Game(ast, canvas);
  return { game, ast };
}
