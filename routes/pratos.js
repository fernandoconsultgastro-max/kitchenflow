const express = require("express");
const router = express.Router();

const controller = require("../controllers/pratosController");

// ======================================
// ROTAS DE PRATOS
// IMPORTANTE:
// rotas específicas antes das dinâmicas
// ======================================

// --------------------------------------
// CRIAR PRATO
// POST /pratos
// --------------------------------------
router.post("/", controller.criarPrato);

// --------------------------------------
// LISTAR PRATOS
// GET /pratos
// --------------------------------------
router.get("/", controller.listarPratos);

// --------------------------------------
// ANALISAR DISPONIBILIDADE DO PRATO
// GET /pratos/:id/disponibilidade?quantidade=2
// --------------------------------------
router.get("/:id/disponibilidade", controller.disponibilidadePrato);

module.exports = router;