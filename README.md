# Bolao Copa 2026

App estatico para bolao da Copa 2026 com Firebase Realtime Database.

## Rodar local

```powershell
node .local-server.js
```

Acesse:

```text
http://localhost:3000
```

## Arquivos principais

- `index.html`: estrutura HTML e modais.
- `styles.css`: estilos do app.
- `app.js`: regras do bolao, renderizacao, Firebase e sincronizacao de resultados.
- `database.rules.json`: regras simples para uso privado entre amigos.
- `.local-server.js`: servidor estatico local.

## Admin

O admin usa uma senha simples no app.

Senha atual:

```text
leyd1703@
```

Esse modelo e simples para uso entre amigos, mas nao e seguranca forte.

## Resultados automaticos

O app consulta a API publica da ESPN quando o admin abre o sistema ou clica em `Buscar agora`.

Fonte:

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```

Limites atuais:

- Nao roda sozinho se o admin nao abrir o app.
- Nao sobrescreve placares ja inseridos.
- O admin ainda pode corrigir resultados manualmente.

## Senhas dos jogadores

Novas senhas sao salvas como hash SHA-256 com salt. Senhas antigas em Base64 sao migradas automaticamente quando o jogador entra com a senha correta.
