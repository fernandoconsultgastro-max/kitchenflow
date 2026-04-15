const db = require("../database");
const vendasHelpers = require("./vendasController")._helpers;

// ======================================
// HELPERS SQLITE
// ======================================
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

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

// ======================================
// HELPERS DE NEGÓCIO
// ======================================
function gerarCodigoComanda() {
  const agora = new Date();

  const ano = agora.getFullYear().toString().slice(-2);
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");

  return `COM-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
}

async function recalcularTotaisComanda(comandaId) {
  const soma = await getAsync(
    `
      SELECT
        COALESCE(SUM(total_item), 0) AS subtotal
      FROM comandas_itens
      WHERE comanda_id = ?
        AND status_item != 'cancelado'
    `,
    [comandaId]
  );

  const comandaAtual = await getAsync(
    `
      SELECT desconto, taxa_servico
      FROM comandas
      WHERE id = ?
    `,
    [comandaId]
  );

  const subtotal = Number(soma?.subtotal || 0);
  const desconto = Number(comandaAtual?.desconto || 0);
  const taxaServico = Number(comandaAtual?.taxa_servico || 0);

  const totalBase = subtotal - desconto;
  const total = totalBase + taxaServico < 0 ? 0 : totalBase + taxaServico;

  await runAsync(
    `
      UPDATE comandas
      SET subtotal = ?, total = ?
      WHERE id = ?
    `,
    [subtotal, total, comandaId]
  );

  return {
    subtotal,
    desconto,
    taxa_servico: taxaServico,
    total,
  };
}

async function buscarComandaPorId(comandaId) {
  return await getAsync(
    `
      SELECT
        c.*,
        m.numero AS mesa_numero,
        m.status AS mesa_status
      FROM comandas c
      LEFT JOIN mesas m ON m.id = c.mesa_id
      WHERE c.id = ?
    `,
    [comandaId]
  );
}

// ======================================
// NOVO HELPER
// CONVERTER COMANDA EM VENDA REAL
// MODELO PROFISSIONAL:
// 1 comanda = 1 venda consolidada
// ======================================
async function converterComandaEmVenda(comandaId, pagamentos = [], taxaServicoInformada = null) {
  const comanda = await getAsync(
    `
      SELECT *
      FROM comandas
      WHERE id = ?
    `,
    [comandaId]
  );

  if (!comanda) {
    throw new Error("Comanda não encontrada.");
  }

  const itens = await allAsync(
    `
      SELECT *
      FROM comandas_itens
      WHERE comanda_id = ?
        AND status_item != 'cancelado'
      ORDER BY id ASC
    `,
    [comandaId]
  );

  if (!itens.length) {
    throw new Error("Comanda sem itens válidos para conversão em venda.");
  }

  const taxaServico =
    taxaServicoInformada !== null && taxaServicoInformada !== undefined
      ? Number(taxaServicoInformada || 0)
      : Number(comanda.taxa_servico || 0);

  const subtotal = Number(comanda.subtotal || 0);
  const desconto = Number(comanda.desconto || 0);
  const totalFinal = Number(subtotal - desconto + taxaServico);
  const totalPagamento = pagamentos.reduce(
    (acc, pagamento) => acc + Number(pagamento.valor || 0),
    0
  );

  if (pagamentos.length > 0 && totalPagamento < totalFinal) {
    throw new Error(
      `Pagamentos insuficientes. Total da comanda: R$ ${totalFinal.toFixed(2)}`
    );
  }

  const itensResumoVenda = [];
  const itensBaixaEstoque = [];

  let custoTotalGeral = 0;

  for (const item of itens) {
    const prato = await vendasHelpers.buscarPratoPorId(Number(item.prato_id));

    if (!prato) {
      throw new Error(`Prato não encontrado na comanda: ${item.nome_prato}`);
    }

    if (!prato.ficha_id) {
      throw new Error(
        `O prato ${item.nome_prato} não possui ficha técnica vinculada.`
      );
    }

    const itensFicha = await vendasHelpers.buscarItensDaFicha(Number(prato.ficha_id));

    if (!itensFicha.length) {
      throw new Error(
        `A ficha técnica do prato ${item.nome_prato} não possui itens.`
      );
    }

    const itensConsumo = vendasHelpers.calcularConsumoDaVenda(
      itensFicha,
      Number(item.quantidade)
    );

    const validacao = vendasHelpers.validarEstoqueConsumo(itensConsumo);

    if (!validacao.ok) {
      throw new Error(
        `Estoque insuficiente para concluir a comanda no prato ${item.nome_prato}.`
      );
    }

    const resumo = vendasHelpers.montarResumoVenda({
      prato,
      quantidade: Number(item.quantidade),
      precoUnitario: Number(item.preco_unitario),
      itensConsumo,
    });

    custoTotalGeral += Number(resumo.custo_total || 0);

    itensResumoVenda.push({
      prato_id: Number(item.prato_id),
      ficha_id: Number(item.ficha_id || prato.ficha_id || null),
      nome_prato: item.nome_prato,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
      total_item: Number(item.total_item || 0),
    });

    for (const insumo of resumo.itens) {
      itensBaixaEstoque.push({
        prato_nome: item.nome_prato,
        insumo_id: insumo.insumo_id,
        nome_insumo: insumo.nome_insumo,
        quantidade_baixada: Number(insumo.quantidade_baixada || 0),
        unidade: insumo.unidade || "",
        custo_unitario: Number(insumo.custo_unitario || 0),
        custo_total_item: Number(insumo.custo_total_item || 0),
      });
    }
  }

  const cmvTotal = Number(custoTotalGeral.toFixed(2));
  const lucroBruto = Number((totalFinal - cmvTotal).toFixed(2));

  await runAsync("BEGIN TRANSACTION");

  try {
    const resultadoVenda = await runAsync(
      `
        INSERT INTO vendas (
          comanda_id,
          subtotal,
          desconto,
          taxa_servico,
          total,
          cmv_total,
          lucro_bruto,
          observacao,
          data,
          faturamento_total,
          custo_total,
          cmv_percentual
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
      `,
      [
        comandaId,
        subtotal,
        desconto,
        taxaServico,
        totalFinal,
        cmvTotal,
        lucroBruto,
        `Gerado automaticamente pela comanda ${comanda.codigo}`,
        totalFinal,
        cmvTotal,
        totalFinal > 0 ? Number(((cmvTotal / totalFinal) * 100).toFixed(2)) : 0,
      ]
    );

    const vendaId = resultadoVenda.lastID;

    // ======================================
    // ITENS COMERCIAIS DA VENDA
    // ======================================
    for (const item of itensResumoVenda) {
      await runAsync(
        `
          INSERT INTO vendas_itens (
            venda_id,
            prato_id,
            ficha_id,
            nome_prato,
            quantidade,
            preco_unitario,
            total_item
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          vendaId,
          item.prato_id,
          item.ficha_id,
          item.nome_prato,
          item.quantidade,
          item.preco_unitario,
          item.total_item,
        ]
      );
    }

    // ======================================
    // ITENS DE BAIXA DE ESTOQUE
    // Mantido por compatibilidade com legado
    // ======================================
    for (const insumo of itensBaixaEstoque) {
      await runAsync(
        `
          INSERT INTO vendas_itens (
            venda_id,
            insumo_id,
            nome_insumo,
            quantidade_baixada,
            unidade,
            custo_unitario,
            custo_total_item
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          vendaId,
          insumo.insumo_id,
          insumo.nome_insumo,
          insumo.quantidade_baixada,
          insumo.unidade,
          insumo.custo_unitario,
          insumo.custo_total_item,
        ]
      );
    }

    // ======================================
    // BAIXA REAL DE ESTOQUE
    // ======================================
    for (const insumo of itensBaixaEstoque) {
      await runAsync(
        `
          UPDATE insumos
          SET quantidade = quantidade - ?
          WHERE id = ?
        `,
        [insumo.quantidade_baixada, insumo.insumo_id]
      );

      await runAsync(
        `
          INSERT INTO movimentacoes (
            insumo_id,
            tipo,
            quantidade,
            origem,
            referencia_id,
            observacao
          )
          VALUES (?, 'saida', ?, 'comanda', ?, ?)
        `,
        [
          insumo.insumo_id,
          insumo.quantidade_baixada,
          vendaId,
          `Baixa automática via fechamento da comanda ${comanda.codigo} - prato ${insumo.prato_nome}`,
        ]
      );
    }

    // ======================================
    // PAGAMENTOS
    // ======================================
    for (const pagamento of pagamentos) {
      await runAsync(
        `
          INSERT INTO pagamentos (
            venda_id,
            comanda_id,
            metodo,
            valor
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          vendaId,
          comandaId,
          String(pagamento.metodo || "").trim().toLowerCase(),
          Number(pagamento.valor || 0),
        ]
      );
    }

    await runAsync("COMMIT");

    return {
      venda_id: vendaId,
      subtotal,
      desconto,
      taxa_servico: taxaServico,
      total: totalFinal,
      cmv_total: cmvTotal,
      lucro_bruto: lucroBruto,
      troco: Number((totalPagamento - totalFinal).toFixed(2)),
    };
  } catch (error) {
    await runAsync("ROLLBACK");
    throw error;
  }
}

