const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const router = express.Router();

router.get('/apps', (req, res) => {
  const apps = db.prepare('SELECT * FROM apps ORDER BY name').all();

  // Include team members for each app
  const appsWithTeam = apps.map(app => {
    const team = db.prepare('SELECT * FROM team_members WHERE app_id = ? ORDER BY created_at ASC').all(app.id);
    return { ...app, team };
  });

  res.json(appsWithTeam);
});

router.get('/apps/:id', (req, res) => {
  const { id } = req.params;
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);

  if (!app) {
    return res.status(404).json({ error: 'App not found' });
  }

  const team = db.prepare('SELECT * FROM team_members WHERE app_id = ? ORDER BY created_at ASC').all(id);
  res.json({ ...app, team });
});

router.get('/announcements', (req, res) => {
  const announcements = db
    .prepare('SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC')
    .all();
  res.json(announcements);
});

router.post('/feedback', (req, res) => {
  const { name, email, type, subject, message, app_id } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO feedback (id, name, email, type, subject, message, app_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name || null, email || null, type || 'suggestion', subject, message, app_id || null);

  res.status(201).json({ id, message: 'Feedback submitted successfully' });
});

router.get('/widgets', (req, res) => {
  const widgets = db
    .prepare('SELECT * FROM widgets WHERE is_active = 1 ORDER BY display_order ASC')
    .all();
  res.json(widgets);
});

router.get('/doi-stages', (req, res) => {
  const stages = db
    .prepare('SELECT * FROM doi_stages ORDER BY id ASC')
    .all();
  res.json(stages);
});

module.exports = router;
