require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/database');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agent');
const excelAgentRoutes = require('./routes/excel-agent');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/excel-agent', excelAgentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend static files in production
app.use(express.static(path.join(__dirname, 'public')));

// All other routes serve the React app
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initDb()
  .then(async () => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });

    // Generate embeddings for projects without them (non-blocking)
    if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT) {
      const { generateAllEmbeddings } = require('./services/embedding');
      generateAllEmbeddings().catch(err => {
        console.error('Error generating embeddings on startup:', err.message);
      });
    }
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
