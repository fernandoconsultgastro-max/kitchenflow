const db = require("../database");
const vendasHelpers = require("./vendasController")._helpers;

// ======================================
// HELPERS SQLITE
// ======================================
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// ======================================
// HELPERS DE DISPONIBILIDADE
// ======================================
async function analisarDisponibilidadePrato(pratoId, quantidadeDesejada = 1) {
  const prato = await vendasHelpers.buscarPratoPorId(Number(pratoId));

  if (!prato) {
    return {
      disponivel: false,
      motivo: "Prato não encontrado.",
      prato: null,
      ficha: null,
      itens_ficha: [],
      estoque_insuficiente: [],
    };
  }

  if (!prato.ficha_id) {
    return {
      disponivel: false,
      motivo: "Prato sem ficha técnica vinculada.",
      prato,
      ficha: null,
      itens_ficha: [],
      estoque_insuficiente: [],
    };
  }

  const itensFicha = await vendasHelpers.buscarItensDaFicha(Number(prato.ficha_id));

  if (!itensFicha.length) {
    return {
      disponivel: false,
      motivo: "A ficha técnica do prato não possui itens.",
      prato,
      ficha: { id: prato.ficha_id, nome: prato.ficha_nome || "" },
      itens_ficha: [],
      estoque_insuficiente: [],
    };
  }

  const itensConsumo = vendasHelpers.calcularConsumoDaVenda(
    itensFicha,
    Number(quantidadeDesejada)
  );

  const validacao = vendasHelpers.validarEstoqueConsumo(itensConsumo);

  if (!validacao.ok) {
    return {
      disponivel: false,
      motivo: "Estoque insuficiente para este prato.",
      prato,
      ficha: { id: prato.ficha_id, nome: prato.ficha_nome || "" },
      itens_ficha: itensConsumo,
      estoque_insuficiente: validacao.insuficientes,
    };
  }

  return {
    disponivel: true,
    motivo: "Prato disponível para venda.",
    prato,
    ficha: { id: prato.ficha_id, nome: prato.ficha_nome || "" },
    itens_ficha: itensConsumo,
    estoque_insuficiente: [],
  };
}

// ======================================
// CRIAR PRATO
// ======================================
const criarPrato = async (req, res) => {
  try {
    const { nome, ficha_id, preco_venda, categoria = "", status = "ativo" } = req.body;

    if (!nome || String(nome).trim() === "") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O nome do prato é obrigatório.",
      });
    }

    if (!ficha_id) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "ficha_id é obrigatório.",
      });
    }

    const ficha = await getAsync(
      `
      SELECT id, nome
      FROM fichas_tecnicas
      WHERE id = ?
      `,
      [ficha_id]
    );

    if (!ficha) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Ficha técnica não encontrada.",
      });
    }

    const precoVendaNumero = Number(preco_venda);

    if (Number.isNaN(precoVendaNumero) || precoVendaNumero < 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "preco_venda deve ser um número maior ou igual a zero.",
      });
    }

    const resultado = await runAsync(
      `
      INSERT INTO pratos (nome, ficha_id, preco_venda, categoria, status)
      VALUES (?, ?, ?, ?, ?)
      `,
      [String(nome).trim(), ficha_id, precoVendaNumero, categoria, status]
    );

    const pratoCriado = await getAsync(
      `
      SELECT p.*, f.nome AS ficha_nome
      FROM pratos p
      JOIN fichas_tecnicas f ON f.id = p.ficha_id
      WHERE p.id = ?
      `,
      [resultado.lastID]
    );

    return res.status(201).json({
      sucesso: true,
      mensagem: "Prato criado com sucesso.",
      prato: pratoCriado,
    });
  } catch (err) {
    console.error("Erro ao criar prato:", err.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao criar prato.",
      erro: err.message,
    });
  }
};

// ======================================
// LISTAR PRATOS
// Agora com status operacional
// ======================================
const listarPratos = async (req, res) => {
  try {
    const sql = `
      SELECT
        p.*,
        f.nome AS ficha_nome
      FROM pratos p
      JOIN fichas_tecnicas f ON f.id = p.ficha_id
      ORDER BY p.nome ASC
    `;

    const rows = await allAsync(sql, []);

    const pratosComDisponibilidade = [];

    for (const prato of rows) {
      const analise = await analisarDisponibilidadePrato(prato.id, 1);

      pratosComDisponibilidade.push({
        ...prato,
        disponibilidade_estoque: analise.disponivel ? "disponivel" : "indisponivel",
        disponivel_para_venda: analise.disponivel,
        motivo_indisponibilidade: analise.disponivel ? "" : analise.motivo,
        estoque_insuficiente: analise.estoque_insuficiente,
      });
    }

    return res.json({
      sucesso: true,
      total: pratosComDisponibilidade.length,
      pratos: pratosComDisponibilidade,
    });
  } catch (err) {
    console.error("Erro ao listar pratos:", err.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao listar pratos.",
      erro: err.message,
    });
  }
};

// ======================================
// DETALHAR DISPONIBILIDADE DO PRATO
// GET /pratos/:id/disponibilidade?quantidade=2
// ======================================
const disponibilidadePrato = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantidade = 1 } = req.query;

    const analise = await analisarDisponibilidadePrato(id, quantidade);

    if (!analise.prato) {
      return res.status(404).json({
        sucesso: false,
        mensagem: analise.motivo,
      });
    }

    return res.json({
      sucesso: true,
      prato_id: analise.prato.id,
      nome_prato: analise.prato.nome,
      quantidade_analisada: Number(quantidade),
      disponivel_para_venda: analise.disponivel,
      motivo: analise.motivo,
      estoque_insuficiente: analise.estoque_insuficiente,
      itens_ficha: analise.itens_ficha,
    });
  } catch (err) {
    console.error("Erro ao analisar disponibilidade do prato:", err.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao analisar disponibilidade do prato.",
      erro: err.message,
    });
  }
};

module.exports = {
  criarPrato,
  listarPratos,
  disponibilidadePrato,
};