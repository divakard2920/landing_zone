const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query, queryOne, queryAll } = require('../db/database');

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
router.get('/apps', async (req, res) => {
  try {
    const apps = await queryAll('SELECT * FROM apps ORDER BY created_at DESC');
    res.json(apps);
  } catch (error) {
    console.error('Error fetching apps:', error);
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

router.post('/apps', async (req, res) => {
  try {
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

    await query(`
      INSERT INTO apps (
        id, name, description, url, icon, category,
        business_division, business_function, requester_name, ai_spoc,
        priority, strategic_focus, doi_stage, project_id,
        current_status, last_status, demand_type, platform,
        estimated_costs, start_date, end_date, ai_skills, risks, dependencies
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
    `, [
      id, name, description || null, url || null, icon || null, category || null,
      business_division || null, business_function || null, requester_name || null, ai_spoc || null,
      priority || null, strategic_focus || null, initialDoiStage, project_id || null,
      current_status || null, last_status || null, demand_type || null, platform || null,
      estimated_costs || null, start_date || null, end_date || null, ai_skills || null,
      risks || null, dependencies || null
    ]);

    // Record initial DOI stage in history
    await query(
      'INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), id, null, initialDoiStage, 'Project created']
    );

    res.status(201).json({ id, message: 'Project added successfully' });
  } catch (error) {
    console.error('Error creating app:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, url, icon, category,
      business_division, business_function, requester_name, ai_spoc,
      priority, strategic_focus, doi_stage, project_id,
      current_status, last_status, demand_type, platform,
      estimated_costs, start_date, end_date, ai_skills, risks, dependencies
    } = req.body;

    // Get current DOI stage before update
    const currentApp = await queryOne('SELECT doi_stage FROM apps WHERE id = $1', [id]);
    const oldDoiStage = currentApp ? currentApp.doi_stage : null;

    await query(`
      UPDATE apps SET
        name = $1, description = $2, url = $3, icon = $4, category = $5,
        business_division = $6, business_function = $7, requester_name = $8, ai_spoc = $9,
        priority = $10, strategic_focus = $11, doi_stage = $12, project_id = $13,
        current_status = $14, last_status = $15, demand_type = $16, platform = $17,
        estimated_costs = $18, start_date = $19, end_date = $20, ai_skills = $21,
        risks = $22, dependencies = $23,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $24
    `, [
      name, description, url, icon, category,
      business_division, business_function, requester_name, ai_spoc,
      priority, strategic_focus, doi_stage, project_id,
      current_status, last_status, demand_type, platform,
      estimated_costs, start_date, end_date, ai_skills,
      risks, dependencies,
      id
    ]);

    // Record DOI stage change if it changed
    if (oldDoiStage !== null && oldDoiStage !== doi_stage) {
      await query(
        'INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), id, oldDoiStage, doi_stage, 'Stage updated']
      );
    }

    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    console.error('Error updating app:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM apps WHERE id = $1', [id]);
    res.json({ message: 'App deleted successfully' });
  } catch (error) {
    console.error('Error deleting app:', error);
    res.status(500).json({ error: 'Failed to delete app' });
  }
});

// Announcements management
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await queryAll('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const { title, content, type } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO announcements (id, title, content, type) VALUES ($1, $2, $3, $4)',
      [id, title, content, type || 'info']
    );

    res.status(201).json({ id, message: 'Announcement created successfully' });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.put('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, is_active } = req.body;

    await query(`
      UPDATE announcements
      SET title = $1, content = $2, type = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [title, content, type, is_active, id]);

    res.json({ message: 'Announcement updated successfully' });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM announcements WHERE id = $1', [id]);
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Feedback management
router.get('/feedback', async (req, res) => {
  try {
    const feedback = await queryAll(`
      SELECT f.*, a.name as app_name
      FROM feedback f
      LEFT JOIN apps a ON f.app_id = a.id
      ORDER BY f.created_at DESC
    `);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

router.put('/feedback/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await query('UPDATE feedback SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: 'Feedback status updated' });
  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({ error: 'Failed to update feedback status' });
  }
});

router.delete('/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM feedback WHERE id = $1', [id]);
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Team members management
router.get('/team/all', async (req, res) => {
  try {
    const members = await queryAll('SELECT DISTINCT name, role, email FROM team_members ORDER BY name ASC');
    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

router.get('/apps/:appId/team', async (req, res) => {
  try {
    const { appId } = req.params;
    const members = await queryAll('SELECT * FROM team_members WHERE app_id = $1 ORDER BY created_at ASC', [appId]);
    res.json(members);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/apps/:appId/team', async (req, res) => {
  try {
    const { appId } = req.params;
    const { name, role, email, avatar } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team member name is required' });
    }

    const existing = await queryOne(
      'SELECT id FROM team_members WHERE app_id = $1 AND LOWER(name) = LOWER($2)',
      [appId, name]
    );

    if (existing) {
      return res.status(400).json({ error: 'This team member is already added to this project' });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO team_members (id, app_id, name, role, email, avatar) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, appId, name, role || null, email || null, avatar || null]
    );

    res.status(201).json({ id, message: 'Team member added successfully' });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

router.put('/team/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, email, avatar } = req.body;

    await query(
      'UPDATE team_members SET name = $1, role = $2, email = $3, avatar = $4 WHERE id = $5',
      [name, role, email, avatar, id]
    );

    res.json({ message: 'Team member updated successfully' });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

router.delete('/team/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM team_members WHERE id = $1', [id]);
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

// Widgets management
router.get('/widgets', async (req, res) => {
  try {
    const widgets = await queryAll('SELECT * FROM widgets ORDER BY display_order ASC');
    res.json(widgets);
  } catch (error) {
    console.error('Error fetching widgets:', error);
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

router.post('/widgets', async (req, res) => {
  try {
    const { title, chart_type, data_field, color_scheme, display_order, config } = req.body;

    if (!title || !chart_type || !data_field) {
      return res.status(400).json({ error: 'Title, chart type, and data field are required' });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO widgets (id, title, chart_type, data_field, color_scheme, display_order, config) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, title, chart_type, data_field, color_scheme || 'default', display_order || 0, config || null]
    );

    res.status(201).json({ id, message: 'Widget created successfully' });
  } catch (error) {
    console.error('Error creating widget:', error);
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

router.put('/widgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, chart_type, data_field, color_scheme, display_order, is_active, config } = req.body;

    await query(`
      UPDATE widgets
      SET title = $1, chart_type = $2, data_field = $3, color_scheme = $4,
          display_order = $5, is_active = $6, config = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
    `, [title, chart_type, data_field, color_scheme, display_order, is_active, config, id]);

    res.json({ message: 'Widget updated successfully' });
  } catch (error) {
    console.error('Error updating widget:', error);
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

router.delete('/widgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM widgets WHERE id = $1', [id]);
    res.json({ message: 'Widget deleted successfully' });
  } catch (error) {
    console.error('Error deleting widget:', error);
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

// DOI Stages management
router.get('/doi-stages', async (req, res) => {
  try {
    const stages = await queryAll('SELECT * FROM doi_stages ORDER BY id ASC');
    res.json(stages);
  } catch (error) {
    console.error('Error fetching DOI stages:', error);
    res.status(500).json({ error: 'Failed to fetch DOI stages' });
  }
});

router.put('/doi-stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, description } = req.body;

    await query('UPDATE doi_stages SET label = $1, description = $2 WHERE id = $3', [label, description || null, id]);
    res.json({ message: 'DOI stage updated successfully' });
  } catch (error) {
    console.error('Error updating DOI stage:', error);
    res.status(500).json({ error: 'Failed to update DOI stage' });
  }
});

// App Requests management
router.get('/app-requests', async (req, res) => {
  try {
    const requests = await queryAll('SELECT * FROM app_requests ORDER BY created_at DESC');
    res.json(requests);
  } catch (error) {
    console.error('Error fetching app requests:', error);
    res.status(500).json({ error: 'Failed to fetch app requests' });
  }
});

router.put('/app-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const request = await queryOne('SELECT * FROM app_requests WHERE id = $1', [id]);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Create the app from the request
    const appId = uuidv4();
    await query(`
      INSERT INTO apps (
        id, name, description, business_division, business_function,
        requester_name, priority, doi_stage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      appId, request.name, request.description, request.business_division,
      request.business_function, request.requester_name, request.priority, 0
    ]);

    // Record initial DOI stage
    await query(
      'INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), appId, null, 0, 'Project created from approved request']
    );

    // Update request status
    await query(`
      UPDATE app_requests
      SET status = 'approved', admin_notes = $1, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [admin_notes || null, id]);

    res.json({ appId, message: 'Request approved and app created' });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.put('/app-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    await query(`
      UPDATE app_requests
      SET status = 'rejected', admin_notes = $1, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [admin_notes || null, id]);

    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

router.delete('/app-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM app_requests WHERE id = $1', [id]);
    res.json({ message: 'Request deleted' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

// Admin users management
router.get('/users', async (req, res) => {
  try {
    const admins = await queryAll('SELECT id, name, email, is_active, created_at, last_login FROM admins ORDER BY created_at DESC');
    res.json(admins);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await queryOne('SELECT id FROM admins WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing) {
      return res.status(400).json({ error: 'An admin with this email already exists' });
    }

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    await query(
      'INSERT INTO admins (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
      [id, name, email, passwordHash]
    );

    res.status(201).json({ id, message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, is_active } = req.body;

    const admin = await queryOne('SELECT * FROM admins WHERE id = $1', [id]);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (password) {
      const passwordHash = bcrypt.hashSync(password, 10);
      await query(
        'UPDATE admins SET name = $1, email = $2, password_hash = $3, is_active = $4 WHERE id = $5',
        [name, email, passwordHash, is_active, id]
      );
    } else {
      await query(
        'UPDATE admins SET name = $1, email = $2, is_active = $3 WHERE id = $4',
        [name, email, is_active, id]
      );
    }

    res.json({ message: 'Admin updated successfully' });
  } catch (error) {
    console.error('Error updating admin user:', error);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting the last active admin
    const activeCount = await queryOne('SELECT COUNT(*) as count FROM admins WHERE is_active = TRUE');
    const admin = await queryOne('SELECT is_active FROM admins WHERE id = $1', [id]);

    if (admin?.is_active && parseInt(activeCount.count) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last active admin' });
    }

    await query('DELETE FROM admins WHERE id = $1', [id]);
    await query('DELETE FROM admin_sessions WHERE admin_id = $1', [id]);

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

module.exports = router;
