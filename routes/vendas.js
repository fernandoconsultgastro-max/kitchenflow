const express = require("express");
const router = express.Router();

const vendasController = require("../controllers/vendasController");

// ===============================
// ROTAS DE VENDAS
// IMPORTANTE:
// rotas específicas devem vir antes
// das rotas dinâmicas como /:id
// ===============================

// -------------------------------
// RESUMO GERENCIAL
// GET /vendas/resumo
// -------------------------------
router.get("/resumo", vendasController.resumoVendas);

// -------------------------------
// CAMADA 2
// CMV POR PRATO
// GET /vendas/cmvs
// -------------------------------
router.get("/cmvs", vendasController.cmvsPorPrato);

// ===============================
// [KF-BE-027.1] ROTA CMV REAL
// ===============================
router.post("/cmv-real", vendasController.cmvRealPorPrato);

// -------------------------------
// SIMULAR VENDA
// POST /vendas/simular
// -------------------------------
router.post("/simular", vendasController.simularVenda);

// -------------------------------
// LISTAR TODAS AS VENDAS
// GET /vendas
// -------------------------------
router.get("/", vendasController.listarVendas);

// -------------------------------
// REGISTRAR NOVA VENDA
// POST /vendas
// -------------------------------
router.post("/", vendasController.criarVenda);

// -------------------------------
// DETALHAR VENDA
// GET /vendas/:id
// -------------------------------
router.get("/resumo-avancado", vendasController.resumoAvancado);
router.get("/:id", vendasController.detalharVenda);

module.exports = router;