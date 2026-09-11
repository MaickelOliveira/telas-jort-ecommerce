# Checklist antes de receber pagamentos reais

## Empresa e conteúdo

- [ ] CNPJ, razão/nome, endereço, telefone e e-mail conferidos pelo cliente.
- [ ] Políticas de entrega, privacidade, troca e devolução revisadas por responsável jurídico/contábil.
- [ ] Domínio definitivo apontando para a VPS e HTTPS válido.
- [ ] Fotos e descrições com autorização de uso.
- [ ] Planilha do Google Drive comparada com os 27 produtos importados.

## Produtos por medida

- [ ] Cada produto marcado como unidade, rolo, metro corrido ou metro quadrado corretamente.
- [ ] Preço, mínimo, máximo e passo de corte conferidos.
- [ ] Alturas fixas e alturas selecionáveis conferidas.
- [ ] Peso por unidade, metro ou m² medido em produto real.
- [ ] Embalagem pronta pesada e medida.
- [ ] **Frete verificado** marcado somente após o teste físico.
- [ ] Regra de arredondamento e tolerância de corte aprovada pelo cliente.

## Mercado Pago

- [ ] Credenciais de teste salvas e botão **Testar conexão** aprovado.
- [ ] Webhook e assinatura secreta cadastrados.
- [ ] Pix de teste aprovado e pedido atualizado.
- [ ] Cartão aprovado, recusado e pagamento pendente testados.
- [ ] Valor do produto, frete e total comparados com o Mercado Pago.
- [ ] Credenciais de produção ativadas somente depois dos testes.

## Frete

- [ ] Melhor Envio conectado primeiro em Sandbox.
- [ ] Cotações comparadas para ao menos cinco CEPs.
- [ ] Volumes grandes testados com as regras reais da transportadora.
- [ ] Retirada na loja e instruções operacionais aprovadas.
- [ ] Processo manual de etiqueta definido enquanto a compra automática não estiver homologada.
- [ ] Contrato direto mantido desativado até o respectivo adaptador ficar pronto.

## Operação e segurança

- [ ] Senha temporária trocada/gerada novamente e guardada em gerenciador de senhas.
- [ ] Acesso SSH somente por chave e acesso de recuperação testado.
- [ ] Firewall expondo apenas 22, 80 e 443.
- [ ] Atualizações automáticas de segurança do sistema configuradas.
- [ ] Tabelas criadas no Supabase e conexão `DATABASE_URL` validada em `/api/readiness`.
- [ ] Backup do banco Supabase configurado e exportação externa protegida.
- [ ] Restauração de um backup do PostgreSQL testada.
- [ ] `DATA_ENCRYPTION_KEY` guardada fora da VPS.
- [ ] Logs e espaço em disco sendo monitorados.

## Google Shopping

- [ ] Domínio verificado no Merchant Center.
- [ ] Feed cadastrado e atualização programada.
- [ ] Frete e devoluções configurados no Google.
- [ ] Produtos reprovados/alertas revisados.
- [ ] Conversões e consentimento de cookies avaliados antes de instalar tags adicionais.

## Marketplaces

- [ ] Aplicação do Mercado Livre criada e conta do vendedor autorizada.
- [ ] Aplicação/parceiro da Shopee aprovado e loja autorizada.
- [ ] Credenciais salvas com a integração desligada e teste aprovado.
- [ ] Cada SKU vinculado ao anúncio correto antes da sincronização.
- [ ] Produtos por metro/m² transformados em pacotes ou medidas fixas.
- [ ] Preço, comissão, peso, estoque e logística conferidos em cada canal.
- [ ] Um pedido de teste de cada marketplace apareceu corretamente no painel.

## Liberação final

- [ ] Um pedido completo foi feito no domínio definitivo.
- [ ] O dinheiro apareceu na conta correta do cliente.
- [ ] O frete cobrado correspondeu ao serviço escolhido.
- [ ] Pedido apareceu no painel com cliente e endereço corretos.
- [ ] Cancelamento/estorno e atendimento foram ensaiados.
- [ ] Cliente aprovou por escrito a entrada em produção.
