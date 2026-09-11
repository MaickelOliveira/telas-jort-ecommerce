# Plataforma de e-commerce Telas Jort

Loja própria para VPS, construída com Next.js, React, TypeScript, SQLite, Docker e Caddy. O projeto não depende de Shopify ou Yampi para exibir a loja. O checkout principal implementado usa Mercado Pago.

## O que já funciona

- Loja responsiva com catálogo, busca, categorias, páginas institucionais e SEO.
- 27 produtos e imagens trazidos da loja atual.
- Carrinho persistente no navegador.
- Venda por unidade, rolo fechado, metro corrido ou metro quadrado.
- Cálculo no servidor de preço, quantidade faturada, peso e volumes de transporte.
- Checkout transparente do Mercado Pago com Pix, cartão e demais métodos liberados no Brick.
- Cotação real de frete pelo Melhor Envio e retirada na loja.
- Feed XML para Google Merchant Center em `/feeds/google-shopping.xml`.
- Painel com pedidos, clientes, produtos, configurações, acessos, vendas e visitantes ativos.
- Central administrativa para credenciais de Mercado Pago, Appmax, Melhor Envio, Google Merchant e contratos diretos.
- Área de Marketplaces para Mercado Livre e Shopee, com credenciais cifradas, teste oficial de conta e preparação dos produtos por SKU/medida.
- Docker Compose, HTTPS automático, health check, CI do GitHub e publicação manual pela GitHub Action.

## Situação exata das integrações

| Serviço | Implementado | Ainda depende de |
|---|---|---|
| Mercado Pago | Brick no checkout, criação de pagamento, idempotência, confirmação por API e webhook assinado | Credenciais, testes e homologação na conta do cliente |
| Appmax | Campos no painel, credenciais cifradas, autenticação OAuth real, teste de conexão e receptor de webhook | Implementar/homologar o checkout Appmax JS antes de escolhê-lo como pagamento principal |
| Melhor Envio | Cálculo real por CEP, peso e embalagem | Token, conferência física dos produtos e homologação; compra automática de etiqueta não está liberada |
| Outras transportadoras | Serviços liberados na conta do Melhor Envio aparecem automaticamente; painel guarda um contrato direto | Cada contrato direto exige um adaptador próprio da API da transportadora |
| Google Shopping | Feed, sitemap, dados estruturados e endereço copiável no painel | Verificação do domínio, políticas e aprovação dos produtos no Merchant Center |
| Mercado Livre | Cadastro seguro, teste da conta e análise de compatibilidade do catálogo | Conta de vendedor, aplicação, tokens e homologação do vínculo entre SKU e anúncio |
| Shopee | Cadastro seguro, assinatura das chamadas, teste da loja e análise do catálogo | Aprovação na Open Platform, Partner ID/Key, tokens e homologação dos SKUs |

O painel não apresenta uma conexão como ativa sem as credenciais exigidas. Em produção, sem Mercado Pago o checkout não simula cobrança; sem Melhor Envio, só oferece retirada.

## Abrir localmente

Pré-requisito: Node.js 22.13 ou superior.

```bash
corepack enable
pnpm install
ALLOW_DEMO_ADMIN=true pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). O painel fica em [http://localhost:3000/admin](http://localhost:3000/admin); no modo acima aparece o botão **Abrir demonstração local**.

Não cadastre credenciais reais no banco de demonstração. Para um acesso local com senha, gere um hash com:

```bash
pnpm admin:create -- seu-email@dominio.com.br
```

No EasyPanel também é possível informar somente `ADMIN_EMAIL` e `ADMIN_PASSWORD` diretamente. Nesse modo, a chave da sessão administrativa é derivada da credencial. Definir um `SESSION_SECRET` longo e independente continua sendo recomendado, assim como usar o hash em uma VPS administrada manualmente.

## Publicar na VPS

Siga [GUIA-VPS.md](./GUIA-VPS.md). O fluxo resumido é:

```bash
git clone URL_DO_REPOSITORIO /opt/telas-jort
cd /opt/telas-jort
node scripts/setup.mjs --domain loja.seudominio.com.br --email dono@seudominio.com.br
docker compose up -d --build
```

Se a VPS tiver apenas Docker, o guia mostra como executar o assistente sem instalar Node no servidor. O Caddy obtém e renova o certificado HTTPS quando o DNS já aponta para a VPS.

## Comandos de verificação

```bash
pnpm typecheck
pnpm lint
pnpm audit:prod
pnpm build
pnpm db:init
pnpm backup
```

## Arquivos importantes

- `GUIA-VPS.md`: instalação, DNS, GitHub, firewall e backup.
- `GUIA-INTEGRACOES.md`: onde obter e colar cada credencial.
- `CHECKLIST-PRODUCAO.md`: tudo que precisa ser conferido antes de aceitar dinheiro real.
- `.env.example`: exemplo sem segredos.
- `data/catalog.json`: catálogo original usado como base.

## Segurança e responsabilidade operacional

As credenciais privadas e os dados pessoais do pedido são cifrados com AES-256-GCM. Senhas usam scrypt; a sessão administrativa usa cookie HttpOnly, SameSite e expiração. Há limitação de tentativas, validação de origem, CSP, headers defensivos, confirmação de webhooks pela API do provedor e isolamento do aplicativo em uma rede Docker interna.

Isso reduz bastante os riscos, mas nenhum site é “impossível de invadir”. A operação precisa manter a VPS atualizada, usar senha exclusiva, controlar o acesso SSH, monitorar logs e testar backups externos. A chave `DATA_ENCRYPTION_KEY` não pode ser perdida: sem ela, dados e credenciais cifrados não podem ser recuperados.
