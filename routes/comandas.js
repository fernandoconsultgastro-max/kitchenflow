const express = require("express");
const router = express.Router();

const comandasController = require("../controllers/comandasController");

// ======================================
// ROTAS DE COMANDAS
// IMPORTANTE:
// rotas mais específicas primeiro
// e rotas dinâmicas depois
// ======================================

// --------------------------------------
// ABRIR NOVA COMANDA
// POST /comandas
// body:
// {
//   mesa_id,
//   cliente_nome,
//   origem,
//   observacao
// }
// --------------------------------------
router.post("/", comandasController.abrirComanda);

// --------------------------------------
// LISTAR COMANDAS
// GET /comandas
// query opcional:
// ?status=aberta
// ?origem=salao
// --------------------------------------
router.get("/", comandasController.listarComandas);

// --------------------------------------
// DETALHAR COMANDA
// GET /comandas/:id
// --------------------------------------
router.get("/:id", comandasController.detalharComanda);

// --------------------------------------
// LISTAR ITENS DA COMANDA
// GET /comandas/:id/itens
// --------------------------------------
router.get("/:id/itens", comandasController.listarItensComanda);

// --------------------------------------
// ADICIONAR ITEM À COMANDA
// POST /comandas/:id/itens
// body:
// {
//   prato_id,
//   quantidade,
//   observacao
// }
// --------------------------------------
router.post("/:id/itens", comandasController.adicionarItemComanda);

// --------------------------------------
// APLICAR DESCONTO NA COMANDA
// PATCH /comandas/:id/desconto
// body:
// {
//   desconto
// }
// --------------------------------------
router.patch("/:id/desconto", comandasController.aplicarDescontoComanda);

// --------------------------------------
// FECHAR COMANDA
// PATCH /comandas/:id/fechar
// --------------------------------------
router.patch("/:id/fechar", comandasController.fecharComanda);

// --------------------------------------
// CANCELAR COMANDA
// PATCH /comandas/:id/cancelar
// --------------------------------------
router.patch("/:id/cancelar", comandasController.cancelarComanda);

// --------------------------------------
// ATUALIZAR STATUS DE ITEM DA COMANDA
// PATCH /comandas/itens/:itemId/status
// body:
// {
//   status_item
// }
// status_item:
// pendente | em_preparo | pronto | entregue | cancelado
// --------------------------------------
router.patch(
  "/itens/:itemId/status",
  comandasController.atualizarStatusItem
);

module.exports = router;