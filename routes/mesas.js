const express = require("express");
const router = express.Router();

const mesasController = require("../controllers/mesasController");

// ======================================
// ROTAS DE MESAS
// IMPORTANTE:
// rotas específicas antes das dinâmicas
// ======================================

// --------------------------------------
// CRIAR MESA
// POST /mesas
// body:
// {
//   numero,
//   descricao,
//   lugares,
//   status
// }
// --------------------------------------
router.post("/", mesasController.criarMesa);

// --------------------------------------
// LISTAR MESAS
// GET /mesas
// query opcional:
// ?status=livre
// --------------------------------------
router.get("/", mesasController.listarMesas);

// --------------------------------------
// DETALHAR MESA
// GET /mesas/:id
// --------------------------------------
router.get("/:id", mesasController.detalharMesa);

// --------------------------------------
// ATUALIZAR MESA COMPLETA
// PATCH /mesas/:id
// body:
// {
//   numero,
//   descricao,
//   lugares,
//   status
// }
// --------------------------------------
router.patch("/:id", mesasController.atualizarMesa);

// --------------------------------------
// ATUALIZAR STATUS DA MESA
// PATCH /mesas/:id/status
// body:
// {
//   status
// }
// --------------------------------------
router.patch("/:id/status", mesasController.atualizarStatusMesa);

// --------------------------------------
// EXCLUIR MESA
// DELETE /mesas/:id
// --------------------------------------
router.delete("/:id", mesasController.excluirMesa);

module.exports = router;