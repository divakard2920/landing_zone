const { Pool } = require('pg');

let pool;
let credential;
let tokenExpiry = 0;
let useEntraAuth = false;

const getPool = async () => {
  // If BRANCH is set, use local PostgreSQL (Docker)
  if (process.env.BRANCH) {
    if (!pool) {
      pool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'kbase',
        user: 'postgres',
        password: 'postgres'
      });
      console.log(`PostgreSQL pool created (local Docker - branch: ${process.env.BRANCH})`);
    }
    return pool;
  }

  // If using DATABASE_URL (password auth), create pool once
  if (process.env.DATABASE_URL) {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: true }
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
      ssl: { rejectUnauthorized: true }
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
        usecase_type TEXT,
        usecase_identifier TEXT,
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

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        admin_id TEXT,
        admin_name TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        entity_name TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS usecase_identifier_registry (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        usecase_type TEXT NOT NULL,
        usecase_identifier TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS use_case_intake (
        id TEXT PRIMARY KEY,
        idea_name TEXT NOT NULL,
        usecase_type TEXT,
        idea_owner TEXT,
        submission_date DATE DEFAULT CURRENT_DATE,
        sponsor TEXT,
        division TEXT,
        product_owner TEXT,
        line_of_business TEXT,
        motivation TEXT,
        description_target TEXT,
        value_add TEXT,
        problem_evidence TEXT,
        solution_maturity TEXT,
        value_proof TEXT,
        dependencies_risks TEXT,
        complexity_integration INTEGER DEFAULT 1,
        complexity_data_security INTEGER DEFAULT 1,
        complexity_solution_type INTEGER DEFAULT 1,
        complexity_users INTEGER DEFAULT 1,
        complexity_process_change INTEGER DEFAULT 1,
        complexity_stakeholder INTEGER DEFAULT 1,
        complexity_effort_cost INTEGER DEFAULT 1,
        complexity_score INTEGER DEFAULT 7,
        benefit_availability INTEGER DEFAULT 1,
        benefit_time_saving INTEGER DEFAULT 1,
        benefit_cost_reduction INTEGER DEFAULT 1,
        benefit_legacy_consolidation INTEGER DEFAULT 1,
        benefit_automation INTEGER DEFAULT 1,
        benefit_data_quality INTEGER DEFAULT 1,
        benefit_compliance INTEGER DEFAULT 1,
        benefit_score INTEGER DEFAULT 7,
        priority_index INTEGER,
        priority_cluster TEXT,
        recommended_action TEXT,
        tshirt_size TEXT,
        status TEXT DEFAULT 'Draft',
        admin_notes TEXT,
        attachments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: Add admin_notes column to use_case_intake if it doesn't exist
    const adminNotesCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'use_case_intake' AND column_name = 'admin_notes'
    `);
    if (adminNotesCheck.rows.length === 0) {
      await client.query('ALTER TABLE use_case_intake ADD COLUMN admin_notes TEXT');
      console.log('Migration: Added admin_notes column to use_case_intake table');
    }

    // Migration: Add usecase_type column to use_case_intake if it doesn't exist
    const usecaseTypeCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'use_case_intake' AND column_name = 'usecase_type'
    `);
    if (usecaseTypeCheck.rows.length === 0) {
      await client.query('ALTER TABLE use_case_intake ADD COLUMN usecase_type TEXT');
      console.log('Migration: Added usecase_type column to use_case_intake table');
    }

    // Migration: Add app_id column to use_case_intake to link to AI Pipeline project
    const appIdCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'use_case_intake' AND column_name = 'app_id'
    `);
    if (appIdCheck.rows.length === 0) {
      await client.query('ALTER TABLE use_case_intake ADD COLUMN app_id TEXT');
      console.log('Migration: Added app_id column to use_case_intake table');
    }

    // Migration: Drop capacity_confirmed column from use_case_intake (no longer needed)
    const capacityCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'use_case_intake' AND column_name = 'capacity_confirmed'
    `);
    if (capacityCheck.rows.length > 0) {
      await client.query('ALTER TABLE use_case_intake DROP COLUMN capacity_confirmed');
      console.log('Migration: Dropped capacity_confirmed column from use_case_intake table');
    }

    // Migration: Add attachments column to use_case_intake for file uploads
    const attachmentsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'use_case_intake' AND column_name = 'attachments'
    `);
    if (attachmentsCheck.rows.length === 0) {
      await client.query('ALTER TABLE use_case_intake ADD COLUMN attachments TEXT');
      console.log('Migration: Added attachments column to use_case_intake table');
    }

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

    // Migration: Add usecase_type and usecase_identifier columns if they don't exist
    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'apps' AND column_name = 'usecase_type'
    `);
    if (columnCheck.rows.length === 0) {
      await client.query('ALTER TABLE apps ADD COLUMN usecase_type TEXT');
      await client.query('ALTER TABLE apps ADD COLUMN usecase_identifier TEXT');
      console.log('Migration: Added usecase_type and usecase_identifier columns to apps table');
    }

    // Migration: Add deleted_at column for soft delete
    const deletedAtCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'apps' AND column_name = 'deleted_at'
    `);
    if (deletedAtCheck.rows.length === 0) {
      await client.query('ALTER TABLE apps ADD COLUMN deleted_at TIMESTAMP');
      console.log('Migration: Added deleted_at column to apps table for soft delete');
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
