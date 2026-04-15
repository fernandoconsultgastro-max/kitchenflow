// Importação do express
const express = require('express');

// Criação do router
const router = express.Router();

// Importação do controller
const insumosController = require('../controllers/insumosController');

// Rota para listar insumos
router.get('/', insumosController.listarInsumos);

// Rota para cadastrar insumo
router.post('/', insumosController.criarInsumo);

// Rota para atualizar insumo por ID
router.put('/:id', insumosController.atualizarInsumo);

// Rota para excluir insumo por ID
router.delete('/:id', insumosController.excluirInsumo);

// Exportação das rotas
module.exports = router;