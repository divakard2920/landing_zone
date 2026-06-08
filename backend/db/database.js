const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'landingzone.db'));

db.exec(`
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    data_field TEXT NOT NULL,
    color_scheme TEXT DEFAULT 'default',
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
  );
`);

// Seed DOI stages if empty
const doiCount = db.prepare('SELECT COUNT(*) as count FROM doi_stages').get();
if (doiCount.count === 0) {
  const insertDoi = db.prepare('INSERT INTO doi_stages (id, label, description) VALUES (?, ?, ?)');
  insertDoi.run(0, 'Ideation', 'Still in idea phase');
  insertDoi.run(1, 'Idea Generated', 'Use case defined');
  insertDoi.run(2, 'Feasibility Assessment', 'POC / Quick win');
  insertDoi.run(3, 'Project Decided', 'Move to MVP/Production');
  insertDoi.run(4, 'Project Implemented', 'Rollout started');
  insertDoi.run(5, 'Impact Realized', 'Scaled and value realized');
}

// Migration: Add app_id column to feedback if it doesn't exist
try {
  db.exec(`ALTER TABLE feedback ADD COLUMN app_id TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add risks column to apps if it doesn't exist
try {
  db.exec(`ALTER TABLE apps ADD COLUMN risks TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add dependencies column to apps if it doesn't exist
try {
  db.exec(`ALTER TABLE apps ADD COLUMN dependencies TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Seed initial admin if no admins exist
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
if (adminCount.count === 0) {
  const { v4: uuidv4 } = require('uuid');
  const bcrypt = require('bcryptjs');
  const defaultPassword = bcrypt.hashSync('admin123', 10);

  db.prepare(`
    INSERT INTO admins (id, name, email, password_hash)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), 'Divakar Doreiswamy', 'Divakar.Doreiswamy@knorr-bremse.com', defaultPassword);

  console.log('Default admin created: Divakar.Doreiswamy@knorr-bremse.com / admin123');
}

module.exports = db;
