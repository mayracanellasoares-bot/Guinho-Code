import { Expr, Stmt } from './types.ts';
import { Builtin } from './builtins.ts';
import { Actor } from './actor.ts';

export class ReturnSignal {
  value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}

export class Environment {
  private values = new Map<string, unknown>();
  readonly parent?: Environment;

  constructor(parent?: Environment) {
    this.parent = parent;
  }

  get(name: string): unknown {
    const key = name.toLowerCase();
    if (this.values.has(key)) {
      return this.values.get(key);
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    return undefined;
  }

  set(name: string, value: unknown): void {
    this.values.set(name.toLowerCase(), value);
  }

  assign(name: string, value: unknown): boolean {
    const key = name.toLowerCase();
    if (this.values.has(key)) {
      this.values.set(key, value);
      return true;
    }
    if (this.parent && this.parent.assign(name, value)) {
      return true;
    }
    this.values.set(key, value);
    return true;
  }

  has(name: string): boolean {
    const key = name.toLowerCase();
    if (this.values.has(key)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }
}

export interface UserFunction {
  params: string[];
  body: Stmt[];
  closure: Environment;
}

export class Interpreter {
  globalEnv: Environment;
  currentEnv: Environment;
  builtins: Map<string, Builtin>;
  actors: Map<string, Actor>;
  currentActor?: Actor;
  outputLog: string[] = [];
  onSay?: (message: string) => void;

  constructor(builtins: Map<string, Builtin>, actors: Map<string, Actor> = new Map()) {
    this.builtins = builtins;
    this.actors = actors;
    this.globalEnv = new Environment();
    this.currentEnv = this.globalEnv;

    // Register actors into global env
    for (const [name, actor] of actors.entries()) {
      this.globalEnv.set(name, actor);
    }
  }

  evalExpr(expr: Expr, env: Environment = this.currentEnv): unknown {
    switch (expr.kind) {
      case 'literal':
        return expr.value;

      case 'identifier': {
        const name = expr.name.toLowerCase();
        // Check local/global variables
        if (env.has(name)) {
          return env.get(name);
        }
        // Check actors
        if (this.actors.has(name)) {
          return this.actors.get(name);
        }
        // If there's a current actor and it has this property
        if (this.currentActor) {
          if (name === 'x') return this.currentActor.x;
          if (name === 'y') return this.currentActor.y;
          if (name === 'vx') return this.currentActor.vx;
          if (name === 'vy') return this.currentActor.vy;
          if (name === 'largura') return this.currentActor.width;
          if (name === 'altura') return this.currentActor.height;
          if (name in this.currentActor.props) return this.currentActor.props[name];
        }
        return undefined;
      }

      case 'binary': {
        const left = this.evalExpr(expr.left, env);
        const right = this.evalExpr(expr.right, env);
        return this.evalBinary(expr.op, left, right);
      }

      case 'unary': {
        const val = this.evalExpr(expr.expr, env);
        if (expr.op === '-' && typeof val === 'number') {
          return -val;
        }
        if (expr.op === '!' || expr.op === 'nao' || expr.op === 'não') {
          return !val;
        }
        return val;
      }

      case 'member': {
        const obj = this.evalExpr({ kind: 'identifier', name: expr.object }, env);
        const prop = expr.property.toLowerCase();

        if (obj instanceof Actor) {
          if (prop === 'x') return obj.x;
          if (prop === 'y') return obj.y;
          if (prop === 'vx') return obj.vx;
          if (prop === 'vy') return obj.vy;
          if (prop === 'largura') return obj.width;
          if (prop === 'altura') return obj.height;
          if (prop === 'ativo') return obj.active;
          return obj.props[prop];
        }

        if (typeof obj === 'object' && obj !== null) {
          return (obj as Record<string, unknown>)[prop];
        }
        return undefined;
      }

      case 'call': {
        const calleeName = expr.callee.toLowerCase();
        const args = expr.args.map(a => this.evalExpr(a, env));

        // Check built-in functions
        if (this.builtins.has(calleeName)) {
          const fn = this.builtins.get(calleeName)!;
          return fn(args);
        }

        // Check user-defined functions
        const userFn = env.get(calleeName) as UserFunction | undefined;
        if (userFn && userFn.params && userFn.body) {
          const callEnv = new Environment(userFn.closure);
          userFn.params.forEach((param, idx) => {
            callEnv.set(param, args[idx]);
          });
          const prevEnv = this.currentEnv;
          this.currentEnv = callEnv;
          try {
            this.executeBlock(userFn.body, callEnv);
          } catch (e) {
            if (e instanceof ReturnSignal) {
              return e.value;
            }
            throw e;
          } finally {
            this.currentEnv = prevEnv;
          }
          return undefined;
        }

        return undefined;
      }
    }
  }

  private evalBinary(op: string, left: unknown, right: unknown): unknown {
    switch (op) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left ?? '') + String(right ?? '');
        }
        return (Number(left) || 0) + (Number(right) || 0);
      case '-':
        return (Number(left) || 0) - (Number(right) || 0);
      case '*':
        return (Number(left) || 0) * (Number(right) || 0);
      case '/': {
        const divisor = Number(right) || 0;
        return divisor === 0 ? 0 : (Number(left) || 0) / divisor;
      }
      case '%':
        return (Number(left) || 0) % (Number(right) || 1);
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '<':
        return (Number(left) || 0) < (Number(right) || 0);
      case '<=':
        return (Number(left) || 0) <= (Number(right) || 0);
      case '>':
        return (Number(left) || 0) > (Number(right) || 0);
      case '>=':
        return (Number(left) || 0) >= (Number(right) || 0);
      case 'e':
      case '&&':
        return Boolean(left) && Boolean(right);
      case 'ou':
      case '||':
        return Boolean(left) || Boolean(right);
      default:
        return undefined;
    }
  }

  executeStmt(stmt: Stmt, env: Environment = this.currentEnv): void {
    switch (stmt.kind) {
      case 'assign': {
        const value = this.evalExpr(stmt.value, env);
        if (stmt.property) {
          const obj = env.get(stmt.target);
          const prop = stmt.property.toLowerCase();
          if (obj instanceof Actor) {
            if (prop === 'x') obj.x = Number(value) || 0;
            else if (prop === 'y') obj.y = Number(value) || 0;
            else if (prop === 'vx') obj.vx = Number(value) || 0;
            else if (prop === 'vy') obj.vy = Number(value) || 0;
            else if (prop === 'largura') {
              obj.width = Number(value) || 0;
              if (obj.shape) obj.shape.width = obj.width;
            }
            else if (prop === 'altura') {
              obj.height = Number(value) || 0;
              if (obj.shape) obj.shape.height = obj.height;
            }
            else if (prop === 'ativo') obj.active = Boolean(value);
            else obj.props[prop] = value;
          } else if (typeof obj === 'object' && obj !== null) {
            (obj as Record<string, unknown>)[prop] = value;
          }
        } else {
          // If the target is an actor and current actor matches
          const lowerTarget = stmt.target.toLowerCase();
          if (this.currentActor && ['x', 'y', 'vx', 'vy', 'largura', 'altura', 'ativo'].includes(lowerTarget)) {
            if (lowerTarget === 'x') this.currentActor.x = Number(value) || 0;
            if (lowerTarget === 'y') this.currentActor.y = Number(value) || 0;
            if (lowerTarget === 'vx') this.currentActor.vx = Number(value) || 0;
            if (lowerTarget === 'vy') this.currentActor.vy = Number(value) || 0;
            if (lowerTarget === 'largura') {
              this.currentActor.width = Number(value) || 0;
              if (this.currentActor.shape) this.currentActor.shape.width = this.currentActor.width;
            }
            if (lowerTarget === 'altura') {
              this.currentActor.height = Number(value) || 0;
              if (this.currentActor.shape) this.currentActor.shape.height = this.currentActor.height;
            }
            if (lowerTarget === 'ativo') this.currentActor.active = Boolean(value);
          } else {
            env.assign(stmt.target, value);
          }
        }
        break;
      }

      case 'if': {
        const condition = Boolean(this.evalExpr(stmt.cond, env));
        if (condition) {
          this.executeBlock(stmt.then, new Environment(env));
        } else if (stmt.els && stmt.els.length > 0) {
          this.executeBlock(stmt.els, new Environment(env));
        }
        break;
      }

      case 'repeat': {
        const times = Math.max(0, Math.floor(Number(this.evalExpr(stmt.times, env)) || 0));
        const maxLimit = 10000;
        const actualTimes = Math.min(times, maxLimit);
        for (let i = 0; i < actualTimes; i++) {
          this.executeBlock(stmt.body, new Environment(env));
        }
        break;
      }

      case 'while': {
        let iterations = 0;
        const maxLimit = 10000;
        while (Boolean(this.evalExpr(stmt.cond, env)) && iterations < maxLimit) {
          this.executeBlock(stmt.body, new Environment(env));
          iterations++;
        }
        break;
      }

      case 'func': {
        const userFn: UserFunction = {
          params: stmt.params,
          body: stmt.body,
          closure: env
        };
        env.set(stmt.name, userFn);
        break;
      }

      case 'return': {
        const val = stmt.value ? this.evalExpr(stmt.value, env) : undefined;
        throw new ReturnSignal(val);
      }

      case 'say': {
        const msg = String(this.evalExpr(stmt.expr, env) ?? '');
        this.outputLog.push(msg);
        if (this.onSay) {
          this.onSay(msg);
        }
        break;
      }

      case 'turn': {
        const angle = Number(this.evalExpr(stmt.angle, env)) || 0;
        if (this.currentActor) {
          this.currentActor.angle = (this.currentActor.angle + angle) % 360;
        }
        break;
      }

      case 'call_stmt': {
        this.evalExpr(stmt.expr, env);
        break;
      }
    }
  }

  executeBlock(statements: Stmt[], env: Environment): void {
    const prevEnv = this.currentEnv;
    this.currentEnv = env;
    try {
      for (const stmt of statements) {
        this.executeStmt(stmt, env);
      }
    } finally {
      this.currentEnv = prevEnv;
    }
  }
}
