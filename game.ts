import { ProgramAST } from '../types.ts';
import { Actor, InputState } from './actor.ts';
import { checkAABB } from './collision.ts';
import { createBuiltins, BuiltinContext } from '../interp/builtins.ts';
import { Interpreter } from '../interp/interpreter.ts';
import { resolveColor } from '../colors.ts';

export class Game {
  ast: ProgramAST;
  actors: Map<string, Actor> = new Map();
  interpreter: Interpreter;
  input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
    touchActive: false
  };
  keysDown = new Set<string>();
  running = false;
  animationFrameId: number | null = null;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  logs: string[] = [];

  constructor(ast: ProgramAST, canvas?: HTMLCanvasElement) {
    this.ast = ast;
    this.canvas = canvas ?? null;
    this.ctx = canvas ? canvas.getContext('2d') : null;

    // Instantiate actors from AST
    for (const actorDecl of ast.actors) {
      const actor = new Actor(
        actorDecl.name,
        actorDecl.x,
        actorDecl.y,
        actorDecl.vx,
        actorDecl.vy,
        actorDecl.shape,
        actorDecl.controlledBy,
        actorDecl.limitToScreen,
        actorDecl.bounceBorders
      );
      this.actors.set(actorDecl.name.toLowerCase(), actor);
    }

    // Set up Builtin Context
    const builtinCtx: BuiltinContext = {
      isKeyDown: (key) => this.keysDown.has(key.toLowerCase()),
      isTouchActive: () => this.input.touchActive,
      getActor: (name) => {
        const a = this.actors.get(name.toLowerCase());
        return a ? { x: a.x, y: a.y, width: a.width, height: a.height } : undefined;
      },
      checkCollision: (a, b) => {
        const actA = a instanceof Actor ? a : this.actors.get(String(a).toLowerCase());
        const actB = b instanceof Actor ? b : this.actors.get(String(b).toLowerCase());
        if (actA && actB) {
          return checkAABB(actA, actB);
        }
        return false;
      },
      getTime: () => performance.now() / 1000
    };

    const builtins = createBuiltins(builtinCtx);
    this.interpreter = new Interpreter(builtins, this.actors);
    this.interpreter.onSay = (msg) => {
      this.logs.push(msg);
    };

    // Execute global statements
    this.interpreter.executeBlock(ast.globalStatements, this.interpreter.globalEnv);

    // Execute initial statements inside each actor declaration
    for (const actorDecl of ast.actors) {
      const actor = this.actors.get(actorDecl.name.toLowerCase());
      if (actor && actorDecl.statements.length > 0) {
        this.interpreter.currentActor = actor;
        this.interpreter.executeBlock(actorDecl.statements, this.interpreter.globalEnv);
        this.interpreter.currentActor = undefined;
      }
    }
  }

  handleKeyDown(key: string): void {
    const k = key.toLowerCase();
    this.keysDown.add(k);
    if (k === 'arrowup' || k === 'w') this.input.up = true;
    if (k === 'arrowdown' || k === 's') this.input.down = true;
    if (k === 'arrowleft' || k === 'a') this.input.left = true;
    if (k === 'arrowright' || k === 'd') this.input.right = true;
    if (k === ' ' || k === 'enter') this.input.action = true;
  }

  handleKeyUp(key: string): void {
    const k = key.toLowerCase();
    this.keysDown.delete(k);
    if (k === 'arrowup' || k === 'w') this.input.up = false;
    if (k === 'arrowdown' || k === 's') this.input.down = false;
    if (k === 'arrowleft' || k === 'a') this.input.left = false;
    if (k === 'arrowright' || k === 'd') this.input.right = false;
    if (k === ' ' || k === 'enter') this.input.action = false;
  }

  handleTouch(x?: number, y?: number, active: boolean = true): void {
    this.input.touchX = x;
    this.input.touchY = y;
    this.input.touchActive = active;
  }

  step(): void {
    const { screenWidth, screenHeight } = this.ast;

    // 1. Update physics and positions of actors
    for (const actor of this.actors.values()) {
      actor.update(screenWidth, screenHeight, this.input);
    }

    // 2. Check collisions between pairs of actors
    const actorList = Array.from(this.actors.values());
    for (let i = 0; i < actorList.length; i++) {
      for (let j = i + 1; j < actorList.length; j++) {
        const a1 = actorList[i];
        const a2 = actorList[j];
        if (a1.active && a2.active && checkAABB(a1, a2)) {
          // Trigger collision event on a1
          this.triggerActorEvent(a1, `colide:${a2.name}`);
          this.triggerActorEvent(a1, 'colide');
          // Trigger collision event on a2
          this.triggerActorEvent(a2, `colide:${a1.name}`);
          this.triggerActorEvent(a2, 'colide');
        }
      }
    }

    // 3. Trigger frame update events (quando atualiza:)
    for (const actor of this.actors.values()) {
      if (actor.active) {
        this.triggerActorEvent(actor, 'atualiza');
      }
    }

    // 4. Render to canvas if present
    this.render();
  }

  private triggerActorEvent(actor: Actor, eventKey: string): void {
    const decl = this.ast.actors.find(a => a.name.toLowerCase() === actor.name.toLowerCase());
    if (!decl) return;

    const handler = decl.events[eventKey] || decl.events[eventKey.toLowerCase()];
    if (handler && handler.length > 0) {
      this.interpreter.currentActor = actor;
      this.interpreter.executeBlock(handler, this.interpreter.globalEnv);
      this.interpreter.currentActor = undefined;
    }
  }

  render(): void {
    if (!this.ctx || !this.canvas) return;

    const { screenWidth, screenHeight, backgroundColor } = this.ast;
    this.ctx.fillStyle = resolveColor(backgroundColor, '#000000');
    this.ctx.fillRect(0, 0, screenWidth, screenHeight);

    for (const actor of this.actors.values()) {
      actor.draw(this.ctx);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.render();

    const loop = () => {
      if (!this.running) return;
      this.step();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
