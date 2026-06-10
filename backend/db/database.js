const { Pool } = require('pg');

let pool;
let credential;
let tokenExpiry = 0;
let useEntraAuth = false;

const getPool = async () => {
  // If using DATABASE_URL (password auth), create pool once
  if (process.env.DATABASE_URL) {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: true
      });
      console.log('PostgreSQL pool created (password auth)');
    }
    return pool;
  }

  // Otherwise use Microsoft Entra authentication
  useEntraAuth = true;
  const now = Date.now();

  // Refresh pool if token is expired or will expire in 5 minutes
  if (!pool || now > tokenExpiry - 5 * 60 * 1000) {
    if (pool) {
      await pool.end();
    }

    if (!credential) {
      const { DefaultAzureCredential } = require('@azure/identity');
      credential = new DefaultAzureCredential();
    }

    // Get access token for Azure PostgreSQL
    const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
    tokenExpiry = tokenResponse.expiresOnTimestamp;

    pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: tokenResponse.token,
      ssl: true
    });

    console.log('PostgreSQL pool created/refreshed (Entra auth)');
  }

  return pool;
};

const initDb = async () => {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        url TEXT,
        icon TEXT,
        category TEXT,
        business_division TEXT,
        business_function TEXT,
        requester_name TEXT,
        ai_spoc TEXT,
        priority TEXT,
        strategic_focus TEXT,
        doi_stage INTEGER DEFAULT 0,
        project_id TEXT,
        current_status TEXT,
        last_status TEXT,
        demand_type TEXT,
        platform TEXT,
        estimated_costs TEXT,
        start_date TEXT,
        end_date TEXT,
        ai_skills TEXT,
        risks TEXT,
        dependencies TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        type TEXT DEFAULT 'suggestion',
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        app_id TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT,
        email TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS widgets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        chart_type TEXT NOT NULL,
        data_field TEXT NOT NULL,
        color_scheme TEXT DEFAULT 'default',
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        config TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS doi_stages (
        id INTEGER PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS doi_history (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        from_stage INTEGER,
        to_stage INTEGER NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_requests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        requester_name TEXT NOT NULL,
        requester_email TEXT,
        business_division TEXT,
        business_function TEXT,
        priority TEXT,
        justification TEXT,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
      );
    `);

    // Seed DOI stages if empty
    const doiCount = await client.query('SELECT COUNT(*) as count FROM doi_stages');
    if (parseInt(doiCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO doi_stages (id, label, description) VALUES
        (0, 'Ideation', 'Still in idea phase'),
        (1, 'Idea Generated', 'Use case defined'),
        (2, 'Feasibility Assessment', 'POC / Quick win'),
        (3, 'Project Decided', 'Move to MVP/Production'),
        (4, 'Project Implemented', 'Rollout started'),
        (5, 'Impact Realized', 'Scaled and value realized')
      `);
    }

    // Seed initial admin if no admins exist
    const adminCount = await client.query('SELECT COUNT(*) as count FROM admins');
    if (parseInt(adminCount.rows[0].count) === 0) {
      const { v4: uuidv4 } = require('uuid');
      const bcrypt = require('bcryptjs');
      const defaultPassword = bcrypt.hashSync('admin123', 10);

      await client.query(
        'INSERT INTO admins (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
        [uuidv4(), 'Divakar Doreiswamy', 'Divakar.Doreiswamy@knorr-bremse.com', defaultPassword]
      );
      console.log('Default admin created: Divakar.Doreiswamy@knorr-bremse.com / admin123');
    }

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
};

// Helper for running queries
const query = async (text, params) => {
  const p = await getPool();
  return p.query(text, params);
};

// Helper for getting single row
const queryOne = async (text, params) => {
  const p = await getPool();
  const result = await p.query(text, params);
  return result.rows[0];
};

// Helper for getting all rows
const queryAll = async (text, params) => {
  const p = await getPool();
  const result = await p.query(text, params);
  return result.rows;
};

module.exports = { pool, query, queryOne, queryAll, initDb };
