export type TokenType =
  | 'PALAVRA'
  | 'NUMERO'
  | 'TEXTO'
  | 'OPERADOR'
  | 'PONTUACAO'
  | 'NOVA_LINHA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export type ShapeType = 'quadrado' | 'retangulo' | 'circulo' | 'texto' | 'imagem';

export interface DrawShape {
  type: ShapeType;
  width: number;
  height: number;
  color: string;
  text?: string;
  radius?: number;
}

export type ControlledBy = 'setas' | 'toque' | 'mouse' | 'nenhum';

export interface BounceConfig {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export type Expr =
  | { kind: 'literal'; value: number | string | boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'unary'; op: string; expr: Expr }
  | { kind: 'call'; callee: string; args: Expr[] }
  | { kind: 'member'; object: string; property: string };

export type Stmt =
  | { kind: 'assign'; target: string; property?: string; value: Expr }
  | { kind: 'if'; cond: Expr; then: Stmt[]; els?: Stmt[] }
  | { kind: 'repeat'; times: Expr; body: Stmt[] }
  | { kind: 'while'; cond: Expr; body: Stmt[] }
  | { kind: 'func'; name: string; params: string[]; body: Stmt[] }
  | { kind: 'return'; value?: Expr }
  | { kind: 'say'; expr: Expr }
  | { kind: 'turn'; angle: Expr }
  | { kind: 'call_stmt'; expr: Expr }
  | { kind: 'actor_prop'; prop: string; args: (string | number | boolean | Expr)[] }
  | { kind: 'event'; event: string; arg?: string; body: Stmt[] };

export interface ActorDecl {
  name: string;
  shape?: DrawShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  controlledBy: ControlledBy;
  limitToScreen: boolean;
  bounceBorders: BounceConfig;
  events: { [key: string]: Stmt[] };
  statements: Stmt[];
}

export interface ProgramAST {
  title: string;
  screenWidth: number;
  screenHeight: number;
  backgroundColor: string;
  actors: ActorDecl[];
  globalStatements: Stmt[];
}
