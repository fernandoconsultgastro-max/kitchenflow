const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

console.log("DB TESTE RENDER 4146");

const isRender = !!process.env.RENDER || process.platform === "linux";

const dbDir = isRender
  ? "/tmp"
  : path.join(__dirname, "database");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "database.sqlite");
console.log("Tentando abrir banco em:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao abrir banco SQLite:", err.message);
  } else {
    console.log("Banco SQLite conectado em:", dbPath);
  }
});

// ===============================
// HELPERS DE EXECUÇÃO
// ===============================
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

// ===============================
// VERIFICAR SE COLUNA EXISTE
// ===============================
async function colunaExiste(nomeTabela, nomeColuna) {
  const colunas = await allAsync(`PRAGMA table_info(${nomeTabela})`);
  return colunas.some((coluna) => coluna.name === nomeColuna);
}

// ===============================
// ADICIONAR COLUNA SE NÃO EXISTIR
// ===============================
async function garantirColuna(nomeTabela, nomeColuna, definicaoSql) {
  const existe = await colunaExiste(nomeTabela, nomeColuna);

  if (!existe) {
    await runAsync(`
      ALTER TABLE ${nomeTabela}
      ADD COLUMN ${nomeColuna} ${definicaoSql}
    `);

    console.log(`Coluna adicionada: ${nomeTabela}.${nomeColuna}`);
  }
}

