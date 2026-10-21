# PostgreSQL nativo no Easypanel

A loja acessa PostgreSQL diretamente. Contas de clientes, senhas e sessões são geridas pelo aplicativo; as imagens fazem parte do repositório. Não é necessário instalar Supabase Auth, Storage ou PostgREST para esta loja.

## Antes da troca

1. Recuperar o projeto Supabase original, se estiver pausado. Não substituir dados atuais por uma base vazia ou pelo SQLite antigo.
2. Guardar a versão atual do código e uma cópia privada das variáveis do serviço. Preservar especialmente `DATA_ENCRYPTION_KEY`, as chaves de sessão e as credenciais administrativas. Não enviar esses arquivos ao GitHub.
3. Fazer um backup completo com `pg_dump --no-owner --no-privileges` e uma exportação das 13 tabelas da loja com `node scripts/transfer-postgres.mjs export /caminho/privado/dados.json`. O comando usa uma transação consistente, não altera dados e não sobrescreve um backup existente.
4. Suspender novas gravações durante a exportação final e conferir pedidos, clientes, configurações e integrações. Manter o projeto original preservado para reversão.

## Banco de destino

Criar o serviço Postgres `tjecommerce-db`, banco e usuário `tjecommerce`, com senha aleatória e volume persistente. Manter a porta 5432 privada. Não configurar domínio ou porta externa para o banco.

Aplicar no destino vazio `db/migrations/20261021_native_postgres.sql`. Essa migração cria as tabelas, índices e gatilhos, preservando RLS, sem exigir os papéis específicos do Supabase.

Com `DATABASE_URL` apontando para o destino, executar:

```sh
node scripts/transfer-postgres.mjs restore /caminho/privado/dados.json
node scripts/transfer-postgres.mjs verify /caminho/privado/dados.json
```

A restauração recusa qualquer destino com registros e importa as tabelas em uma única transação, respeitando suas dependências. Antes de confirmar, compara quantidades e SHA-256 dos registros de todas as tabelas; divergências cancelam a transação. O backup contém dados privados, incluindo hashes de senha, e deve permanecer fora de pastas públicas e com permissão 600.

## Aplicação e validação

Atualizar somente a conexão da loja e seu endereço canônico:

```dotenv
DATABASE_URL=postgresql://tjecommerce:SENHA_CODIFICADA@lp_tjecommerce-db:5432/tjecommerce
DATABASE_SSL=disable
APP_URL=https://lp-tjecommerce.ztcjzs.easypanel.host
```

Usar `disable` apenas nessa rede privada. Para Supabase ou qualquer conexão externa, manter `DATABASE_SSL=require` (padrão). Codificar caracteres especiais da senha na URL. As demais variáveis, principalmente a chave de criptografia, devem permanecer iguais.

Publicar a versão validada, confirmar `/api/readiness` com `database: connected`, catálogo, imagens, produto, carrinho, autenticação e leitura de pedidos no painel. Não efetuar cobranças ou enviar pedidos reais como teste. Confirmar também que a restauração dos dados cifrados funciona com a chave original.

## Reversão e backups

Antes de reabrir gravações, uma falha permite voltar à versão anterior e ao arquivo de ambiente preservado, desde que o Supabase original esteja acessível. Depois de receber novas gravações no destino, sincronizar esses registros antes de qualquer reversão para não perder pedidos. Não apagar o Supabase na migração.

Manter cópias periódicas do PostgreSQL e da chave de criptografia em armazenamento privado, incluindo uma cópia fora da VPS. Testar restauração em banco separado. O antigo `backup:legacy` cobre apenas SQLite; não serve como backup do PostgreSQL.
