# Guia das integrações do painel

As chaves abaixo devem ser coladas diretamente pelo proprietário em **Admin → Integrações**. Não envie Access Token, Client Secret ou token de frete por WhatsApp, e-mail ou arquivo no GitHub.

## Resumo

| Aba | Campos principais | Resultado atual |
|---|---|---|
| Mercado Pago | Public Key, Access Token e assinatura do webhook | Checkout transparente implementado |
| Appmax | Merchant Client ID/Secret, App ID, Site ID e External ID | Autenticação e webhook preparados; checkout ainda requer homologação Appmax JS |
| Melhor Envio | Token, CEP de origem e identificação técnica | Cotação real no checkout |
| Contrato direto | Transportadora, URL oficial, contrato, conta e token | Guarda segura; ativação exige adaptador específico |
| Google Merchant | Merchant ID e nome da empresa | Feed pronto para cadastro |
| Mercado Livre | App ID, Client Secret, Access Token e Refresh Token | Conta testável e catálogo preparado para mapeamento |
| Shopee | Partner ID, Shop ID, Partner Key e tokens | Loja testável e catálogo preparado para mapeamento |

## Mercado Pago

1. Na área Mercado Pago Developers, crie ou abra a aplicação da loja.
2. Copie primeiro as credenciais de teste: **Public Key** e **Access Token**.
3. Configure a notificação de pagamentos usando a URL exibida pelo painel:
   `https://SEU-DOMINIO/api/webhooks/mercado-pago`
4. Copie também a assinatura secreta dessa notificação.
5. No painel da loja, escolha Sandbox, cole os três valores, salve e teste.
6. Faça compras de teste e confira o pedido no painel.
7. Repita com as credenciais de produção somente após a homologação.

A Public Key vai para o navegador para carregar o Brick. O Access Token permanece no servidor e cria o pagamento. O número completo do cartão e o CVV não são armazenados pela loja.

Documentação oficial: [credenciais do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/additional-content/your-integrations/credentials) e [referência da API](https://www.mercadopago.com.br/developers/pt/reference).

## Appmax

O painel já autentica as credenciais do merchant nos ambientes Sandbox e Produção, guarda os segredos cifrados e recebe webhooks em:

`https://SEU-DOMINIO/api/webhooks/appmax`

Preencha:

- Merchant Client ID e Merchant Client Secret.
- App ID e Site ID, usados para conferir a origem lógica do evento.
- External ID, necessário quando o Appmax JS for homologado no checkout.
- Nome que aparecerá na fatura, se aprovado pela Appmax.

Importante: salvar e testar essas credenciais não troca automaticamente o checkout principal. O pagamento com Appmax precisa de uma etapa própria de homologação usando Appmax JS para que dados de cartão não passem pelo servidor. Até essa etapa ser concluída, mantenha Mercado Pago como checkout ativo.

A Appmax informa que seus webhooks não possuem HMAC. Por isso, o receptor valida o formato, App ID/Site ID, impede duplicidade, responde rapidamente e consulta o pedido novamente pela API antes de atualizar a loja.

Documentação oficial: [autenticação e URLs da Appmax](https://docs.appmax.com.br/api-reference/introduction), [Appmax JS](https://docs.appmax.com.br/guides/appmax-js) e [webhooks](https://docs.appmax.com.br/guides/webhooks).

## Melhor Envio

1. Crie/autorize a aplicação na conta Melhor Envio.
2. Gere um token no ambiente de teste.
3. Informe o CEP de onde os pacotes realmente sairão.
4. Use uma identificação técnica com nome e e-mail de contato.
5. Salve e clique em **Testar conexão**.
6. Faça cotações com CEPs próximos e distantes e compare no painel do Melhor Envio.

Os serviços exibidos dependem do que estiver liberado na conta e da cobertura para o pacote. Correios e transportadoras não são “fixos” no código: a API devolve os serviços disponíveis para cada cotação.

A integração da API não tem mensalidade própria, conforme a documentação do Melhor Envio; cada etiqueta/frete contratado continua tendo seu preço. Consulte [Introdução à API do Melhor Envio](https://docs.melhorenvio.com.br/docs/introducao-a-api).

### Regra de peso dos produtos

| Forma de venda | Peso calculado |
|---|---|
| Unidade | quantidade × kg por unidade + embalagem |
| Rolo fechado | quantidade × peso do rolo + embalagem |
| Metro corrido | metros faturados × kg por metro + embalagem |
| Metro quadrado | área faturada × kg por m² + embalagem |

As dimensões do pacote também crescem conforme a regra cadastrada. Pese ao menos três cortes/rolos reais, use uma margem segura de embalagem e valide o resultado antes de marcar **Frete verificado**.

A compra automática e a impressão de etiqueta não estão ativadas nesta entrega; primeiro é necessário homologar peso, dimensões, remetente e documentos fiscais.

## Outras transportadoras

Se a transportadora já aparecer na cotação do Melhor Envio, não precisa cadastrar um contrato separado. Para usar um contrato comercial próprio, selecione a transportadora no cartão **Contrato direto** e salve os dados com a integração desabilitada.

Cada empresa tem autenticação, tabela, limites e formato de etiqueta diferentes. O sistema deliberadamente não chama uma URL arbitrária informada pelo painel; isso evita uma vulnerabilidade de acesso interno (SSRF). A ativação ocorre depois de implementar e testar um adaptador para a documentação e o contrato específicos.

## Google Merchant Center

O feed fica em:

`https://SEU-DOMINIO/feeds/google-shopping.xml`

No Merchant Center:

1. Cadastre e verifique o domínio.
2. Informe dados da empresa, frete, devoluções e atendimento.
3. Crie uma fonte de dados programada usando a URL acima.
4. Corrija alertas de preço, disponibilidade, marca, GTIN/MPN e imagens.

Produtos de corte variável ficam fora do feed inicial até haver uma oferta final compatível com as regras do Google. Consulte a [especificação de dados de produtos](https://support.google.com/merchants/answer/7052112?hl=pt-BR), a [verificação do domínio](https://support.google.com/merchants/answer/11586344?hl=pt-BR) e a [atualização programada da fonte](https://support.google.com/merchants/answer/14991445?hl=pt-BR).

## Mercado Livre e Shopee

Abra **Admin → Marketplaces**. A conexão deve ser feita em três etapas:

1. Crie a aplicação no portal oficial do marketplace e autorize a conta do vendedor.
2. Com a integração desligada, cole as credenciais, salve e clique em **Testar conexão**.
3. Depois do teste aprovado, confira os SKUs e habilite a conta.

O Mercado Livre utiliza App ID/Client ID, Client Secret e tokens da conta autorizada. A Shopee utiliza Partner ID, Shop ID, Partner Key e tokens. Todos os valores privados ficam cifrados e não são devolvidos ao navegador depois de salvos.

Produtos vendidos por unidade ou rolo fechado podem ser vinculados diretamente depois que peso e embalagem forem conferidos. Produtos por metro corrido devem virar anúncios de tamanho fixo, como 1 m, 5 m, 10 m ou rolo. Produtos por m² devem usar largura e comprimento definidos. A calculadora livre continua no site próprio.

As vendas feitas nesses canais usam o pagamento e a logística do próprio marketplace. A importação e a atualização de estoque só devem ser liberadas depois de homologar o vínculo de cada SKU, para não alterar o anúncio errado.

Portais oficiais: [Mercado Livre Developers](https://developers.mercadolivre.com.br/) e [Shopee Open Platform](https://open.shopee.com/).
