# BIT Language Reference — v1.2

BIT é uma linguagem textual voltada à criação de jogos 2D. Arquivos-fonte usam a extensão `.bit`.

O contrato executável desta referência é o parser em `src/parser.ts`, protegido pelos testes em `tests`. Recursos não cobertos pelo parser não fazem parte da BIT 1.2.

## 0. Título do jogo

```bit
jogo "Meu primeiro jogo"
```

O título é opcional. Sem essa declaração, o runtime usa `BIT`.

## 1. Programa mínimo

```bit
tela 320x180
fundo preto

ator Jogador
  desenho quadrado 16, verde
  posição 40, 80
fim
```

## 2. Variáveis e atribuição

```bit
pontos recebe 0
vidas = 3
pontos recebe pontos + 10
```

`recebe` e `=` são equivalentes.

## 3. Expressões

Suporte a números, textos, booleanos, identificadores, propriedades de atores, chamadas de função, parênteses e os operadores:

- aritméticos: + - * / %
- comparação: == != < <= > >=
- lógico: `e`/`ou`, `&&`/`||`
- unário: - e nao/não/!

Precedência: chamada/propriedade > unário > multiplicação > soma > comparação > igualdade > e > ou.

## 4. Controle

```bit
se pontos >= 100 então
  diga "Você venceu!"
senão se vidas > 0 então
  diga "Continue"
senão
  diga "Fim de jogo"
fim
```

```bit
repita 10 vezes
  diga "Olá"
fim
```

```bit
enquanto vidas > 0 faça
  vidas recebe vidas - 1
fim
```

## 5. Funções

```bit
função dobro(n)
  retorne n * 2
fim

resultado recebe dobro(21)
```

## 6. Atores

```bit
ator Bola
  desenho quadrado 8, branco
  posição 100, 60
  velocidade 2, 1
  quica nas bordas
fim
```

Propriedades: `x`, `y`, `vx`, `vy`, `largura`, `altura`, `ativo`.

Dentro de eventos de um ator, propriedades simples como `x` e `vx` referem-se ao ator atual. Fora deles, use `Bola.x`, `Bola.vx`, etc.

## 7. Eventos

```bit
ator Jogador
  ...
  quando atualiza:
    se tecla("direita") então
      x recebe x + 3
    fim
  fim
fim
```

Colisão:

```bit
ator Bola
  ...
  quando colide com "Bloco":
    vx recebe -vx
  fim
fim
```

## 8. Funções da biblioteca

| Função | Retorno |
|---|---|
| `aleatorio(min,max)` | inteiro |
| `distancia(x1,y1,x2,y2)` | número |
| `tecla(nome)` | booleano; aceita `esquerda`, `direita`, `cima`, `baixo`, `espaco`, `enter`, setas (`arrowleft` etc.) e letras |
| `toque()` | booleano |
| `tempo()` | número |
| `seno(graus)` | número |
| `cosseno(graus)` | número |
| `raiz(valor)` | número |
| `absoluto(valor)` | número |
| `piso(valor)` | inteiro |
| `teto(valor)` | inteiro |
| `arredonda(valor)` | inteiro |
| `colide(a,b)` | booleano |

## 9. Sintaxe de desenho

```bit
desenho quadrado TAMANHO, COR
desenho retangulo LARGURA, ALTURA, COR
desenho circulo RAIO, COR
desenho texto TAMANHO, "conteúdo", COR
```

## 10. Regras de compatibilidade

- Identificadores não diferenciam maiúsculas de minúsculas.
- Acentos são aceitos nas palavras-chave documentadas e suas variantes listadas.
- Comentários usam `#` ou `//`.
- Uma declaração por linha é recomendada para legibilidade.
- `fim` encerra blocos de ator, função, condição, repetição, laço e evento.

## 11. Exemplo completo: Pong

```bit
tela 320x180
fundo preto

pontos recebe 0

ator Jogador
  desenho retangulo 8, 40, branco
  posição 20, 70
  controlado por setas
  limita à tela
fim

ator Bola
  desenho quadrado 8, branco
  posição 156, 86
  velocidade 2, 1
  quica nas bordas verticais

  quando atualiza:
    se x < 0 então
      pontos recebe pontos + 1
    fim
  fim

  quando colide com "Jogador":
    vx recebe absoluto(vx)
  fim
fim

diga "Pontos: " + pontos
```
