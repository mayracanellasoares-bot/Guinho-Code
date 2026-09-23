import { DrawShape, ControlledBy, BounceConfig } from './types.ts';
import { resolveColor } from './colors.ts';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;
  touchX?: number;
  touchY?: number;
  touchActive: boolean;
}

export class Actor {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  shape?: DrawShape;
  controlledBy: ControlledBy;
  limitToScreen: boolean;
  bounceBorders: BounceConfig;
  active: boolean = true;
  angle: number = 0;
  props: Record<string, unknown> = {};

  constructor(
    name: string,
    x: number,
    y: number,
    vx: number = 0,
    vy: number = 0,
    shape?: DrawShape,
    controlledBy: ControlledBy = 'nenhum',
    limitToScreen: boolean = false,
    bounceBorders: BounceConfig = { top: false, bottom: false, left: false, right: false }
  ) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.shape = shape;
    this.controlledBy = controlledBy;
    this.limitToScreen = limitToScreen;
    this.bounceBorders = { ...bounceBorders };

    this.width = shape?.width ?? 8;
    this.height = shape?.height ?? 8;
  }

  update(screenWidth: number, screenHeight: number, input: InputState): void {
    if (!this.active) return;

    // Movement by user controls
    if (this.controlledBy === 'setas') {
      const speed = Math.hypot(this.vx, this.vy) || 2;
      if (input.up) this.y -= speed;
      if (input.down) this.y += speed;
      if (input.left) this.x -= speed;
      if (input.right) this.x += speed;
    } else {
      // Natural motion by velocity
      this.x += this.vx;
      this.y += this.vy;
    }

    // Touch control if mobile touch is active
    if (this.controlledBy === 'toque' && input.touchActive && input.touchX !== undefined && input.touchY !== undefined) {
      this.x = input.touchX - this.width / 2;
      this.y = input.touchY - this.height / 2;
    }

    // Bounce logic - strictly respects which borders are configured to bounce!
    // In Pong, top & bottom bounce, but left & right do not, allowing the ball to exit for score detection!
    if (this.bounceBorders.top && this.y <= 0) {
      this.y = 0;
      this.vy = Math.abs(this.vy);
    }
    if (this.bounceBorders.bottom && this.y + this.height >= screenHeight) {
      this.y = screenHeight - this.height;
      this.vy = -Math.abs(this.vy);
    }
    if (this.bounceBorders.left && this.x <= 0) {
      this.x = 0;
      this.vx = Math.abs(this.vx);
    }
    if (this.bounceBorders.right && this.x + this.width >= screenWidth) {
      this.x = screenWidth - this.width;
      this.vx = -Math.abs(this.vx);
    }

    // Clamp to screen limits ONLY if limitToScreen is explicitly enabled (e.g. player paddles/spaceships)
    if (this.limitToScreen) {
      this.x = Math.max(0, Math.min(this.x, screenWidth - this.width));
      this.y = Math.max(0, Math.min(this.y, screenHeight - this.height));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active || !this.shape) return;

    ctx.save();
    const color = resolveColor(this.shape.color);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (this.shape.type === 'quadrado' || this.shape.type === 'retangulo') {
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.width, this.height);
    } else if (this.shape.type === 'circulo') {
      const radius = this.shape.radius ?? this.width / 2;
      ctx.beginPath();
      ctx.arc(
        Math.round(this.x + radius),
        Math.round(this.y + radius),
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (this.shape.type === 'texto' && this.shape.text) {
      ctx.font = `${Math.round(this.height)}px monospace`;
      ctx.textBaseline = 'top';
      ctx.fillText(this.shape.text, Math.round(this.x), Math.round(this.y));
    }

    ctx.restore();
  }
}
