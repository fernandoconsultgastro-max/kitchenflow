# KitchenFlow V2 — Sistema de Gestão Gastronômica Inteligente

Sistema completo de gestão para restaurantes com foco em **controle operacional, precisão de custos e tomada de decisão estratégica**.

---

##  Sobre o Projeto

O KitchenFlow V2 foi desenvolvido com base em **operações reais de cozinha profissional**, integrando:

- Gestão de pedidos
- Controle de custos (CMV real)
- Ficha técnica
- Inteligência de cardápio
- Análise de lucratividade

 Não é um CRUD simples. É um sistema orientado a regras de negócio.

---

##  Arquitetura

O sistema segue estrutura modular:

- **Controller:** entrada de requisições
- **Service:** regras de negócio
- **Data:** armazenamento (JSON)

Preparado para evolução para banco de dados (MongoDB).

---

##  Tecnologias

- Node.js
- Express.js
- JavaScript
- HTML / CSS
- DOM
- JSON

---

##  Funcionalidades

### 🧾 Operação
- Gestão de comandas
- Múltiplos pagamentos
- Cálculo automático de troco

###  Financeiro
- Faturamento total
- Ticket médio
- Lucro bruto

### Inteligência
- CMV por prato
- Lucratividade
- Ranking de desempenho

---

##  Diferencial Técnico

### CMV REAL por prato

```txt
Custo do prato = Σ (quantidade do insumo × custo unitário)
---

## ▶️ Execução do Projeto (Backend)

```bash
npm install
node server.js
