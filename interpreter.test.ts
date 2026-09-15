import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer.ts';
import { parse } from '../src/parser.ts';
import { createBuiltins } from '../src/interp/builtins.ts';
import { Interpreter } from '../src/interp/interpreter.ts';

function runProgram(code: string): { output: string[]; env: any } {
  const tokens = tokenize(code);
  const ast = parse(tokens);
  const builtins = createBuiltins();
  const interp = new Interpreter(builtins);
  interp.executeBlock(ast.globalStatements, interp.globalEnv);
  return { output: interp.outputLog, env: interp.globalEnv };
}

describe('Interpreter', () => {
  it('executa cadeia senão se e escolhe ramo correto', () => {
    const code = `
      x recebe 2
      resultado recebe ""

      se x == 1 então
        resultado recebe "um"
      senão se x == 2 então
        resultado recebe "dois"
      senão se x == 3 então
        resultado recebe "três"
      senão
        resultado recebe "outro"
      fim
    `;
    const { env } = runProgram(code);
    expect(env.get('resultado')).toBe('dois');
  });

  it('executa ramo senão da cadeia quando nenhuma condição anterior bate', () => {
    const code = `
      x recebe 99
      resultado recebe ""

      se x == 1 então
        resultado recebe "um"
      senão se x == 2 então
        resultado recebe "dois"
      senão
        resultado recebe "padrao"
      fim
    `;
    const { env } = runProgram(code);
    expect(env.get('resultado')).toBe('padrao');
  });

  it('executa loops repita e acumula valores', () => {
    const code = `
      soma recebe 0
      repita 5 vezes
        soma recebe soma + 10
      fim
    `;
    const { env } = runProgram(code);
    expect(env.get('soma')).toBe(50);
  });

  it('executa funções definidas pelo usuário com retorno', () => {
    const code = `
      função dobro(n)
        retorne n * 2
      fim

      res recebe dobro(21)
    `;
    const { env } = runProgram(code);
    expect(env.get('res')).toBe(42);
  });

  it('executa comando diga e registra mensagens de saída', () => {
    const code = `
      diga "Olá, Bit 1.0!"
      diga 100 + 200
    `;
    const { output } = runProgram(code);
    expect(output).toEqual(['Olá, Bit 1.0!', '300']);
  });
});
