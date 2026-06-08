const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `icon-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.post('/upload-icon', upload.single('icon'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Apps management
router.get('/apps', (req, res) => {
  const apps = db.prepare('SELECT * FROM apps ORDER BY created_at DESC').all();
  res.json(apps);
});

router.post('/apps', (req, res) => {
  const {
    name, description, url, icon, category,
    business_division, business_function, requester_name, ai_spoc,
    priority, strategic_focus, doi_stage, project_id,
    current_status, last_status, demand_type, platform,
    estimated_costs, start_date, end_date, ai_skills, risks, dependencies
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const id = uuidv4();
  const initialDoiStage = doi_stage || 0;

  db.prepare(`
    INSERT INTO apps (
      id, name, description, url, icon, category,
      business_division, business_function, requester_name, ai_spoc,
      priority, strategic_focus, doi_stage, project_id,
      current_status, last_status, demand_type, platform,
      estimated_costs, start_date, end_date, ai_skills, risks, dependencies
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, description || null, url || null, icon || null, category || null,
    business_division || null, business_function || null, requester_name || null, ai_spoc || null,
    priority || null, strategic_focus || null, initialDoiStage, project_id || null,
    current_status || null, last_status || null, demand_type || null, platform || null,
    estimated_costs || null, start_date || null, end_date || null, ai_skills || null,
    risks || null, dependencies || null
  );

  // Record initial DOI stage in history
  db.prepare(`
    INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), id, null, initialDoiStage, 'Project created');

  res.status(201).json({ id, message: 'Project added successfully' });
});

router.put('/apps/:id', (req, res) => {
  const { id } = req.params;
  const {
    name, description, url, icon, category,
    business_division, business_function, requester_name, ai_spoc,
    priority, strategic_focus, doi_stage, project_id,
    current_status, last_status, demand_type, platform,
    estimated_costs, start_date, end_date, ai_skills, risks, dependencies
  } = req.body;

  // Get current DOI stage before update
  const currentApp = db.prepare('SELECT doi_stage FROM apps WHERE id = ?').get(id);
  const oldDoiStage = currentApp ? currentApp.doi_stage : null;

  db.prepare(`
    UPDATE apps SET
      name = ?, description = ?, url = ?, icon = ?, category = ?,
      business_division = ?, business_function = ?, requester_name = ?, ai_spoc = ?,
      priority = ?, strategic_focus = ?, doi_stage = ?, project_id = ?,
      current_status = ?, last_status = ?, demand_type = ?, platform = ?,
      estimated_costs = ?, start_date = ?, end_date = ?, ai_skills = ?,
      risks = ?, dependencies = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name, description, url, icon, category,
    business_division, business_function, requester_name, ai_spoc,
    priority, strategic_focus, doi_stage, project_id,
    current_status, last_status, demand_type, platform,
    estimated_costs, start_date, end_date, ai_skills,
    risks, dependencies,
    id
  );

  // Record DOI stage change if it changed
  if (oldDoiStage !== null && oldDoiStage !== doi_stage) {
    db.prepare(`
      INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), id, oldDoiStage, doi_stage, 'Stage updated');
  }

  res.json({ message: 'Project updated successfully' });
});

router.delete('/apps/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM apps WHERE id = ?').run(id);
  res.json({ message: 'App deleted successfully' });
});

// Announcements management
router.get('/announcements', (req, res) => {
  const announcements = db
    .prepare('SELECT * FROM announcements ORDER BY created_at DESC')
    .all();
  res.json(announcements);
});

router.post('/announcements', (req, res) => {
  const { title, content, type } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO announcements (id, title, content, type)
    VALUES (?, ?, ?, ?)
  `).run(id, title, content, type || 'info');

  res.status(201).json({ id, message: 'Announcement created successfully' });
});