// ===============================
// INIT DO BANCO
// ===============================
async function init() {
  try {
    await runAsync(`PRAGMA foreign_keys = ON`);

    // ===============================
    // INSUMOS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS insumos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        categoria TEXT,
        unidade TEXT,
        quantidade REAL DEFAULT 0,
        custo REAL DEFAULT 0,
        observacao TEXT DEFAULT ''
      )
    `);

    await garantirColuna("insumos", "observacao", "TEXT DEFAULT ''");

    // ===============================
    // MOVIMENTAÇÕES
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS movimentacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        insumo_id INTEGER,
        tipo TEXT,
        quantidade REAL,
        origem TEXT DEFAULT '',
        referencia_id INTEGER,
        observacao TEXT DEFAULT '',
        data DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(insumo_id) REFERENCES insumos(id)
      )
    `);

    await garantirColuna("movimentacoes", "origem", "TEXT DEFAULT ''");
    await garantirColuna("movimentacoes", "referencia_id", "INTEGER");
    await garantirColuna("movimentacoes", "observacao", "TEXT DEFAULT ''");
    await garantirColuna("movimentacoes", "data", "DATETIME");

    // ===============================
    // FICHAS TÉCNICAS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS fichas_tecnicas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        cmv REAL DEFAULT 0,
        preco_sugerido REAL DEFAULT 0,
        preco_praticado REAL DEFAULT 0,
        rendimento REAL DEFAULT 0,
        descricao TEXT DEFAULT ''
      )
    `);

    await garantirColuna("fichas_tecnicas", "cmv", "REAL DEFAULT 0");
    await garantirColuna("fichas_tecnicas", "preco_sugerido", "REAL DEFAULT 0");
    await garantirColuna("fichas_tecnicas", "preco_praticado", "REAL DEFAULT 0");
    await garantirColuna("fichas_tecnicas", "rendimento", "REAL DEFAULT 0");
    await garantirColuna("fichas_tecnicas", "descricao", "TEXT DEFAULT ''");

    // ===============================
    // ITENS DAS FICHAS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS fichas_tecnicas_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ficha_id INTEGER,
        insumo_id INTEGER,
        quantidade REAL DEFAULT 0,
        FOREIGN KEY(ficha_id) REFERENCES fichas_tecnicas(id),
        FOREIGN KEY(insumo_id) REFERENCES insumos(id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS fichas_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ficha_id INTEGER,
        insumo_id INTEGER,
        quantidade REAL DEFAULT 0,
        FOREIGN KEY(ficha_id) REFERENCES fichas_tecnicas(id),
        FOREIGN KEY(insumo_id) REFERENCES insumos(id)
      )
    `);

    // ===============================
    // PRATOS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS pratos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        ficha_id INTEGER,
        categoria TEXT,
        status TEXT DEFAULT 'ativo',
        preco_venda REAL DEFAULT 0,
        FOREIGN KEY(ficha_id) REFERENCES fichas_tecnicas(id)
      )
    `);

    await garantirColuna("pratos", "categoria", "TEXT");
    await garantirColuna("pratos", "status", "TEXT DEFAULT 'ativo'");
    await garantirColuna("pratos", "preco_venda", "REAL DEFAULT 0");

    // ===============================
    // MESAS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS mesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL,
        descricao TEXT DEFAULT '',
        lugares INTEGER DEFAULT 0,
        status TEXT DEFAULT 'livre',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await garantirColuna("mesas", "descricao", "TEXT DEFAULT ''");
    await garantirColuna("mesas", "lugares", "INTEGER DEFAULT 0");
    await garantirColuna("mesas", "status", "TEXT DEFAULT 'livre'");
    await garantirColuna("mesas", "created_at", "DATETIME");

    // ===============================
    // COMANDAS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS comandas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesa_id INTEGER,
        codigo TEXT,
        cliente_nome TEXT DEFAULT '',
        origem TEXT DEFAULT 'salao',
        status TEXT DEFAULT 'aberta',
        observacao TEXT DEFAULT '',
        subtotal REAL DEFAULT 0,
        desconto REAL DEFAULT 0,
        taxa_servico REAL DEFAULT 0,
        total REAL DEFAULT 0,
        venda_id INTEGER,
        aberta_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        fechada_em DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(mesa_id) REFERENCES mesas(id),
        FOREIGN KEY(venda_id) REFERENCES vendas(id)
      )
    `);

    await garantirColuna("comandas", "codigo", "TEXT");
    await garantirColuna("comandas", "cliente_nome", "TEXT DEFAULT ''");
    await garantirColuna("comandas", "origem", "TEXT DEFAULT 'salao'");
    await garantirColuna("comandas", "status", "TEXT DEFAULT 'aberta'");
    await garantirColuna("comandas", "observacao", "TEXT DEFAULT ''");
    await garantirColuna("comandas", "subtotal", "REAL DEFAULT 0");
    await garantirColuna("comandas", "desconto", "REAL DEFAULT 0");
    await garantirColuna("comandas", "taxa_servico", "REAL DEFAULT 0");
    await garantirColuna("comandas", "total", "REAL DEFAULT 0");
    await garantirColuna("comandas", "venda_id", "INTEGER");
    await garantirColuna("comandas", "aberta_em", "DATETIME");
    await garantirColuna("comandas", "fechada_em", "DATETIME");
    await garantirColuna("comandas", "created_at", "DATETIME");

    // ===============================
    // VENDAS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        comanda_id INTEGER,
        subtotal REAL DEFAULT 0,
        desconto REAL DEFAULT 0,
        taxa_servico REAL DEFAULT 0,
        total REAL DEFAULT 0,
        cmv_total REAL DEFAULT 0,
        lucro_bruto REAL DEFAULT 0,
        data DATETIME DEFAULT CURRENT_TIMESTAMP,

        prato_id INTEGER,
        ficha_id INTEGER,
        nome_prato TEXT,
        quantidade INTEGER DEFAULT 1,
        preco_unitario REAL DEFAULT 0,
        faturamento_total REAL DEFAULT 0,
        custo_total REAL DEFAULT 0,
        cmv_percentual REAL DEFAULT 0,
        observacao TEXT DEFAULT '',
        data_venda DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY(comanda_id) REFERENCES comandas(id),
        FOREIGN KEY(prato_id) REFERENCES pratos(id),
        FOREIGN KEY(ficha_id) REFERENCES fichas_tecnicas(id)
      )
    `);

    await garantirColuna("vendas", "comanda_id", "INTEGER");
    await garantirColuna("vendas", "subtotal", "REAL DEFAULT 0");
    await garantirColuna("vendas", "desconto", "REAL DEFAULT 0");
    await garantirColuna("vendas", "taxa_servico", "REAL DEFAULT 0");
    await garantirColuna("vendas", "total", "REAL DEFAULT 0");
    await garantirColuna("vendas", "cmv_total", "REAL DEFAULT 0");
    await garantirColuna("vendas", "lucro_bruto", "REAL DEFAULT 0");
    await garantirColuna("vendas", "data", "DATETIME");

    await garantirColuna("vendas", "prato_id", "INTEGER");
    await garantirColuna("vendas", "ficha_id", "INTEGER");
    await garantirColuna("vendas", "nome_prato", "TEXT");
    await garantirColuna("vendas", "quantidade", "INTEGER DEFAULT 1");
    await garantirColuna("vendas", "preco_unitario", "REAL DEFAULT 0");
    await garantirColuna("vendas", "faturamento_total", "REAL DEFAULT 0");
    await garantirColuna("vendas", "custo_total", "REAL DEFAULT 0");
    await garantirColuna("vendas", "cmv_percentual", "REAL DEFAULT 0");
    await garantirColuna("vendas", "observacao", "TEXT DEFAULT ''");
    await garantirColuna("vendas", "data_venda", "DATETIME");
    await garantirColuna("vendas", "created_at", "DATETIME");

    // ===============================
    // VENDAS ITENS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS vendas_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        venda_id INTEGER,
        prato_id INTEGER,
        ficha_id INTEGER,
        nome_prato TEXT,
        quantidade INTEGER DEFAULT 1,
        preco_unitario REAL DEFAULT 0,
        total_item REAL DEFAULT 0,

        insumo_id INTEGER,
        nome_insumo TEXT,
        quantidade_baixada REAL DEFAULT 0,
        unidade TEXT,
        custo_unitario REAL DEFAULT 0,
        custo_total_item REAL DEFAULT 0,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY(venda_id) REFERENCES vendas(id),
        FOREIGN KEY(prato_id) REFERENCES pratos(id),
        FOREIGN KEY(ficha_id) REFERENCES fichas_tecnicas(id),
        FOREIGN KEY(insumo_id) REFERENCES insumos(id)
      )
    `);

    await garantirColuna("vendas_itens", "prato_id", "INTEGER");
    await garantirColuna("vendas_itens", "ficha_id", "INTEGER");
    await garantirColuna("vendas_itens", "nome_prato", "TEXT");
    await garantirColuna("vendas_itens", "quantidade", "INTEGER DEFAULT 1");
    await garantirColuna("vendas_itens", "preco_unitario", "REAL DEFAULT 0");
    await garantirColuna("vendas_itens", "total_item", "REAL DEFAULT 0");
    await garantirColuna("vendas_itens", "insumo_id", "INTEGER");
    await garantirColuna("vendas_itens", "nome_insumo", "TEXT");
    await garantirColuna("vendas_itens", "quantidade_baixada", "REAL DEFAULT 0");
    await garantirColuna("vendas_itens", "unidade", "TEXT");
    await garantirColuna("vendas_itens", "custo_unitario", "REAL DEFAULT 0");
    await garantirColuna("vendas_itens", "custo_total_item", "REAL DEFAULT 0");
    await garantirColuna("vendas_itens", "created_at", "DATETIME");

    // ===============================
    // COMANDAS ITENS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS comandas_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comanda_id INTEGER NOT NULL,
        prato_id INTEGER NOT NULL,
        ficha_id INTEGER,
        nome_prato TEXT NOT NULL,
        quantidade INTEGER DEFAULT 1,
        preco_unitario REAL DEFAULT 0,
        total_item REAL DEFAULT 0,
        observacao TEXT DEFAULT '',
        status_item TEXT DEFAULT 'pendente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(comanda_id) REFERENCES comandas(id),
        FOREIGN KEY(prato_id) REFERENCES pratos(id),
        FOREIGN KEY(ficha_id) REFERENCES fichas_tecnicas(id)
      )
    `);

    await garantirColuna("comandas_itens", "ficha_id", "INTEGER");
    await garantirColuna("comandas_itens", "nome_prato", "TEXT");
    await garantirColuna("comandas_itens", "quantidade", "INTEGER DEFAULT 1");
    await garantirColuna("comandas_itens", "preco_unitario", "REAL DEFAULT 0");
    await garantirColuna("comandas_itens", "total_item", "REAL DEFAULT 0");
    await garantirColuna("comandas_itens", "observacao", "TEXT DEFAULT ''");
    await garantirColuna("comandas_itens", "status_item", "TEXT DEFAULT 'pendente'");
    await garantirColuna("comandas_itens", "created_at", "DATETIME");

    // ===============================
    // PAGAMENTOS
    // ===============================
    await runAsync(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL,
        comanda_id INTEGER,
        metodo TEXT NOT NULL,
        valor REAL NOT NULL DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(venda_id) REFERENCES vendas(id),
        FOREIGN KEY(comanda_id) REFERENCES comandas(id)
      )
    `);

    await garantirColuna("pagamentos", "comanda_id", "INTEGER");
    await garantirColuna("pagamentos", "metodo", "TEXT");
    await garantirColuna("pagamentos", "valor", "REAL DEFAULT 0");
    await garantirColuna("pagamentos", "criado_em", "DATETIME");

    console.log("Banco pronto com estrutura profissional do KitchenFlow.");
  } catch (error) {
    console.error("Erro ao iniciar banco:", error.message);
  }
}

init();

module.exports = db;
