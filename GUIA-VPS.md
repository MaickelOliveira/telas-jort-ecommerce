# Guia de publicação na VPS

Este guia foi escrito para uma VPS Ubuntu com domínio próprio. Recomenda-se pelo menos 2 vCPU, 4 GB de RAM e 40 GB de disco para a primeira versão.

## 1. Preparar domínio e servidor

1. Contrate a VPS e anote o IP público.
2. No provedor do domínio, crie um registro `A` para o endereço da loja apontando para esse IP.
3. Instale Docker Engine e o plugin Docker Compose seguindo a [documentação oficial do Docker para Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
4. Libere somente SSH, HTTP e HTTPS no firewall: portas 22, 80 e 443.
5. Antes de desativar login SSH por senha, confirme em outra janela que a sua chave SSH funciona. Mantenha um acesso de recuperação pelo console da empresa da VPS.

## 2. Colocar o projeto no GitHub

O repositório pode ser público porque não contém credenciais. Nunca envie `.env.production`, arquivos do banco antigo, backups ou chaves para o GitHub; esses arquivos já estão no `.gitignore`.

Na VPS, clone o repositório em `/opt/telas-jort` e dê acesso somente ao usuário responsável pelo deploy.

```bash
git clone URL_DO_REPOSITORIO /opt/telas-jort
cd /opt/telas-jort
```

## 3. Gerar acesso e chaves-mestras

Se Node.js 22 já estiver instalado:

```bash
node scripts/setup.mjs --domain loja.seudominio.com.br --email dono@seudominio.com.br
```

Se a VPS tiver somente Docker:

```bash
docker run --rm -it --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:22-bookworm-slim \
  node scripts/setup.mjs --domain loja.seudominio.com.br --email dono@seudominio.com.br
```

O assistente cria `.env.production` com permissão `600`, mostra uma senha temporária uma única vez e gera chaves aleatórias. Substitua o valor de `DATABASE_URL` pela URL do **Session pooler** exibida em **Supabase → Connect**, usando a senha do banco codificada para URL. Guarde a senha e uma cópia protegida das chaves em um gerenciador de senhas. Nunca envie esse arquivo ao GitHub.

Antes do primeiro deploy, execute o arquivo `db/supabase-schema.sql` no SQL Editor do projeto Supabase.

## 4. Subir a loja

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy
```

Quando o DNS estiver correto, acesse `https://loja.seudominio.com.br` e depois `/admin`. O certificado HTTPS é administrado automaticamente pelo Caddy.

Para verificar a saúde:

```bash
curl -fsS https://loja.seudominio.com.br/api/health
```

A resposta esperada é `{"status":"ok"}`.

## 5. Conectar pagamentos, fretes e Google

Entre no painel e abra **Sistema → Integrações**. Sempre comece no ambiente Sandbox/Testes:

1. Salve as credenciais.
2. Clique em **Testar conexão**.
3. Cadastre no provedor a URL de webhook mostrada no painel.
4. Faça pedidos completos de teste.
5. Confira valores, peso, endereço, status do pedido e logs.
6. Só então troque a integração para Produção.

Os detalhes de cada campo estão em [GUIA-INTEGRACOES.md](./GUIA-INTEGRACOES.md).

## 6. Conferir pesos de telas e rolos

Em **Loja → Produtos**, abra cada produto que será enviado e preencha peso e embalagem. Só marque **Frete verificado** depois de pesar e medir o pacote pronto. Produtos vendidos por corte usam o peso por metro ou por metro quadrado informado ali.

Se qualquer item do carrinho estiver sem conferência, o sistema bloqueia o frete automático e mantém apenas a retirada. Essa trava evita vender um frete calculado com peso fictício.

## 7. Backups

O banco principal está no Supabase. Configure e teste os backups do projeto no próprio provedor e mantenha uma cópia externa conforme a política da empresa. O volume `/app/data` é mantido apenas para que a primeira inicialização possa importar automaticamente o antigo arquivo SQLite, caso ele exista.

## 8. Publicação pelo GitHub

O arquivo `.github/workflows/deploy-vps.yml` cria uma publicação manual em **Actions → Publicar na VPS**. Cadastre estes segredos no repositório:

- `VPS_HOST`: IP ou hostname da VPS.
- `VPS_USER`: usuário de deploy sem login por senha.
- `VPS_SSH_PRIVATE_KEY`: chave privada exclusiva para o GitHub Actions.
- `VPS_KNOWN_HOSTS`: chave pública do host SSH, obtida e conferida por um canal confiável.

Na VPS, o repositório precisa estar em `/opt/telas-jort`, na branch `main`, e o usuário deve poder executar Docker. O workflow usa `git pull --ff-only`; ele para em vez de sobrescrever uma alteração manual conflitante.

## 9. Manutenção mensal

- Instalar atualizações de segurança do sistema.
- Atualizar imagens e dependências após testar em ambiente separado.
- Revisar tentativas de login, erros de webhook e disponibilidade.
- Conferir certificado, espaço em disco e validade dos tokens.
- Fazer pedido de teste por Pix/cartão e uma cotação real de frete.
- Confirmar que o backup externo recente pode ser restaurado.

Antes de aceitar vendas, conclua [CHECKLIST-PRODUCAO.md](./CHECKLIST-PRODUCAO.md).
