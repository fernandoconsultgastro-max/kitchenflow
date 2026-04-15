const express = require("express");
const router = express.Router();

const movimentacoesController = require("../controllers/movimentacoesController");

// ===============================
// ROTAS DE ESTOQUE
// ===============================

// Entrada (compra)
router.post("/entrada", movimentacoesController.entrada);

// Saída (uso)
router.post("/saida", movimentacoesController.saida);

// Listar movimentações
router.get("/", movimentacoesController.listar);

module.exports = router;