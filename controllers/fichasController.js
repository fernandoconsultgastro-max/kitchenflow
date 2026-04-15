const db = require("../database");

// ===============================
// HELPERS DE BANCO
// ===============================
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// ===============================
// CALCULAR CUSTO TOTAL DA FICHA
// ===============================
async function calcularCustoTotalFicha(fichaId) {
  const itens = await allAsync(
    `
    SELECT
      fi.id,
      fi.quantidade,
      i.id AS insumo_id,
      i.nome AS insumo_nome,
      i.unidade,
      i.quantidade AS quantidade_compra,
      i.custo AS custo_compra
    FROM fichas_tecnicas_itens fi
    INNER JOIN insumos i ON i.id = fi.insumo_id
    WHERE fi.ficha_id = ?
    `,
    [fichaId]
  );

  let custoTotal = 0;

  for (const item of itens) {
    const quantidadeCompra = Number(item.quantidade_compra || 0);
    const custoCompra = Number(item.custo_compra || 0);
    const quantidadeUsada = Number(item.quantidade || 0);

    const custoUnitario = quantidadeCompra > 0 ? custoCompra / quantidadeCompra : 0;
    const custoItem = custoUnitario * quantidadeUsada;

    custoTotal += custoItem;
  }

  return custoTotal;
}

// ===============================
// CALCULAR PREÇO SUGERIDO
// ===============================
function calcularPrecoSugerido(custoTotal, cmv) {
  const cmvNumero = Number(cmv || 0);

  if (!cmvNumero || cmvNumero <= 0) {
    return 0;
  }

  return custoTotal / (cmvNumero / 100);
}