// ======================================
// CONTROLLER
// ======================================

// --------------------------------------
// POST /comandas
// Abrir nova comanda
// body:
// {
//   mesa_id,
//   cliente_nome,
//   origem,
//   observacao
// }
// --------------------------------------
async function abrirComanda(req, res) {
  try {
    const {
      mesa_id = null,
      cliente_nome = "",
      origem = "salao",
      observacao = "",
    } = req.body;

    const origensValidas = ["salao", "balcao", "retirada", "delivery"];

    if (!origensValidas.includes(origem)) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Origem inválida. Use: salao, balcao, retirada ou delivery.",
      });
    }

    if (mesa_id) {
      const mesa = await getAsync(
        `
          SELECT *
          FROM mesas
          WHERE id = ?
        `,
        [mesa_id]
      );

      if (!mesa) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Mesa não encontrada.",
        });
      }

      if (mesa.status === "inativa") {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Não é possível abrir comanda em mesa inativa.",
        });
      }

      const comandaAbertaNaMesa = await getAsync(
        `
          SELECT *
          FROM comandas
          WHERE mesa_id = ?
            AND status = 'aberta'
          ORDER BY id DESC
          LIMIT 1
        `,
        [mesa_id]
      );

      if (comandaAbertaNaMesa) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Já existe uma comanda aberta para esta mesa.",
          comanda_existente: comandaAbertaNaMesa,
        });
      }
    }

    const codigo = gerarCodigoComanda();

    const resultado = await runAsync(
      `
        INSERT INTO comandas (
          mesa_id,
          codigo,
          cliente_nome,
          origem,
          status,
          observacao,
          subtotal,
          desconto,
          taxa_servico,
          total
        )
        VALUES (?, ?, ?, ?, 'aberta', ?, 0, 0, 0, 0)
      `,
      [mesa_id, codigo, cliente_nome, origem, observacao]
    );

    if (mesa_id) {
      await runAsync(
        `
          UPDATE mesas
          SET status = 'ocupada'
          WHERE id = ?
        `,
        [mesa_id]
      );
    }

    const novaComanda = await buscarComandaPorId(resultado.lastID);

    return res.status(201).json({
      sucesso: true,
      mensagem: "Comanda aberta com sucesso.",
      comanda: novaComanda,
    });
  } catch (error) {
    console.error("Erro ao abrir comanda:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao abrir comanda.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// GET /comandas
// Listar comandas
// query:
// status=aberta|fechada|cancelada
// origem=salao|balcao|retirada|delivery
// --------------------------------------
async function listarComandas(req, res) {
  try {
    const { status, origem } = req.query;

    let sql = `
      SELECT
        c.*,
        m.numero AS mesa_numero,
        m.status AS mesa_status
      FROM comandas c
      LEFT JOIN mesas m ON m.id = c.mesa_id
      WHERE 1 = 1
    `;

    const params = [];

    if (status) {
      sql += ` AND c.status = ? `;
      params.push(status);
    }

    if (origem) {
      sql += ` AND c.origem = ? `;
      params.push(origem);
    }

    sql += ` ORDER BY c.id DESC `;

    const comandas = await allAsync(sql, params);

    return res.json({
      sucesso: true,
      total: comandas.length,
      comandas,
    });
  } catch (error) {
    console.error("Erro ao listar comandas:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao listar comandas.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// GET /comandas/:id
// Buscar comanda por id
// --------------------------------------
async function detalharComanda(req, res) {
  try {
    const { id } = req.params;

    const comanda = await buscarComandaPorId(id);

    if (!comanda) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Comanda não encontrada.",
      });
    }

    const itens = await allAsync(
      `
        SELECT
          ci.*,
          p.categoria AS prato_categoria,
          p.status AS prato_status
        FROM comandas_itens ci
        LEFT JOIN pratos p ON p.id = ci.prato_id
        WHERE ci.comanda_id = ?
        ORDER BY ci.id ASC
      `,
      [id]
    );

    const pagamentos = await allAsync(
      `
        SELECT *
        FROM pagamentos
        WHERE comanda_id = ?
        ORDER BY id ASC
      `,
      [id]
    );

    return res.json({
      sucesso: true,
      comanda,
      itens,
      pagamentos,
    });
  } catch (error) {
    console.error("Erro ao detalhar comanda:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao detalhar comanda.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// POST /comandas/:id/itens
// Adicionar item à comanda
// body:
// {
//   prato_id,
//   quantidade,
//   observacao
// }
// --------------------------------------
async function adicionarItemComanda(req, res) {
  try {
    const { id } = req.params;
    const { prato_id, quantidade = 1, observacao = "" } = req.body;

    if (!prato_id) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "prato_id é obrigatório.",
      });
    }

    const quantidadeNumero = Number(quantidade);

    if (!quantidadeNumero || quantidadeNumero <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A quantidade deve ser maior que zero.",
      });
    }

    const comanda = await getAsync(
      `
        SELECT *
        FROM comandas
        WHERE id = ?
      `,
      [id]
    );

    if (!comanda) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Comanda não encontrada.",
      });
    }

    if (comanda.status !== "aberta") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Só é possível adicionar itens em comandas abertas.",
      });
    }

    const prato = await getAsync(
      `
        SELECT
          p.*,
          f.id AS ficha_id,
          f.nome AS ficha_nome
        FROM pratos p
        LEFT JOIN fichas_tecnicas f ON f.id = p.ficha_id
        WHERE p.id = ?
      `,
      [prato_id]
    );

    if (!prato) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Prato não encontrado.",
      });
    }

    if (prato.status && prato.status.toLowerCase() === "inativo") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Este prato está inativo.",
      });
    }

    if (!prato.ficha_id) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `O prato ${prato.nome} não possui ficha técnica vinculada.`,
      });
    }

    const itensFicha = await vendasHelpers.buscarItensDaFicha(
      Number(prato.ficha_id)
    );

    if (!itensFicha.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `A ficha técnica do prato ${prato.nome} não possui itens.`,
      });
    }

    const itensConsumo = vendasHelpers.calcularConsumoDaVenda(
      itensFicha,
      quantidadeNumero
    );

    const validacao = vendasHelpers.validarEstoqueConsumo(itensConsumo);

    if (!validacao.ok) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Estoque insuficiente para o prato ${prato.nome}.`,
        estoque_insuficiente: validacao.insuficientes,
      });
    }

    const precoUnitario = Number(prato.preco_venda || 0);
    const totalItem = precoUnitario * quantidadeNumero;

    const resultado = await runAsync(
      `
        INSERT INTO comandas_itens (
          comanda_id,
          prato_id,
          ficha_id,
          nome_prato,
          quantidade,
          preco_unitario,
          total_item,
          observacao,
          status_item
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
      `,
      [
        id,
        prato.id,
        prato.ficha_id || null,
        prato.nome,
        quantidadeNumero,
        precoUnitario,
        totalItem,
        observacao,
      ]
    );

    const totais = await recalcularTotaisComanda(id);

    const itemCriado = await getAsync(
      `
        SELECT *
        FROM comandas_itens
        WHERE id = ?
      `,
      [resultado.lastID]
    );

    return res.status(201).json({
      sucesso: true,
      mensagem: "Item adicionado à comanda com sucesso.",
      item: itemCriado,
      totais,
    });
  } catch (error) {
    console.error("Erro ao adicionar item na comanda:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao adicionar item na comanda.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// GET /comandas/:id/itens
// Listar itens da comanda
// --------------------------------------
async function listarItensComanda(req, res) {
  try {
    const { id } = req.params;

    const comanda = await getAsync(
      `
        SELECT *
        FROM comandas
        WHERE id = ?
      `,
      [id]
    );

    if (!comanda) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Comanda não encontrada.",
      });
    }

    const itens = await allAsync(
      `
        SELECT
          ci.*,
          p.categoria AS prato_categoria,
          p.status AS prato_status
        FROM comandas_itens ci
        LEFT JOIN pratos p ON p.id = ci.prato_id
        WHERE ci.comanda_id = ?
        ORDER BY ci.id ASC
      `,
      [id]
    );

    return res.json({
      sucesso: true,
      total: itens.length,
      itens,
    });
  } catch (error) {
    console.error("Erro ao listar itens da comanda:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao listar itens da comanda.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// PATCH /comandas/itens/:itemId/status
// body:
// {
//   status_item
// }
// status_item:
// pendente | em_preparo | pronto | entregue | cancelado
// --------------------------------------
async function atualizarStatusItem(req, res) {
  try {
    const { itemId } = req.params;
    const { status_item } = req.body;

    const statusValidos = [
      "pendente",
      "em_preparo",
      "pronto",
      "entregue",
      "cancelado",
    ];

    if (!status_item || !statusValidos.includes(status_item)) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Status inválido. Use: pendente, em_preparo, pronto, entregue ou cancelado.",
      });
    }

    const item = await getAsync(
      `
        SELECT *
        FROM comandas_itens
        WHERE id = ?
      `,
      [itemId]
    );

    if (!item) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Item da comanda não encontrado.",
      });
    }

    const comanda = await getAsync(
      `
        SELECT *
        FROM comandas
        WHERE id = ?
      `,
      [item.comanda_id]
    );

    if (!comanda) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Comanda vinculada não encontrada.",
      });
    }

    if (comanda.status !== "aberta") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Só é possível alterar itens de comandas abertas.",
      });
    }

    await runAsync(
      `
        UPDATE comandas_itens
        SET status_item = ?
        WHERE id = ?
      `,
      [status_item, itemId]
    );

    const totais = await recalcularTotaisComanda(item.comanda_id);

    const itemAtualizado = await getAsync(
      `
        SELECT *
        FROM comandas_itens
        WHERE id = ?
      `,
      [itemId]
    );

    return res.json({
      sucesso: true,
      mensagem: "Status do item atualizado com sucesso.",
      item: itemAtualizado,
      totais,
    });
  } catch (error) {
    console.error("Erro ao atualizar status do item:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar status do item.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// PATCH /comandas/:id/desconto
// body:
// {
//   desconto
// }
// --------------------------------------
async function aplicarDescontoComanda(req, res) {
  try {
    const { id } = req.params;
    const { desconto = 0 } = req.body;

    const valorDesconto = Number(desconto);

    if (Number.isNaN(valorDesconto) || valorDesconto < 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O desconto deve ser um número maior ou igual a zero.",
      });
    }

    const comanda = await getAsync(
      `
        SELECT *
        FROM comandas
        WHERE id = ?
      `,
      [id]
    );

    if (!comanda) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Comanda não encontrada.",
      });
    }

    if (comanda.status !== "aberta") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Só é possível aplicar desconto em comandas abertas.",
      });
    }

    await runAsync(
      `
        UPDATE comandas
        SET desconto = ?
        WHERE id = ?
      `,
      [valorDesconto, id]
    );

    const totais = await recalcularTotaisComanda(id);
    const comandaAtualizada = await buscarComandaPorId(id);

    return res.json({
      sucesso: true,
      mensagem: "Desconto aplicado com sucesso.",
      comanda: comandaAtualizada,
      totais,
    });
  } catch (error) {
    console.error("Erro ao aplicar desconto na comanda:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao aplicar desconto na comanda.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// PATCH /comandas/:id/fechar
// body:
// {
//   taxa_servico,
//   pagamentos: [
//     { metodo: "pix", valor: 50 },
//     { metodo: "cartao", valor: 50 }
//   ]
// }
// Fecha a comanda operacionalmente
// Agora converte em venda real consolidada.
// --------------------------------------
async function fecharComanda(req, res) {
  try {
    const { id } = req.params;
    const { taxa_servico = 0, pagamentos = [] } = req.body;

    const comanda = await getAsync(
      `
        SELECT *
        FROM comandas
        WHERE id = ?
      `,
      [id]
    );

    if (!comanda) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Comanda não encontrada.",
      });
    }

    if (comanda.status !== "aberta") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A comanda já não está aberta.",
      });
    }

    const itens = await allAsync(
      `
        SELECT *
        FROM comandas_itens
        WHERE comanda_id = ?
      `,
      [id]
    );

    if (!itens.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Não é possível fechar uma comanda sem itens.",
      });
    }

    const itensValidos = itens.filter((item) => item.status_item !== "cancelado");

    if (!itensValidos.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Não é possível fechar a comanda porque todos os itens foram cancelados.",
      });
    }

    const taxaServicoNumero = Number(taxa_servico || 0);

    if (Number.isNaN(taxaServicoNumero) || taxaServicoNumero < 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A taxa de serviço deve ser um número maior ou igual a zero.",
      });
    }

    if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe ao menos um pagamento para fechar a comanda.",
      });
    }

    const metodosValidos = ["dinheiro", "pix", "cartao"];

    for (const pagamento of pagamentos) {
      const metodo = String(pagamento.metodo || "").trim().toLowerCase();
      const valor = Number(pagamento.valor || 0);

      if (!metodosValidos.includes(metodo)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Método de pagamento inválido. Use: dinheiro, pix ou cartao.",
        });
      }

      if (Number.isNaN(valor) || valor <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Os valores de pagamento devem ser maiores que zero.",
        });
      }
    }

    await runAsync(
      `
        UPDATE comandas
        SET taxa_servico = ?
        WHERE id = ?
      `,
      [taxaServicoNumero, id]
    );

    const totais = await recalcularTotaisComanda(id);

    const totalPagamentos = pagamentos.reduce(
      (acc, pagamento) => acc + Number(pagamento.valor || 0),
      0
    );

    if (totalPagamentos < Number(totais.total || 0)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Pagamentos insuficientes. Total da comanda: R$ ${Number(
          totais.total || 0
        ).toFixed(2)}`,
        totais,
      });
    }

    const vendaGerada = await converterComandaEmVenda(id, pagamentos, taxaServicoNumero);

    await runAsync(
      `
        UPDATE comandas
        SET
          status = 'fechada',
          fechada_em = CURRENT_TIMESTAMP,
          venda_id = ?,
          total = ?,
          taxa_servico = ?
        WHERE id = ?
      `,
      [
        vendaGerada.venda_id,
        Number(vendaGerada.total || 0),
        taxaServicoNumero,
        id,
      ]
    );

    if (comanda.mesa_id) {
      const outraComandaAbertaNaMesa = await getAsync(
        `
          SELECT id
          FROM comandas
          WHERE mesa_id = ?
            AND status = 'aberta'
          LIMIT 1
        `,
        [comanda.mesa_id]
      );

      if (!outraComandaAbertaNaMesa) {
        await runAsync(
          `
            UPDATE mesas
            SET status = 'livre'
            WHERE id = ?
          `,
          [comanda.mesa_id]
        );
      }
    }

    const comandaFechada = await buscarComandaPorId(id);

    return res.json({
      sucesso: true,
      mensagem: "Comanda fechada com sucesso e convertida em venda real.",
      comanda: comandaFechada,
      totais: {
        subtotal: vendaGerada.subtotal,
        desconto: vendaGerada.desconto,
        taxa_servico: vendaGerada.taxa_servico,
        total: vendaGerada.total,
      },
      venda: {
        venda_id: vendaGerada.venda_id,
        cmv_total: vendaGerada.cmv_total,
        lucro_bruto: vendaGerada.lucro_bruto,
      },
      pagamentos,
      troco: vendaGerada.troco,
    });
  } catch (error) {
    console.error("Erro ao fechar comanda:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao fechar comanda.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// PATCH /comandas/:id/cancelar
// Cancela comanda
// --------------------------------------
async function cancelarComanda(req, res) {
  try {
    const { id } = req.params;

    const comanda = await getAsync(
      `
        SELECT *
        FROM comandas
        WHERE id = ?
      `,
      [id]
    );

    if (!comanda) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Comanda não encontrada.",
      });
    }

    if (comanda.status !== "aberta") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Só é possível cancelar comandas abertas.",
      });
    }

    await runAsync(
      `
        UPDATE comandas
        SET
          status = 'cancelada',
          fechada_em = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [id]
    );

    await runAsync(
      `
        UPDATE comandas_itens
        SET status_item = 'cancelado'
        WHERE comanda_id = ?
      `,
      [id]
    );

    if (comanda.mesa_id) {
      const outraComandaAbertaNaMesa = await getAsync(
        `
          SELECT id
          FROM comandas
          WHERE mesa_id = ?
            AND status = 'aberta'
          LIMIT 1
        `,
        [comanda.mesa_id]
      );

      if (!outraComandaAbertaNaMesa) {
        await runAsync(
          `
            UPDATE mesas
            SET status = 'livre'
            WHERE id = ?
          `,
          [comanda.mesa_id]
        );
      }
    }

    const comandaCancelada = await buscarComandaPorId(id);

    return res.json({
      sucesso: true,
      mensagem: "Comanda cancelada com sucesso.",
      comanda: comandaCancelada,
    });
  } catch (error) {
    console.error("Erro ao cancelar comanda:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cancelar comanda.",
      erro: error.message,
    });
  }
}

module.exports = {
  abrirComanda,
  listarComandas,
  detalharComanda,
  adicionarItemComanda,
  listarItensComanda,
  atualizarStatusItem,
  aplicarDescontoComanda,
  fecharComanda,
  cancelarComanda,
};