router.put('/announcements/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, type, is_active } = req.body;

  db.prepare(`
    UPDATE announcements
    SET title = ?, content = ?, type = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, content, type, is_active ? 1 : 0, id);

  res.json({ message: 'Announcement updated successfully' });
});

router.delete('/announcements/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  res.json({ message: 'Announcement deleted successfully' });
});

// Feedback management
router.get('/feedback', (req, res) => {
  const feedback = db
    .prepare(`
      SELECT f.*, a.name as app_name
      FROM feedback f
      LEFT JOIN apps a ON f.app_id = a.id
      ORDER BY f.created_at DESC
    `)
    .all();
  res.json(feedback);
});

router.put('/feedback/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, id);
  res.json({ message: 'Feedback status updated' });
});

router.delete('/feedback/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM feedback WHERE id = ?').run(id);
  res.json({ message: 'Feedback deleted successfully' });
});

// Team members management
router.get('/team/all', (req, res) => {
  const members = db
    .prepare('SELECT DISTINCT name, role, email FROM team_members ORDER BY name ASC')
    .all();
  res.json(members);
});

router.get('/apps/:appId/team', (req, res) => {
  const { appId } = req.params;
  const members = db
    .prepare('SELECT * FROM team_members WHERE app_id = ? ORDER BY created_at ASC')
    .all(appId);
  res.json(members);
});

router.post('/apps/:appId/team', (req, res) => {
  const { appId } = req.params;
  const { name, role, email, avatar } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team member name is required' });
  }

  const existing = db.prepare(
    'SELECT id FROM team_members WHERE app_id = ? AND LOWER(name) = LOWER(?)'
  ).get(appId, name);

  if (existing) {
    return res.status(400).json({ error: 'This team member is already added to this project' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO team_members (id, app_id, name, role, email, avatar)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, appId, name, role || null, email || null, avatar || null);

  res.status(201).json({ id, message: 'Team member added successfully' });
});

router.put('/team/:id', (req, res) => {
  const { id } = req.params;
  const { name, role, email, avatar } = req.body;

  db.prepare(`
    UPDATE team_members
    SET name = ?, role = ?, email = ?, avatar = ?
    WHERE id = ?
  `).run(name, role, email, avatar, id);

  res.json({ message: 'Team member updated successfully' });
});

router.delete('/team/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM team_members WHERE id = ?').run(id);
  res.json({ message: 'Team member deleted successfully' });
});

// Widgets management
router.get('/widgets', (req, res) => {
  const widgets = db.prepare('SELECT * FROM widgets ORDER BY display_order ASC').all();
  res.json(widgets);
});

router.post('/widgets', (req, res) => {
  const { title, chart_type, data_field, color_scheme, display_order, config } = req.body;

  if (!title || !chart_type || !data_field) {
    return res.status(400).json({ error: 'Title, chart type, and data field are required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO widgets (id, title, chart_type, data_field, color_scheme, display_order, config)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, chart_type, data_field, color_scheme || 'default', display_order || 0, config || null);

  res.status(201).json({ id, message: 'Widget created successfully' });
});

router.put('/widgets/:id', (req, res) => {
  const { id } = req.params;
  const { title, chart_type, data_field, color_scheme, display_order, is_active, config } = req.body;

  db.prepare(`
    UPDATE widgets
    SET title = ?, chart_type = ?, data_field = ?, color_scheme = ?,
        display_order = ?, is_active = ?, config = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, chart_type, data_field, color_scheme, display_order, is_active ? 1 : 0, config, id);

  res.json({ message: 'Widget updated successfully' });
});

router.delete('/widgets/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM widgets WHERE id = ?').run(id);
  res.json({ message: 'Widget deleted successfully' });
});

// DOI Stages management
router.get('/doi-stages', (req, res) => {
  const stages = db.prepare('SELECT * FROM doi_stages ORDER BY id ASC').all();
  res.json(stages);
});

router.put('/doi-stages/:id', (req, res) => {
  const { id } = req.params;
  const { label, description } = req.body;

  db.prepare('UPDATE doi_stages SET label = ?, description = ? WHERE id = ?')
    .run(label, description || null, id);

  res.json({ message: 'DOI stage updated successfully' });
});

// App Requests management
router.get('/app-requests', (req, res) => {
  const requests = db
    .prepare('SELECT * FROM app_requests ORDER BY created_at DESC')
    .all();
  res.json(requests);
});

router.put('/app-requests/:id/approve', (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;

  const request = db.prepare('SELECT * FROM app_requests WHERE id = ?').get(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Create the app from the request
  const appId = uuidv4();
  db.prepare(`
    INSERT INTO apps (
      id, name, description, business_division, business_function,
      requester_name, priority, doi_stage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    appId, request.name, request.description, request.business_division,
    request.business_function, request.requester_name, request.priority, 0
  );

  // Record initial DOI stage
  db.prepare(`
    INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), appId, null, 0, 'Project created from approved request');

  // Update request status
  db.prepare(`
    UPDATE app_requests
    SET status = 'approved', admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(admin_notes || null, id);

  res.json({ appId, message: 'Request approved and app created' });
});

router.put('/app-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;

  db.prepare(`
    UPDATE app_requests
    SET status = 'rejected', admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(admin_notes || null, id);

  res.json({ message: 'Request rejected' });
});

router.delete('/app-requests/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM app_requests WHERE id = ?').run(id);
  res.json({ message: 'Request deleted' });
});

// Admin users management
router.get('/users', (req, res) => {
  const admins = db.prepare('SELECT id, name, email, is_active, created_at, last_login FROM admins ORDER BY created_at DESC').all();
  res.json(admins);
});

router.post('/users', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  const existing = db.prepare('SELECT id FROM admins WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(400).json({ error: 'An admin with this email already exists' });
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO admins (id, name, email, password_hash)
    VALUES (?, ?, ?, ?)
  `).run(id, name, email, passwordHash);

  res.status(201).json({ id, message: 'Admin user created successfully' });
});

router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, password, is_active } = req.body;

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }

  if (password) {
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE admins SET name = ?, email = ?, password_hash = ?, is_active = ? WHERE id = ?')
      .run(name, email, passwordHash, is_active ? 1 : 0, id);
  } else {
    db.prepare('UPDATE admins SET name = ?, email = ?, is_active = ? WHERE id = ?')
      .run(name, email, is_active ? 1 : 0, id);
  }

  res.json({ message: 'Admin updated successfully' });
});

router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  // Prevent deleting the last active admin
  const activeCount = db.prepare('SELECT COUNT(*) as count FROM admins WHERE is_active = 1').get();
  const admin = db.prepare('SELECT is_active FROM admins WHERE id = ?').get(id);

  if (admin?.is_active && activeCount.count <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last active admin' });
  }

  db.prepare('DELETE FROM admins WHERE id = ?').run(id);
  db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(id);

  res.json({ message: 'Admin deleted successfully' });
});

module.exports = router;
