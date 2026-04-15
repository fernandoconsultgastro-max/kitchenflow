const express = require("express");
const router = express.Router();

const fichasController = require("../controllers/fichasController");

// ===============================
// ROTAS DE FICHAS TÉCNICAS
// ===============================

// -------------------------------
// LISTAR TODAS AS FICHAS
// GET /fichas
// -------------------------------
router.get("/", fichasController.listarFichas);

// -------------------------------
// DETALHAR UMA FICHA ESPECÍFICA
// GET /fichas/:id
// -------------------------------
router.get("/:id", fichasController.detalharFicha);

// -------------------------------
// CRIAR NOVA FICHA TÉCNICA
// POST /fichas
// body:
// {
//   nome,
//   rendimento,
//   descricao,
//   cmv,
//   preco_praticado,
//   itens: [
//     { insumo_id, quantidade_usada }
//   ]
// }
// -------------------------------
router.post("/", fichasController.criarFicha);

// -------------------------------
// ATUALIZAR DADOS DA FICHA
// PUT /fichas/:id
// body:
// {
//   nome,
//   rendimento,
//   descricao,
//   cmv,
//   preco_praticado
// }
// -------------------------------
router.put("/:id", fichasController.atualizarFicha);

// -------------------------------
// EXCLUIR FICHA
// DELETE /fichas/:id
// -------------------------------
router.delete("/:id", fichasController.excluirFicha);

// ===============================
// ROTAS DOS ITENS DA FICHA
// ===============================

// -------------------------------
// ADICIONAR ITEM EM FICHA EXISTENTE
// POST /fichas/itens
// body:
// {
//   ficha_id,
//   insumo_id,
//   quantidade
// }
// -------------------------------
router.post("/itens", fichasController.adicionarItemFicha);

// -------------------------------
// REMOVER ITEM DA FICHA
// DELETE /fichas/itens/:id
// -------------------------------
router.delete("/itens/:id", fichasController.removerItemFicha);

module.exports = router;