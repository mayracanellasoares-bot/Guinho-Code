/** BIT Language Grammar v1.2 — declarative reference used by tooling/docs. */
export const BIT_GRAMMAR = {
  version: "1.2",
  fileExtension: ".bit",
  program: [
    "program := { topLevel } EOF",
    "topLevel := titleDecl | screenDecl | backgroundDecl | variableStmt | functionDecl | actorDecl | statement | comment",
    "titleDecl := 'jogo' STRING"
  ],
  declarations: [
    "screenDecl := 'tela' (DIMENSION | NUMBER (',' NUMBER | 'x' NUMBER))",
    "backgroundDecl := 'fundo' COLOR",
    "actorDecl := 'ator' IDENT { actorMember } 'fim'",
    "functionDecl := ('funcao'|'função') IDENT '(' [ paramList ] ')' { statement } 'fim'",
    "paramList := IDENT { ',' IDENT }"
  ],
  actorMembers: [
    "drawDecl := 'desenho' ('quadrado' NUMBER ',' COLOR | 'retangulo' NUMBER ',' NUMBER ',' COLOR | 'circulo' NUMBER ',' COLOR | 'texto' NUMBER ',' STRING ',' COLOR)",
    "positionDecl := ('posicao'|'posição') NUMBER ',' NUMBER",
    "velocityDecl := 'velocidade' [ '-' ] NUMBER ',' [ '-' ] NUMBER",
    "controlDecl := 'controlado' 'por' ('setas'|'toque'|'mouse')",
    "limitDecl := 'limita' ('a'|'à') 'tela'",
    "bounceDecl := 'quica' 'nas' 'bordas' [ ('verticais'|'horizontais') ]",
    "eventDecl := 'quando' ('atualiza'|'atualizar'|'quadro'|'frame') ':' { statement } 'fim'",
    "collisionEventDecl := 'quando' ('colide'|'colidir'|'tocar') 'com' (STRING|IDENT) ':' { statement } 'fim'"
  ],
  statements: [
    "assignment := lvalue ('='|'recebe') expression",
    "ifStmt := 'se' expression ('entao'|'então') { statement } [ ('senao'|'senão') [ 'se' expression ('entao'|'então') { statement } ] [ ('senao'|'senão') { statement } ] ] 'fim'",
    "repeatStmt := 'repita' expression 'vezes' { statement } 'fim'",
    "whileStmt := 'enquanto' expression [ ('faca'|'faça') ] { statement } 'fim'",
    "returnStmt := 'retorne' expression",
    "sayStmt := 'diga' expression",
    "expressionStmt := expression"
  ],
  expressions: [
    "expression := logicalOr",
    "logicalOr := logicalAnd { ('ou'|'||') logicalAnd }",
    "logicalAnd := equality { ('e'|'&&') equality }",
    "equality := comparison { ('=='|'!=') comparison }",
    "comparison := term { ('<'|'<='|'>'|'>=') term }",
    "term := factor { ('+'|'-') factor }",
    "factor := unary { ('*'|'/'|'%') unary }",
    "unary := ('-'|'!'|'nao'|'não') unary | postfix",
    "postfix := primary { call | member }",
    "call := '(' [ expression { ',' expression } ] ')'",
    "member := '.' IDENT",
    "primary := NUMBER | STRING | 'verdadeiro' | 'falso' | IDENT | '(' expression ')'",
    "lvalue := IDENT | IDENT '.' IDENT"
  ],
  builtins: [
    "aleatorio(min,max)", "distancia(x1,y1,x2,y2)", "tecla(nome)", "toque()", "tempo()",
    "seno(graus)", "cosseno(graus)", "raiz(valor)", "absoluto(valor)",
    "piso(valor)", "teto(valor)", "arredonda(valor)", "colide(a,b)"
  ],
  actorProperties: ["x","y","vx","vy","largura","altura","ativo"],
  colors: ["preto","branco","vermelho","verde","azul","amarelo","ciano","magenta","cinza","laranja","roxo","rosa","marrom","invisivel"],
  comments: ["# comentário","// comentário"],
} as const;
