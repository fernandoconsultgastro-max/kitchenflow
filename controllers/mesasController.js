const db = require("../database");

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
async function buscarMesaPorId(id) {
  return await getAsync(
    `
      SELECT
        m.*,
        (
          SELECT COUNT(*)
          FROM comandas c
          WHERE c.mesa_id = m.id
            AND c.status = 'aberta'
        ) AS comandas_abertas
      FROM mesas m
      WHERE m.id = ?
    `,
    [id]
  );
}

// ======================================
// CONTROLLER
// ======================================

// --------------------------------------
// POST /mesas
// Criar mesa
// body:
// {
//   numero,
//   descricao,
//   lugares,
//   status
// }
// status:
// livre | ocupada | reservada | inativa
// --------------------------------------
async function criarMesa(req, res) {
  try {
    const {
      numero,
      descricao = "",
      lugares = 0,
      status = "livre",
    } = req.body;

    const statusValidos = ["livre", "ocupada", "reservada", "inativa"];

    if (!numero || String(numero).trim() === "") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O número da mesa é obrigatório.",
      });
    }

    if (!statusValidos.includes(status)) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Status inválido. Use: livre, ocupada, reservada ou inativa.",
      });
    }

    const lugaresNumero = Number(lugares);

    if (Number.isNaN(lugaresNumero) || lugaresNumero < 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O campo lugares deve ser um número maior ou igual a zero.",
      });
    }

    const mesaExistente = await getAsync(
      `
        SELECT *
        FROM mesas
        WHERE numero = ?
      `,
      [String(numero).trim()]
    );

    if (mesaExistente) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Já existe uma mesa cadastrada com esse número.",
      });
    }

    const resultado = await runAsync(
      `
        INSERT INTO mesas (
          numero,
          descricao,
          lugares,
          status
        )
        VALUES (?, ?, ?, ?)
      `,
      [String(numero).trim(), descricao, lugaresNumero, status]
    );

    const novaMesa = await buscarMesaPorId(resultado.lastID);

    return res.status(201).json({
      sucesso: true,
      mensagem: "Mesa criada com sucesso.",
      mesa: novaMesa,
    });
  } catch (error) {
    console.error("Erro ao criar mesa:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao criar mesa.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// GET /mesas
// Listar mesas
// query opcional:
// ?status=livre
// --------------------------------------
async function listarMesas(req, res) {
  try {
    const { status } = req.query;

    let sql = `
      SELECT
        m.*,
        (
          SELECT COUNT(*)
          FROM comandas c
          WHERE c.mesa_id = m.id
            AND c.status = 'aberta'
        ) AS comandas_abertas,
        (
          SELECT c.id
          FROM comandas c
          WHERE c.mesa_id = m.id
            AND c.status = 'aberta'
          ORDER BY c.id DESC
          LIMIT 1
        ) AS comanda_aberta_id
      FROM mesas m
      WHERE 1 = 1
    `;

    const params = [];

    if (status) {
      sql += ` AND m.status = ? `;
      params.push(status);
    }

    sql += ` ORDER BY CAST(m.numero AS INTEGER), m.numero ASC `;

    const mesas = await allAsync(sql, params);

    return res.json({
      sucesso: true,
      total: mesas.length,
      mesas,
    });
  } catch (error) {
    console.error("Erro ao listar mesas:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao listar mesas.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// GET /mesas/:id
// Detalhar mesa
// --------------------------------------
async function detalharMesa(req, res) {
  try {
    const { id } = req.params;

    const mesa = await getAsync(
      `
        SELECT
          m.*,
          (
            SELECT COUNT(*)
            FROM comandas c
            WHERE c.mesa_id = m.id
              AND c.status = 'aberta'
          ) AS comandas_abertas,
          (
            SELECT c.id
            FROM comandas c
            WHERE c.mesa_id = m.id
              AND c.status = 'aberta'
            ORDER BY c.id DESC
            LIMIT 1
          ) AS comanda_aberta_id
        FROM mesas m
        WHERE m.id = ?
      `,
      [id]
    );

    if (!mesa) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Mesa não encontrada.",
      });
    }

    let comandaAberta = null;
    let itensComanda = [];

    if (mesa.comanda_aberta_id) {
      comandaAberta = await getAsync(
        `
          SELECT *
          FROM comandas
          WHERE id = ?
        `,
        [mesa.comanda_aberta_id]
      );

      itensComanda = await allAsync(
        `
          SELECT *
          FROM comandas_itens
          WHERE comanda_id = ?
          ORDER BY id ASC
        `,
        [mesa.comanda_aberta_id]
      );
    }

    return res.json({
      sucesso: true,
      mesa,
      comanda_aberta: comandaAberta,
      itens_comanda: itensComanda,
    });
  } catch (error) {
    console.error("Erro ao detalhar mesa:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao detalhar mesa.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// PATCH /mesas/:id
// Atualizar dados da mesa
// body:
// {
//   numero,
//   descricao,
//   lugares,
//   status
// }
// --------------------------------------
async function atualizarMesa(req, res) {
  try {
    const { id } = req.params;
    const {
      numero,
      descricao,
      lugares,
      status,
    } = req.body;

    const mesaAtual = await getAsync(
      `
        SELECT *
        FROM mesas
        WHERE id = ?
      `,
      [id]
    );

    if (!mesaAtual) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Mesa não encontrada.",
      });
    }

    const statusValidos = ["livre", "ocupada", "reservada", "inativa"];

    const novoNumero =
      numero !== undefined ? String(numero).trim() : mesaAtual.numero;

    const novaDescricao =
      descricao !== undefined ? descricao : mesaAtual.descricao;

    const novosLugares =
      lugares !== undefined ? Number(lugares) : Number(mesaAtual.lugares);

    const novoStatus =
      status !== undefined ? status : mesaAtual.status;

    if (!novoNumero || novoNumero.trim() === "") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O número da mesa é obrigatório.",
      });
    }

    if (Number.isNaN(novosLugares) || novosLugares < 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O campo lugares deve ser um número maior ou igual a zero.",
      });
    }

    if (!statusValidos.includes(novoStatus)) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Status inválido. Use: livre, ocupada, reservada ou inativa.",
      });
    }

    const outraMesaMesmoNumero = await getAsync(
      `
        SELECT *
        FROM mesas
        WHERE numero = ?
          AND id != ?
      `,
      [novoNumero, id]
    );

    if (outraMesaMesmoNumero) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Já existe outra mesa cadastrada com esse número.",
      });
    }

    const comandaAberta = await getAsync(
      `
        SELECT id
        FROM comandas
        WHERE mesa_id = ?
          AND status = 'aberta'
        LIMIT 1
      `,
      [id]
    );

    if (comandaAberta && (novoStatus === "livre" || novoStatus === "inativa")) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Não é possível deixar a mesa livre ou inativa com comanda aberta.",
      });
    }

    await runAsync(
      `
        UPDATE mesas
        SET
          numero = ?,
          descricao = ?,
          lugares = ?,
          status = ?
        WHERE id = ?
      `,
      [novoNumero, novaDescricao, novosLugares, novoStatus, id]
    );

    const mesaAtualizada = await buscarMesaPorId(id);

    return res.json({
      sucesso: true,
      mensagem: "Mesa atualizada com sucesso.",
      mesa: mesaAtualizada,
    });
  } catch (error) {
    console.error("Erro ao atualizar mesa:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar mesa.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// PATCH /mesas/:id/status
// body:
// {
//   status
// }
// --------------------------------------
async function atualizarStatusMesa(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const statusValidos = ["livre", "ocupada", "reservada", "inativa"];

    if (!status || !statusValidos.includes(status)) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Status inválido. Use: livre, ocupada, reservada ou inativa.",
      });
    }

    const mesa = await getAsync(
      `
        SELECT *
        FROM mesas
        WHERE id = ?
      `,
      [id]
    );

    if (!mesa) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Mesa não encontrada.",
      });
    }

    const comandaAberta = await getAsync(
      `
        SELECT id
        FROM comandas
        WHERE mesa_id = ?
          AND status = 'aberta'
        LIMIT 1
      `,
      [id]
    );

    if (comandaAberta && (status === "livre" || status === "inativa")) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Não é possível deixar a mesa livre ou inativa com comanda aberta.",
      });
    }

    await runAsync(
      `
        UPDATE mesas
        SET status = ?
        WHERE id = ?
      `,
      [status, id]
    );

    const mesaAtualizada = await buscarMesaPorId(id);

    return res.json({
      sucesso: true,
      mensagem: "Status da mesa atualizado com sucesso.",
      mesa: mesaAtualizada,
    });
  } catch (error) {
    console.error("Erro ao atualizar status da mesa:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar status da mesa.",
      erro: error.message,
    });
  }
}

// --------------------------------------
// DELETE /mesas/:id
// Remove mesa somente se não houver
// comanda aberta vinculada
// --------------------------------------
async function excluirMesa(req, res) {
  try {
    const { id } = req.params;

    const mesa = await getAsync(
      `
        SELECT *
        FROM mesas
        WHERE id = ?
      `,
      [id]
    );

    if (!mesa) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Mesa não encontrada.",
      });
    }

    const comandaAberta = await getAsync(
      `
        SELECT id
        FROM comandas
        WHERE mesa_id = ?
          AND status = 'aberta'
        LIMIT 1
      `,
      [id]
    );

    if (comandaAberta) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Não é possível excluir uma mesa com comanda aberta.",
      });
    }

    await runAsync(
      `
        DELETE FROM mesas
        WHERE id = ?
      `,
      [id]
    );

    return res.json({
      sucesso: true,
      mensagem: "Mesa excluída com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir mesa:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao excluir mesa.",
      erro: error.message,
    });
  }
}

module.exports = {
  criarMesa,
  listarMesas,
  detalharMesa,
  atualizarMesa,
  atualizarStatusMesa,
  excluirMesa,
};