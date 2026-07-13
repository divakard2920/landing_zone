const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const { query, queryOne, queryAll } = require('../db/database');

const router = express.Router();

// Azure Blob Storage configuration
const STORAGE_ACCOUNT = 'devaifactory45whyrst20';
const CONTAINER_NAME = 'kbase';
const BLOB_URL = `https://${STORAGE_ACCOUNT}.blob.core.windows.net`;

// Use memory storage for multer, then upload to Azure
const upload = multer({
  storage: multer.memoryStorage(),
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

// Get Azure Blob container client
let containerClient = null;
const getContainerClient = async () => {
  if (!containerClient) {
    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(BLOB_URL, credential);
    containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  }
  return containerClient;
};

router.post('/upload-icon', upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const blobName = `icons/icon-${uuidv4()}${ext}`;

    const container = await getContainerClient();
    const blockBlobClient = container.getBlockBlobClient(blobName);

    await blockBlobClient.upload(req.file.buffer, req.file.buffer.length, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    res.json({ url: `${BLOB_URL}/${CONTAINER_NAME}/${blobName}` });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Apps management
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

// Get deleted projects - must be before /apps/:id routes
router.get('/apps/deleted', async (req, res) => {
  try {
    const apps = await queryAll('SELECT * FROM apps WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
    res.json(apps);
  } catch (error) {
    console.error('Error fetching deleted apps:', error);
    res.status(500).json({ error: 'Failed to fetch deleted projects' });
  }
});

router.post('/apps', async (req, res) => {
  try {
    const {
      name, description, url, icon, category,
      business_division, business_function, requester_name, ai_spoc,
      priority, strategic_focus, doi_stage, project_id,
      current_status, last_status, demand_type, platform,
      estimated_costs, start_date, end_date, ai_skills, risks, dependencies,
      usecase_type
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (!usecase_type) {
      return res.status(400).json({ error: 'Use Case Type is required' });
    }

    // Check for duplicate project name
    const existingProject = await queryOne(
      'SELECT id, name FROM apps WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL',
      [name]
    );
    if (existingProject) {
      return res.status(400).json({ error: `A project with the name "${name}" already exists` });
    }

    const id = uuidv4();
    // Always start new projects at DOI Stage 0
    const initialDoiStage = 0;

    // If start_date not provided, use doi_changed_at or current date
    const { doi_changed_at } = req.body;
    const effectiveStartDate = start_date || doi_changed_at || new Date().toISOString().split('T')[0];

    // Generate or reuse usecase_identifier based on usecase_type
    let usecase_identifier = null;
    if (usecase_type) {
      // First check if this project name already has an identifier in the registry
      const existingRegistry = await queryOne(
        `SELECT usecase_identifier FROM usecase_identifier_registry
         WHERE LOWER(project_name) = LOWER($1) AND usecase_type = $2`,
        [name, usecase_type]
      );

      if (existingRegistry) {
        // Reuse existing identifier
        usecase_identifier = existingRegistry.usecase_identifier;
      } else {
        // Generate new identifier
        const prefixMap = {
          'AI Usecase': 'AI',
          'Foundation': 'F'
        };
        const prefix = prefixMap[usecase_type];
        if (prefix) {
          // Check both apps table and registry for the highest number
          const lastFromApps = await queryOne(
            `SELECT usecase_identifier FROM apps
             WHERE usecase_type = $1 AND usecase_identifier IS NOT NULL
             ORDER BY usecase_identifier DESC LIMIT 1`,
            [usecase_type]
          );
          const lastFromRegistry = await queryOne(
            `SELECT usecase_identifier FROM usecase_identifier_registry
             WHERE usecase_type = $1
             ORDER BY usecase_identifier DESC LIMIT 1`,
            [usecase_type]
          );

          let nextNumber = 1;
          const extractNumber = (identifier) => {
            if (!identifier) return 0;
            const match = identifier.match(/_(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          };

          const numFromApps = extractNumber(lastFromApps?.usecase_identifier);
          const numFromRegistry = extractNumber(lastFromRegistry?.usecase_identifier);
          nextNumber = Math.max(numFromApps, numFromRegistry) + 1;

          usecase_identifier = `${prefix}_${String(nextNumber).padStart(3, '0')}`;

          // Register the new identifier
          await query(
            `INSERT INTO usecase_identifier_registry (id, project_name, usecase_type, usecase_identifier)
             VALUES ($1, $2, $3, $4)`,
            [uuidv4(), name, usecase_type, usecase_identifier]
          );
        }
      }
    }

    await query(`
      INSERT INTO apps (
        id, name, description, url, icon, category,
        business_division, business_function, requester_name, ai_spoc,
        priority, strategic_focus, doi_stage, project_id,
        current_status, last_status, demand_type, platform,
        estimated_costs, start_date, end_date, ai_skills, risks, dependencies,
        usecase_type, usecase_identifier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
    `, [
      id, name, description || null, url || null, icon || null, category || null,
      business_division || null, business_function || null, requester_name || null, ai_spoc || null,
      priority || null, strategic_focus || null, initialDoiStage, project_id || null,
      current_status || null, last_status || null, demand_type || null, platform || null,
      estimated_costs || null, effectiveStartDate, end_date || null, ai_skills || null,
      risks || null, dependencies || null,
      usecase_type || null, usecase_identifier
    ]);

    // Record initial DOI stage in history
    if (doi_changed_at) {
      await query(
        'INSERT INTO doi_history (id, app_id, from_stage, to_stage, changed_at, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), id, null, initialDoiStage, doi_changed_at, 'Project created (manual date)']
      );
    } else {
      await query(
        'INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), id, null, initialDoiStage, 'Project created']
      );
    }

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
      estimated_costs, start_date, end_date, ai_skills, risks, dependencies,
      usecase_type
    } = req.body;

    // Check for duplicate project name (excluding current project)
    const existingProject = await queryOne(
      'SELECT id, name FROM apps WHERE LOWER(name) = LOWER($1) AND id != $2 AND deleted_at IS NULL',
      [name, id]
    );
    if (existingProject) {
      return res.status(400).json({ error: `A project with the name "${name}" already exists` });
    }

    // Get current app data before update
    const currentApp = await queryOne('SELECT doi_stage, usecase_identifier FROM apps WHERE id = $1', [id]);
    const oldDoiStage = currentApp ? parseInt(currentApp.doi_stage) : null;
    const newDoiStage = parseInt(doi_stage);

    // Generate or reuse usecase_identifier if usecase_type is set and no identifier exists
    let usecase_identifier = currentApp?.usecase_identifier || null;
    if (usecase_type && !usecase_identifier) {
      // First check if this project name already has an identifier in the registry
      const existingRegistry = await queryOne(
        `SELECT usecase_identifier FROM usecase_identifier_registry
         WHERE LOWER(project_name) = LOWER($1) AND usecase_type = $2`,
        [name, usecase_type]
      );

      if (existingRegistry) {
        // Reuse existing identifier
        usecase_identifier = existingRegistry.usecase_identifier;
      } else {
        // Generate new identifier
        const prefixMap = {
          'AI Usecase': 'AI',
          'Foundation': 'F'
        };
        const prefix = prefixMap[usecase_type];
        if (prefix) {
          const lastFromApps = await queryOne(
            `SELECT usecase_identifier FROM apps
             WHERE usecase_type = $1 AND usecase_identifier IS NOT NULL
             ORDER BY usecase_identifier DESC LIMIT 1`,
            [usecase_type]
          );
          const lastFromRegistry = await queryOne(
            `SELECT usecase_identifier FROM usecase_identifier_registry
             WHERE usecase_type = $1
             ORDER BY usecase_identifier DESC LIMIT 1`,
            [usecase_type]
          );

          let nextNumber = 1;
          const extractNumber = (identifier) => {
            if (!identifier) return 0;
            const match = identifier.match(/_(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          };

          const numFromApps = extractNumber(lastFromApps?.usecase_identifier);
          const numFromRegistry = extractNumber(lastFromRegistry?.usecase_identifier);
          nextNumber = Math.max(numFromApps, numFromRegistry) + 1;

          usecase_identifier = `${prefix}_${String(nextNumber).padStart(3, '0')}`;

          // Register the new identifier
          await query(
            `INSERT INTO usecase_identifier_registry (id, project_name, usecase_type, usecase_identifier)
             VALUES ($1, $2, $3, $4)`,
            [uuidv4(), name, usecase_type, usecase_identifier]
          );
        }
      }
    }

    // Validate DOI stage progression
    if (oldDoiStage !== null && newDoiStage < oldDoiStage) {
      return res.status(400).json({
        error: `Cannot downgrade DOI stage. Current stage is DOI ${oldDoiStage}.`
      });
    }
    if (oldDoiStage !== null && newDoiStage > oldDoiStage && newDoiStage - oldDoiStage > 1) {
      return res.status(400).json({
        error: `Cannot skip DOI stages. Current stage is DOI ${oldDoiStage}, can only advance to DOI ${oldDoiStage + 1}.`
      });
    }

    const { doi_changed_at } = req.body;

    // Validate DOI stage date is chronological when advancing
    if (newDoiStage > oldDoiStage && doi_changed_at) {
      const previousStageHistory = await queryOne(
        'SELECT changed_at FROM doi_history WHERE app_id = $1 AND to_stage = $2 ORDER BY changed_at DESC LIMIT 1',
        [id, oldDoiStage]
      );
      if (previousStageHistory && new Date(doi_changed_at) < new Date(previousStageHistory.changed_at)) {
        const prevDate = new Date(previousStageHistory.changed_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        return res.status(400).json({
          error: `DOI ${newDoiStage} date cannot be earlier than DOI ${oldDoiStage} date (${prevDate}).`
        });
      }
    }

    await query(`
      UPDATE apps SET
        name = $1, description = $2, url = $3, icon = $4, category = $5,
        business_division = $6, business_function = $7, requester_name = $8, ai_spoc = $9,
        priority = $10, strategic_focus = $11, doi_stage = $12, project_id = $13,
        current_status = $14, last_status = $15, demand_type = $16, platform = $17,
        estimated_costs = $18, start_date = $19, end_date = $20, ai_skills = $21,
        risks = $22, dependencies = $23, usecase_type = $24, usecase_identifier = $25,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $26
    `, [
      name, description, url, icon, category,
      business_division, business_function, requester_name, ai_spoc,
      priority, strategic_focus, doi_stage, project_id,
      current_status, last_status, demand_type, platform,
      estimated_costs, start_date, end_date, ai_skills,
      risks, dependencies, usecase_type, usecase_identifier,
      id
    ]);

    // Handle DOI stage changes
    if (oldDoiStage !== null && oldDoiStage !== newDoiStage) {
      // Stage changed - create new history entry
      if (doi_changed_at) {
        await query(
          'INSERT INTO doi_history (id, app_id, from_stage, to_stage, changed_at, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [uuidv4(), id, oldDoiStage, newDoiStage, doi_changed_at, 'Stage updated (manual date)']
        );
      } else {
        await query(
          'INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes) VALUES ($1, $2, $3, $4, $5)',
          [uuidv4(), id, oldDoiStage, newDoiStage, 'Stage updated']
        );
      }
    } else if (doi_changed_at) {
      // Stage didn't change but date provided - update existing history entry for current stage
      const existingEntry = await queryOne(
        'SELECT id FROM doi_history WHERE app_id = $1 AND to_stage = $2 ORDER BY changed_at DESC LIMIT 1',
        [id, newDoiStage]
      );
      if (existingEntry) {
        await query(
          'UPDATE doi_history SET changed_at = $1, notes = $2 WHERE id = $3',
          [doi_changed_at, 'Date updated', existingEntry.id]
        );
      }
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
    // Soft delete - set deleted_at timestamp
    await query('UPDATE apps SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting app:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Restore deleted project
router.post('/apps/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE apps SET deleted_at = NULL WHERE id = $1', [id]);
    res.json({ message: 'Project restored successfully' });
  } catch (error) {
    console.error('Error restoring app:', error);
    res.status(500).json({ error: 'Failed to restore project' });
  }
});

// Permanently delete project
router.delete('/apps/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM apps WHERE id = $1', [id]);
    res.json({ message: 'Project permanently deleted' });
  } catch (error) {
    console.error('Error permanently deleting app:', error);
    res.status(500).json({ error: 'Failed to permanently delete project' });
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

// Activity logs
const logActivity = async (adminId, adminName, action, entityType, entityId, entityName, details) => {
  try {
    await query(
      'INSERT INTO activity_logs (id, admin_id, admin_name, action, entity_type, entity_id, entity_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), adminId, adminName, action, entityType, entityId, entityName, details]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

router.get('/activity-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await queryAll(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    res.json(logs);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

router.post('/activity-logs', async (req, res) => {
  try {
    const { admin_id, admin_name, action, entity_type, entity_id, entity_name, details } = req.body;
    await logActivity(admin_id, admin_name, action, entity_type, entity_id, entity_name, details);
    res.status(201).json({ message: 'Activity logged' });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// Use Case Intake
router.get('/use-case-intake', async (req, res) => {
  try {
    const useCases = await queryAll('SELECT * FROM use_case_intake ORDER BY created_at DESC');
    res.json(useCases);
  } catch (error) {
    console.error('Error fetching use cases:', error);
    res.status(500).json({ error: 'Failed to fetch use cases' });
  }
});

router.get('/use-case-intake/:id', async (req, res) => {
  try {
    const useCase = await queryOne('SELECT * FROM use_case_intake WHERE id = $1', [req.params.id]);
    if (!useCase) {
      return res.status(404).json({ error: 'Use case not found' });
    }
    res.json(useCase);
  } catch (error) {
    console.error('Error fetching use case:', error);
    res.status(500).json({ error: 'Failed to fetch use case' });
  }
});

router.post('/use-case-intake', async (req, res) => {
  try {
    const id = uuidv4();
    const {
      idea_name, usecase_type, idea_owner, submission_date, sponsor, division, product_owner,
      line_of_business, motivation, description_target,
      value_add, problem_evidence, solution_maturity, value_proof, dependencies_risks,
      complexity_integration, complexity_data_security, complexity_solution_type,
      complexity_users, complexity_process_change, complexity_stakeholder, complexity_effort_cost,
      benefit_availability, benefit_time_saving, benefit_cost_reduction,
      benefit_legacy_consolidation, benefit_automation, benefit_data_quality, benefit_compliance,
      status
    } = req.body;

    const complexityScore = (complexity_integration || 1) + (complexity_data_security || 1) +
      (complexity_solution_type || 1) + (complexity_users || 1) + (complexity_process_change || 1) +
      (complexity_stakeholder || 1) + (complexity_effort_cost || 1);

    const benefitScore = (benefit_availability || 1) + (benefit_time_saving || 1) +
      (benefit_cost_reduction || 1) + (benefit_legacy_consolidation || 1) +
      (benefit_automation || 1) + (benefit_data_quality || 1) + (benefit_compliance || 1);

    const priorityIndex = Math.round((benefitScore / 28 * 70) + ((29 - complexityScore) / 28 * 30));

    let priorityCluster;
    if (complexityScore > 16 && benefitScore < 18) {
      priorityCluster = 'Rework';
    } else if (complexityScore <= 16 && benefitScore >= 18) {
      priorityCluster = 'High Priority / Quick Win';
    } else if (complexityScore <= 16 && benefitScore < 18) {
      priorityCluster = 'Low Priority';
    } else {
      priorityCluster = 'Medium Priority';
    }

    let recommendedAction;
    if (priorityCluster === 'High Priority / Quick Win') {
      recommendedAction = 'Start with DOI1';
    } else if (priorityCluster === 'Medium Priority') {
      recommendedAction = 'Approval for DOI1 necessary';
    } else if (priorityCluster === 'Low Priority') {
      recommendedAction = 'Park in Backlog; Benefit not sufficient';
    } else {
      recommendedAction = 'Decline and rework';
    }

    const totalScore = complexityScore + benefitScore;
    let tshirtSize;
    if (totalScore < 16) tshirtSize = 'XS';
    else if (totalScore <= 20) tshirtSize = 'S';
    else if (totalScore <= 28) tshirtSize = 'M';
    else if (totalScore <= 42) tshirtSize = 'L';
    else tshirtSize = 'XL';

    const effectiveSubmissionDate = submission_date || new Date().toISOString().split('T')[0];

    // Only create project if NOT Low Priority or Rework
    let appId = null;
    if (priorityCluster !== 'Low Priority' && priorityCluster !== 'Rework') {
      appId = uuidv4();

      // Generate usecase_identifier for the project
      let usecase_identifier = null;
      if (usecase_type) {
        const prefixMap = { 'AI Usecase': 'AI', 'Foundation': 'F' };
        const prefix = prefixMap[usecase_type];
        if (prefix) {
          const lastFromApps = await queryOne(
            `SELECT usecase_identifier FROM apps WHERE usecase_type = $1 AND usecase_identifier IS NOT NULL ORDER BY usecase_identifier DESC LIMIT 1`,
            [usecase_type]
          );
          const lastFromRegistry = await queryOne(
            `SELECT usecase_identifier FROM usecase_identifier_registry WHERE usecase_type = $1 ORDER BY usecase_identifier DESC LIMIT 1`,
            [usecase_type]
          );
          const extractNumber = (identifier) => {
            if (!identifier) return 0;
            const match = identifier.match(/_(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          };
          const numFromApps = extractNumber(lastFromApps?.usecase_identifier);
          const numFromRegistry = extractNumber(lastFromRegistry?.usecase_identifier);
          const nextNumber = Math.max(numFromApps, numFromRegistry) + 1;
          usecase_identifier = `${prefix}_${String(nextNumber).padStart(3, '0')}`;

          await query(
            `INSERT INTO usecase_identifier_registry (id, project_name, usecase_type, usecase_identifier) VALUES ($1, $2, $3, $4)`,
            [uuidv4(), idea_name, usecase_type, usecase_identifier]
          );
        }
      }

      // Create the project at DOI 0
      await query(`
        INSERT INTO apps (
          id, name, description, business_division, business_function, requester_name, ai_spoc,
          priority, doi_stage, current_status, start_date, risks, usecase_type, usecase_identifier
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        appId, idea_name, description_target || motivation || null, division || null,
        line_of_business || null, idea_owner || null, product_owner || null,
        priorityCluster === 'High Priority / Quick Win' ? 'High' : 'Medium',
        0, 'Use case defined', effectiveSubmissionDate, dependencies_risks || null, usecase_type || null, usecase_identifier
      ]);

      // Record DOI 0 in history with submission date
      await query(
        'INSERT INTO doi_history (id, app_id, from_stage, to_stage, changed_at, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), appId, null, 0, effectiveSubmissionDate, 'Use case submitted']
      );
    }

    // Create the use case intake record (with or without linked app_id)
    await query(
      `INSERT INTO use_case_intake (
        id, idea_name, usecase_type, idea_owner, submission_date, sponsor, division, product_owner,
        line_of_business, motivation, description_target,
        value_add, problem_evidence, solution_maturity, value_proof, dependencies_risks,
        complexity_integration, complexity_data_security, complexity_solution_type,
        complexity_users, complexity_process_change, complexity_stakeholder, complexity_effort_cost,
        complexity_score, benefit_availability, benefit_time_saving, benefit_cost_reduction,
        benefit_legacy_consolidation, benefit_automation, benefit_data_quality, benefit_compliance,
        benefit_score, priority_index, priority_cluster, recommended_action, tshirt_size, status, app_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38)`,
      [
        id, idea_name, usecase_type, idea_owner, effectiveSubmissionDate,
        sponsor, division, product_owner, line_of_business,
        motivation, description_target, value_add, problem_evidence, solution_maturity,
        value_proof, dependencies_risks, complexity_integration || 1, complexity_data_security || 1,
        complexity_solution_type || 1, complexity_users || 1, complexity_process_change || 1,
        complexity_stakeholder || 1, complexity_effort_cost || 1, complexityScore,
        benefit_availability || 1, benefit_time_saving || 1, benefit_cost_reduction || 1,
        benefit_legacy_consolidation || 1, benefit_automation || 1, benefit_data_quality || 1,
        benefit_compliance || 1, benefitScore, priorityIndex, priorityCluster, recommendedAction,
        tshirtSize, status || 'Draft', appId
      ]
    );

    res.status(201).json({
      id, app_id: appId, complexity_score: complexityScore, benefit_score: benefitScore,
      priority_index: priorityIndex, priority_cluster: priorityCluster,
      recommended_action: recommendedAction, tshirt_size: tshirtSize
    });
  } catch (error) {
    console.error('Error creating use case:', error);
    res.status(500).json({ error: 'Failed to create use case' });
  }
});

router.put('/use-case-intake/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      idea_name, usecase_type, idea_owner, submission_date, sponsor, division, product_owner,
      line_of_business, motivation, description_target,
      value_add, problem_evidence, solution_maturity, value_proof, dependencies_risks,
      complexity_integration, complexity_data_security, complexity_solution_type,
      complexity_users, complexity_process_change, complexity_stakeholder, complexity_effort_cost,
      benefit_availability, benefit_time_saving, benefit_cost_reduction,
      benefit_legacy_consolidation, benefit_automation, benefit_data_quality, benefit_compliance,
      status, admin_notes
    } = req.body;

    const complexityScore = (complexity_integration || 1) + (complexity_data_security || 1) +
      (complexity_solution_type || 1) + (complexity_users || 1) + (complexity_process_change || 1) +
      (complexity_stakeholder || 1) + (complexity_effort_cost || 1);

    const benefitScore = (benefit_availability || 1) + (benefit_time_saving || 1) +
      (benefit_cost_reduction || 1) + (benefit_legacy_consolidation || 1) +
      (benefit_automation || 1) + (benefit_data_quality || 1) + (benefit_compliance || 1);

    const priorityIndex = Math.round((benefitScore / 28 * 70) + ((29 - complexityScore) / 28 * 30));

    let priorityCluster;
    if (complexityScore > 16 && benefitScore < 18) {
      priorityCluster = 'Rework';
    } else if (complexityScore <= 16 && benefitScore >= 18) {
      priorityCluster = 'High Priority / Quick Win';
    } else if (complexityScore <= 16 && benefitScore < 18) {
      priorityCluster = 'Low Priority';
    } else {
      priorityCluster = 'Medium Priority';
    }

    let recommendedAction;
    if (priorityCluster === 'High Priority / Quick Win') {
      recommendedAction = 'Start with DOI1';
    } else if (priorityCluster === 'Medium Priority') {
      recommendedAction = 'Approval for DOI1 necessary';
    } else if (priorityCluster === 'Low Priority') {
      recommendedAction = 'Park in Backlog; Benefit not sufficient';
    } else {
      recommendedAction = 'Decline and rework';
    }

    const totalScore = complexityScore + benefitScore;
    let tshirtSize;
    if (totalScore < 16) tshirtSize = 'XS';
    else if (totalScore <= 20) tshirtSize = 'S';
    else if (totalScore <= 28) tshirtSize = 'M';
    else if (totalScore <= 42) tshirtSize = 'L';
    else tshirtSize = 'XL';

    // Get current use case to check status change, priority cluster change, and get app_id
    const currentUseCase = await queryOne('SELECT status, priority_cluster, app_id FROM use_case_intake WHERE id = $1', [id]);
    const oldStatus = currentUseCase?.status;
    const oldPriorityCluster = currentUseCase?.priority_cluster;
    const appId = currentUseCase?.app_id;

    await query(
      `UPDATE use_case_intake SET
        idea_name = $1, usecase_type = $2, idea_owner = $3, submission_date = $4, sponsor = $5, division = $6,
        product_owner = $7, line_of_business = $8, motivation = $9,
        description_target = $10, value_add = $11, problem_evidence = $12, solution_maturity = $13,
        value_proof = $14, dependencies_risks = $15, complexity_integration = $16,
        complexity_data_security = $17, complexity_solution_type = $18, complexity_users = $19,
        complexity_process_change = $20, complexity_stakeholder = $21, complexity_effort_cost = $22,
        complexity_score = $23, benefit_availability = $24, benefit_time_saving = $25,
        benefit_cost_reduction = $26, benefit_legacy_consolidation = $27, benefit_automation = $28,
        benefit_data_quality = $29, benefit_compliance = $30, benefit_score = $31,
        priority_index = $32, priority_cluster = $33, recommended_action = $34, tshirt_size = $35,
        status = $36, admin_notes = $37, updated_at = CURRENT_TIMESTAMP
      WHERE id = $38`,
      [
        idea_name, usecase_type, idea_owner, submission_date, sponsor, division, product_owner,
        line_of_business, motivation, description_target, value_add,
        problem_evidence, solution_maturity, value_proof, dependencies_risks,
        complexity_integration || 1, complexity_data_security || 1, complexity_solution_type || 1,
        complexity_users || 1, complexity_process_change || 1, complexity_stakeholder || 1,
        complexity_effort_cost || 1, complexityScore, benefit_availability || 1,
        benefit_time_saving || 1, benefit_cost_reduction || 1, benefit_legacy_consolidation || 1,
        benefit_automation || 1, benefit_data_quality || 1, benefit_compliance || 1, benefitScore,
        priorityIndex, priorityCluster, recommendedAction, tshirtSize, status || 'Draft', admin_notes, id
      ]
    );

    // If status changed to Approved or In Progress
    if ((status === 'Approved' || status === 'In Progress') && oldStatus !== status) {
      if (appId) {
        // Restore if soft-deleted, then move to DOI 1
        await query(
          `UPDATE apps SET deleted_at = NULL, doi_stage = 1, current_status = 'Idea Generated', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [appId]
        );
        // Record DOI 1 in history
        await query(
          'INSERT INTO doi_history (id, app_id, from_stage, to_stage, notes) VALUES ($1, $2, $3, $4, $5)',
          [uuidv4(), appId, 0, 1, status === 'In Progress' ? 'Started DOI1' : 'Use case approved']
        );
      } else {
        // No project exists - create one at DOI 1
        const newAppId = uuidv4();
        const effectiveStartDate = submission_date || new Date().toISOString().split('T')[0];

        // Generate usecase_identifier
        let newUsecaseIdentifier = null;
        if (usecase_type) {
          const prefixMap = { 'AI Usecase': 'AI', 'Foundation': 'F' };
          const prefix = prefixMap[usecase_type];
          if (prefix) {
            const lastFromApps = await queryOne(
              `SELECT usecase_identifier FROM apps WHERE usecase_type = $1 AND usecase_identifier IS NOT NULL ORDER BY usecase_identifier DESC LIMIT 1`,
              [usecase_type]
            );
            const lastFromRegistry = await queryOne(
              `SELECT usecase_identifier FROM usecase_identifier_registry WHERE usecase_type = $1 ORDER BY usecase_identifier DESC LIMIT 1`,
              [usecase_type]
            );
            const extractNumber = (identifier) => {
              if (!identifier) return 0;
              const match = identifier.match(/_(\d+)$/);
              return match ? parseInt(match[1]) : 0;
            };
            const nextNumber = Math.max(extractNumber(lastFromApps?.usecase_identifier), extractNumber(lastFromRegistry?.usecase_identifier)) + 1;
            newUsecaseIdentifier = `${prefix}_${String(nextNumber).padStart(3, '0')}`;

            await query(
              `INSERT INTO usecase_identifier_registry (id, project_name, usecase_type, usecase_identifier) VALUES ($1, $2, $3, $4)`,
              [uuidv4(), idea_name, usecase_type, newUsecaseIdentifier]
            );
          }
        }

        // Create the project at DOI 1 (approved means skip DOI 0)
        await query(`
          INSERT INTO apps (
            id, name, description, business_division, business_function, requester_name, ai_spoc,
            priority, doi_stage, current_status, start_date, risks, usecase_type, usecase_identifier
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          newAppId, idea_name, description_target || motivation || null, division || null,
          line_of_business || null, idea_owner || null, product_owner || null,
          priorityCluster === 'High Priority / Quick Win' ? 'High' : 'Medium',
          1, 'Idea Generated', effectiveStartDate, dependencies_risks || null, usecase_type || null, newUsecaseIdentifier
        ]);

        // Record DOI 1 in history (starting directly at DOI 1 since approved)
        await query(
          'INSERT INTO doi_history (id, app_id, from_stage, to_stage, changed_at, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [uuidv4(), newAppId, null, 1, effectiveStartDate, 'Project created from approved use case']
        );

        // Link the project to the use case
        await query('UPDATE use_case_intake SET app_id = $1 WHERE id = $2', [newAppId, id]);
      }
    }

    // If status changed to Parked, Declined, or Rework Required, soft-delete the linked project
    if (appId && (status === 'Parked' || status === 'Declined' || status === 'Rework Required') && oldStatus !== status) {
      await query(
        `UPDATE apps SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
        [appId]
      );
    }

    // If priority cluster changed from project-creating to non-project cluster, soft-delete the linked project
    const projectCreatingClusters = ['High Priority / Quick Win', 'Medium Priority'];
    const nonProjectClusters = ['Low Priority', 'Rework'];
    if (appId && projectCreatingClusters.includes(oldPriorityCluster) && nonProjectClusters.includes(priorityCluster)) {
      await query(
        `UPDATE apps SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
        [appId]
      );
    }

    // If priority cluster changed from non-project (or null) to project-creating cluster, create or restore the project
    const wasNonProjectCluster = oldPriorityCluster === null || nonProjectClusters.includes(oldPriorityCluster);
    if (wasNonProjectCluster && projectCreatingClusters.includes(priorityCluster) && oldPriorityCluster !== priorityCluster) {
      if (appId) {
        // Restore the soft-deleted project
        await query(
          `UPDATE apps SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [appId]
        );
      } else {
        // Create a new project
        const newAppId = uuidv4();
        const effectiveStartDate = submission_date || new Date().toISOString().split('T')[0];

        // Generate usecase_identifier
        let usecase_identifier = null;
        if (usecase_type) {
          const prefixMap = { 'AI Usecase': 'AI', 'Foundation': 'F' };
          const prefix = prefixMap[usecase_type];
          if (prefix) {
            const lastFromApps = await queryOne(
              `SELECT usecase_identifier FROM apps WHERE usecase_type = $1 AND usecase_identifier IS NOT NULL ORDER BY usecase_identifier DESC LIMIT 1`,
              [usecase_type]
            );
            const lastFromRegistry = await queryOne(
              `SELECT usecase_identifier FROM usecase_identifier_registry WHERE usecase_type = $1 ORDER BY usecase_identifier DESC LIMIT 1`,
              [usecase_type]
            );
            const extractNumber = (identifier) => {
              if (!identifier) return 0;
              const match = identifier.match(/_(\d+)$/);
              return match ? parseInt(match[1]) : 0;
            };
            const nextNumber = Math.max(extractNumber(lastFromApps?.usecase_identifier), extractNumber(lastFromRegistry?.usecase_identifier)) + 1;
            usecase_identifier = `${prefix}_${String(nextNumber).padStart(3, '0')}`;

            await query(
              `INSERT INTO usecase_identifier_registry (id, project_name, usecase_type, usecase_identifier) VALUES ($1, $2, $3, $4)`,
              [uuidv4(), idea_name, usecase_type, usecase_identifier]
            );
          }
        }

        // Create the project at DOI 0
        await query(`
          INSERT INTO apps (
            id, name, description, business_division, business_function, requester_name, ai_spoc,
            priority, doi_stage, current_status, start_date, risks, usecase_type, usecase_identifier
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          newAppId, idea_name, description_target || motivation || null, division || null,
          line_of_business || null, idea_owner || null, product_owner || null,
          priorityCluster === 'High Priority / Quick Win' ? 'High' : 'Medium',
          0, 'Use case defined', effectiveStartDate, dependencies_risks || null, usecase_type || null, usecase_identifier
        ]);

        // Record DOI 0 in history
        await query(
          'INSERT INTO doi_history (id, app_id, from_stage, to_stage, changed_at, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [uuidv4(), newAppId, null, 0, effectiveStartDate, 'Project created from use case update']
        );

        // Link the project to the use case
        await query('UPDATE use_case_intake SET app_id = $1 WHERE id = $2', [newAppId, id]);
      }
    }

    res.json({
      id, complexity_score: complexityScore, benefit_score: benefitScore,
      priority_index: priorityIndex, priority_cluster: priorityCluster,
      recommended_action: recommendedAction, tshirt_size: tshirtSize
    });
  } catch (error) {
    console.error('Error updating use case:', error);
    res.status(500).json({ error: 'Failed to update use case' });
  }
});

router.delete('/use-case-intake/:id', async (req, res) => {
  try {
    // Get linked app_id before deleting
    const useCase = await queryOne('SELECT app_id FROM use_case_intake WHERE id = $1', [req.params.id]);

    // Soft delete the linked project if it exists
    if (useCase?.app_id) {
      await query('UPDATE apps SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [useCase.app_id]);
    }

    await query('DELETE FROM use_case_intake WHERE id = $1', [req.params.id]);
    res.json({ message: 'Use case deleted successfully' });
  } catch (error) {
    console.error('Error deleting use case:', error);
    res.status(500).json({ error: 'Failed to delete use case' });
  }
});

module.exports = router;
