const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryAll } = require('../db/database');

const router = express.Router();

router.get('/apps', async (req, res) => {
  try {
    const apps = await queryAll('SELECT * FROM apps WHERE deleted_at IS NULL ORDER BY usecase_identifier ASC NULLS LAST, created_at DESC');

    const appsWithTeam = await Promise.all(apps.map(async (app) => {
      const team = await queryAll('SELECT * FROM team_members WHERE app_id = $1 ORDER BY created_at ASC', [app.id]);
      return { ...app, team };
    }));

    res.json(appsWithTeam);
  } catch (error) {
    console.error('Error fetching apps:', error);
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

router.get('/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const app = await queryOne('SELECT * FROM apps WHERE id = $1', [id]);

    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    const team = await queryAll('SELECT * FROM team_members WHERE app_id = $1 ORDER BY created_at ASC', [id]);
    res.json({ ...app, team });
  } catch (error) {
    console.error('Error fetching app:', error);
    res.status(500).json({ error: 'Failed to fetch app' });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const announcements = await queryAll('SELECT * FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC');
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const { name, email, type, subject, message, app_id } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO feedback (id, name, email, type, subject, message, app_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name || null, email || null, type || 'suggestion', subject, message, app_id || null]
    );

    res.status(201).json({ id, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

router.get('/widgets', async (req, res) => {
  try {
    const widgets = await queryAll('SELECT * FROM widgets WHERE is_active = TRUE ORDER BY display_order ASC');
    res.json(widgets);
  } catch (error) {
    console.error('Error fetching widgets:', error);
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

router.get('/doi-stages', async (req, res) => {
  try {
    const stages = await queryAll('SELECT * FROM doi_stages ORDER BY id ASC');
    res.json(stages);
  } catch (error) {
    console.error('Error fetching DOI stages:', error);
    res.status(500).json({ error: 'Failed to fetch DOI stages' });
  }
});

router.get('/apps/:appId/doi-history', async (req, res) => {
  try {
    const { appId } = req.params;
    const history = await queryAll('SELECT * FROM doi_history WHERE app_id = $1 ORDER BY changed_at ASC', [appId]);
    const formattedHistory = history.map(h => ({
      ...h,
      changed_at: h.changed_at ? h.changed_at.toISOString() : null
    }));
    res.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching DOI history:', error);
    res.status(500).json({ error: 'Failed to fetch DOI history' });
  }
});

router.get('/all-doi-history', async (req, res) => {
  try {
    const history = await queryAll(`
      SELECT dh.*, a.name as app_name, a.start_date, a.end_date, a.doi_stage as current_stage, a.business_division
      FROM doi_history dh
      JOIN apps a ON dh.app_id = a.id
      WHERE a.deleted_at IS NULL
      ORDER BY dh.app_id, dh.changed_at ASC
    `);
    const formattedHistory = history.map(h => ({
      ...h,
      changed_at: h.changed_at ? (typeof h.changed_at === 'string' ? h.changed_at : h.changed_at.toISOString()) : null
    }));
    res.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching all DOI history:', error);
    res.status(500).json({ error: 'Failed to fetch DOI history' });
  }
});

router.post('/app-requests', async (req, res) => {
  try {
    const { name, description, requester_name, requester_email, business_division, business_function, priority, justification } = req.body;

    if (!name || !requester_name) {
      return res.status(400).json({ error: 'App name and requester name are required' });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO app_requests (id, name, description, requester_name, requester_email, business_division, business_function, priority, justification) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, name, description || null, requester_name, requester_email || null, business_division || null, business_function || null, priority || null, justification || null]
    );

    res.status(201).json({ id, message: 'App request submitted successfully' });
  } catch (error) {
    console.error('Error submitting app request:', error);
    res.status(500).json({ error: 'Failed to submit app request' });
  }
});

module.exports = router;