// ===============================
// CRIAR FICHA TÉCNICA
// ===============================
exports.criarFicha = async (req, res) => {
  try {
    const {
      nome,
      rendimento,
      descricao,
      cmv,
      preco_praticado,
      itens
    } = req.body;

    if (!nome || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({
        erro: "Nome da ficha e itens são obrigatórios"
      });
    }

    // cria o cabeçalho da ficha
    const resultadoFicha = await runAsync(
      `
      INSERT INTO fichas_tecnicas
      (nome, rendimento, descricao, cmv, preco_sugerido, preco_praticado)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        nome,
        Number(rendimento || 0),
        descricao || "",
        Number(cmv || 0),
        0,
        Number(preco_praticado || 0)
      ]
    );

    const fichaId = resultadoFicha.lastID;

    // insere os itens da ficha
    for (const item of itens) {
      if (!item.insumo_id || !item.quantidade_usada) {
        continue;
      }

      await runAsync(
        `
        INSERT INTO fichas_tecnicas_itens
        (ficha_id, insumo_id, quantidade)
        VALUES (?, ?, ?)
        `,
        [
          fichaId,
          Number(item.insumo_id),
          Number(item.quantidade_usada)
        ]
      );
    }

    // calcula custo e preço sugerido reais
    const custoTotal = await calcularCustoTotalFicha(fichaId);
    const precoSugerido = calcularPrecoSugerido(custoTotal, Number(cmv || 0));

    await runAsync(
      `
      UPDATE fichas_tecnicas
      SET preco_sugerido = ?
      WHERE id = ?
      `,
      [precoSugerido, fichaId]
    );

    res.status(201).json({
      mensagem: "Ficha criada com sucesso",
      ficha_id: fichaId,
      custo_total: custoTotal,
      preco_sugerido: precoSugerido
    });
  } catch (error) {
    console.error("Erro ao criar ficha:", error.message);
    res.status(500).json({
      erro: "Erro ao criar ficha técnica"
    });
  }
};

// ===============================
// LISTAR FICHAS TÉCNICAS
// ===============================
exports.listarFichas = async (req, res) => {
  try {
    const fichas = await allAsync(
      `
      SELECT
        id,
        nome,
        rendimento,
        descricao,
        cmv,
        preco_sugerido,
        preco_praticado
      FROM fichas_tecnicas
      ORDER BY id DESC
      `
    );

    const fichasComCusto = [];

    for (const ficha of fichas) {
      const custoTotal = await calcularCustoTotalFicha(ficha.id);

      fichasComCusto.push({
        ...ficha,
        custo: custoTotal
      });
    }

    res.json(fichasComCusto);
  } catch (error) {
    console.error("Erro ao listar fichas:", error.message);
    res.status(500).json({
      erro: "Erro ao listar fichas técnicas"
    });
  }
};

// ===============================
// DETALHAR UMA FICHA
// ===============================
exports.detalharFicha = async (req, res) => {
  try {
    const { id } = req.params;

    const ficha = await getAsync(
      `
      SELECT
        id,
        nome,
        rendimento,
        descricao,
        cmv,
        preco_sugerido,
        preco_praticado
      FROM fichas_tecnicas
      WHERE id = ?
      `,
      [id]
    );

    if (!ficha) {
      return res.status(404).json({
        erro: "Ficha não encontrada"
      });
    }

    const itens = await allAsync(
      `
      SELECT
        fi.id,
        fi.ficha_id,
        fi.insumo_id,
        fi.quantidade,
        i.nome AS insumo_nome,
        i.unidade,
        i.quantidade AS quantidade_compra,
        i.custo AS custo_compra,
        i.categoria
      FROM fichas_tecnicas_itens fi
      INNER JOIN insumos i ON i.id = fi.insumo_id
      WHERE fi.ficha_id = ?
      ORDER BY fi.id ASC
      `,
      [id]
    );

    const itensCalculados = itens.map((item) => {
      const quantidadeCompra = Number(item.quantidade_compra || 0);
      const custoCompra = Number(item.custo_compra || 0);
      const quantidadeUsada = Number(item.quantidade || 0);

      const custoUnitario = quantidadeCompra > 0 ? custoCompra / quantidadeCompra : 0;
      const custoItem = custoUnitario * quantidadeUsada;

      return {
        ...item,
        custo_unitario: custoUnitario,
        custo_item: custoItem
      };
    });

    const custoTotal = itensCalculados.reduce((acc, item) => {
      return acc + Number(item.custo_item || 0);
    }, 0);

    res.json({
      ...ficha,
      custo: custoTotal,
      itens: itensCalculados
    });
  } catch (error) {
    console.error("Erro ao detalhar ficha:", error.message);
    res.status(500).json({
      erro: "Erro ao buscar ficha técnica"
    });
  }
};

// ===============================
// ADICIONAR ITEM EM FICHA EXISTENTE
// ===============================
exports.adicionarItemFicha = async (req, res) => {
  try {
    const { ficha_id, insumo_id, quantidade } = req.body;

    if (!ficha_id || !insumo_id || !quantidade) {
      return res.status(400).json({
        erro: "ficha_id, insumo_id e quantidade são obrigatórios"
      });
    }

    const ficha = await getAsync(
      `SELECT id, cmv FROM fichas_tecnicas WHERE id = ?`,
      [ficha_id]
    );

    if (!ficha) {
      return res.status(404).json({
        erro: "Ficha não encontrada"
      });
    }

    const insumo = await getAsync(
      `SELECT id FROM insumos WHERE id = ?`,
      [insumo_id]
    );

    if (!insumo) {
      return res.status(404).json({
        erro: "Insumo não encontrado"
      });
    }

    await runAsync(
      `
      INSERT INTO fichas_tecnicas_itens
      (ficha_id, insumo_id, quantidade)
      VALUES (?, ?, ?)
      `,
      [Number(ficha_id), Number(insumo_id), Number(quantidade)]
    );

    const custoTotal = await calcularCustoTotalFicha(Number(ficha_id));
    const precoSugerido = calcularPrecoSugerido(custoTotal, ficha.cmv);

    await runAsync(
      `
      UPDATE fichas_tecnicas
      SET preco_sugerido = ?
      WHERE id = ?
      `,
      [precoSugerido, Number(ficha_id)]
    );

    res.json({
      mensagem: "Item adicionado com sucesso",
      custo_total: custoTotal,
      preco_sugerido: precoSugerido
    });
  } catch (error) {
    console.error("Erro ao adicionar item na ficha:", error.message);
    res.status(500).json({
      erro: "Erro ao adicionar item à ficha"
    });
  }
};

// ===============================
// REMOVER ITEM DA FICHA
// ===============================
exports.removerItemFicha = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await getAsync(
      `
      SELECT id, ficha_id
      FROM fichas_tecnicas_itens
      WHERE id = ?
      `,
      [id]
    );

    if (!item) {
      return res.status(404).json({
        erro: "Item da ficha não encontrado"
      });
    }

    await runAsync(
      `
      DELETE FROM fichas_tecnicas_itens
      WHERE id = ?
      `,
      [id]
    );

    const ficha = await getAsync(
      `
      SELECT id, cmv
      FROM fichas_tecnicas
      WHERE id = ?
      `,
      [item.ficha_id]
    );

    const custoTotal = await calcularCustoTotalFicha(Number(item.ficha_id));
    const precoSugerido = calcularPrecoSugerido(custoTotal, ficha ? ficha.cmv : 0);

    await runAsync(
      `
      UPDATE fichas_tecnicas
      SET preco_sugerido = ?
      WHERE id = ?
      `,
      [precoSugerido, Number(item.ficha_id)]
    );

    res.json({
      mensagem: "Item removido com sucesso",
      custo_total: custoTotal,
      preco_sugerido: precoSugerido
    });
  } catch (error) {
    console.error("Erro ao remover item da ficha:", error.message);
    res.status(500).json({
      erro: "Erro ao remover item da ficha"
    });
  }
};

// ===============================
// ATUALIZAR DADOS DA FICHA
// ===============================
exports.atualizarFicha = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      rendimento,
      descricao,
      cmv,
      preco_praticado
    } = req.body;

    const ficha = await getAsync(
      `SELECT id FROM fichas_tecnicas WHERE id = ?`,
      [id]
    );

    if (!ficha) {
      return res.status(404).json({
        erro: "Ficha não encontrada"
      });
    }

    await runAsync(
      `
      UPDATE fichas_tecnicas
      SET
        nome = ?,
        rendimento = ?,
        descricao = ?,
        cmv = ?,
        preco_praticado = ?
      WHERE id = ?
      `,
      [
        nome,
        Number(rendimento || 0),
        descricao || "",
        Number(cmv || 0),
        Number(preco_praticado || 0),
        Number(id)
      ]
    );

    const custoTotal = await calcularCustoTotalFicha(Number(id));
    const precoSugerido = calcularPrecoSugerido(custoTotal, Number(cmv || 0));

    await runAsync(
      `
      UPDATE fichas_tecnicas
      SET preco_sugerido = ?
      WHERE id = ?
      `,
      [precoSugerido, Number(id)]
    );

    res.json({
      mensagem: "Ficha atualizada com sucesso",
      custo_total: custoTotal,
      preco_sugerido: precoSugerido
    });
  } catch (error) {
    console.error("Erro ao atualizar ficha:", error.message);
    res.status(500).json({
      erro: "Erro ao atualizar ficha técnica"
    });
  }
};

// ===============================
// EXCLUIR FICHA
// ===============================
exports.excluirFicha = async (req, res) => {
  try {
    const { id } = req.params;

    const ficha = await getAsync(
      `SELECT id FROM fichas_tecnicas WHERE id = ?`,
      [id]
    );

    if (!ficha) {
      return res.status(404).json({
        erro: "Ficha não encontrada"
      });
    }

    await runAsync(
      `DELETE FROM fichas_tecnicas_itens WHERE ficha_id = ?`,
      [id]
    );

    await runAsync(
      `DELETE FROM fichas_tecnicas WHERE id = ?`,
      [id]
    );

    res.json({
      mensagem: "Ficha excluída com sucesso"
    });
  } catch (error) {
    console.error("Erro ao excluir ficha:", error.message);
    res.status(500).json({
      erro: "Erro ao excluir ficha técnica"
    });
  }
};

// ===============================
// EXPORTAR HELPERS, SE PRECISAR
// ===============================
exports._helpers = {
  calcularCustoTotalFicha,
  calcularPrecoSugerido
};