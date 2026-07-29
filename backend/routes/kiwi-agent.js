const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
const { AzureOpenAI } = require('openai');

const router = express.Router();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
const AZURE_OPENAI_EMBEDDING_DEPLOYMENT = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-large';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

// In-memory storage
let projects = [];
let embeddings = [];
let openaiClient = null;
let embeddingClient = null;

const upload = multer({ storage: multer.memoryStorage() });

const getOpenAIClient = () => {
  if (!openaiClient) {
    const credential = new DefaultAzureCredential();
    const scope = 'https://cognitiveservices.azure.com/.default';
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    openaiClient = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: AZURE_OPENAI_ENDPOINT,
      apiVersion: AZURE_OPENAI_API_VERSION,
      deployment: AZURE_OPENAI_DEPLOYMENT
    });
  }
  return openaiClient;
};

const getEmbeddingClient = () => {
  if (!embeddingClient) {
    const credential = new DefaultAzureCredential();
    const scope = 'https://cognitiveservices.azure.com/.default';
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    embeddingClient = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: AZURE_OPENAI_ENDPOINT,
      apiVersion: AZURE_OPENAI_API_VERSION
    });
  }
  return embeddingClient;
};

// Generate embedding for text
const generateEmbedding = async (text) => {
  if (!text || !AZURE_OPENAI_ENDPOINT) return null;
  try {
    const client = getEmbeddingClient();
    const response = await client.embeddings.create({
      model: AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
      input: text,
      dimensions: 1536
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    return null;
  }
};

// Cosine similarity
const cosineSimilarity = (a, b) => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Build text for embedding
const buildProjectText = (project) => {
  return Object.values(project).filter(v => v && typeof v === 'string').join(' | ');
};

// Search similar projects using in-memory embeddings
const searchSimilarProjects = async (query, limit = 10) => {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding || embeddings.length === 0) {
    return projects.slice(0, limit);
  }

  const scored = embeddings.map((emb, idx) => ({
    project: projects[idx],
    score: cosineSimilarity(queryEmbedding, emb.vector)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.project);
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'show_projects',
      description: 'Display projects as visual cards.',
      parameters: {
        type: 'object',
        properties: {
          filter_field: { type: 'string', description: 'Field to filter by' },
          filter_value: { type: 'string', description: 'Value to filter' },
          limit: { type: 'number', description: 'Max projects to show' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_statistics',
      description: 'Display statistics/analytics.',
      parameters: {
        type: 'object',
        properties: {
          group_by: { type: 'string', description: 'Field to group by for statistics' }
        },
        required: ['group_by']
      }
    }
  }
];

const executeFunction = (functionName, args) => {
  switch (functionName) {
    case 'show_projects': {
      let filtered = [...projects];
      const { filter_field, filter_value, limit = 10 } = args;

      if (filter_field && filter_value) {
        const searchVal = filter_value.toLowerCase();
        filtered = filtered.filter(p => {
          const fieldVal = p[filter_field];
          return fieldVal && String(fieldVal).toLowerCase().includes(searchVal);
        });
      }

      return {
        type: 'projects',
        data: filtered.slice(0, limit),
        total: filtered.length,
        showing: Math.min(filtered.length, limit)
      };
    }

    case 'show_statistics': {
      const { group_by } = args;
      const counts = {};

      projects.forEach(p => {
        const val = p[group_by] || 'Not specified';
        counts[val] = (counts[val] || 0) + 1;
      });

      return {
        type: 'stats',
        group_by,
        data: Object.entries(counts).map(([label, count]) => ({ label, count }))
      };
    }

    default:
      return null;
  }
};

const buildSystemPrompt = (relevantProjects) => {
  const fields = projects.length > 0 ? Object.keys(projects[0]).join(', ') : 'No data loaded';

  return `You are an AI assistant for analyzing project data from an Excel file. You ONLY help with project-related questions.

## IMPORTANT: Scope Restriction
- You ONLY answer questions about the loaded projects
- For off-topic questions, politely decline and redirect to project topics

## Available Fields
${fields}

## Relevant Projects (${relevantProjects.length} of ${projects.length} total)
${JSON.stringify(relevantProjects, null, 2)}

## Tools Available
- show_projects: Display project cards (can filter by any field)
- show_statistics: Show statistics grouped by any field

## Guidelines
- Answer questions using the project data provided
- Use tools when user asks to "show", "list", or "display"
- Use show_statistics when user asks for counts, summary, or breakdown`;
};

// Serve the standalone UI
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/excel-agent.html'));
});

// Upload Excel file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    const headers = [];
    const data = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(String(cell.value || '').toLowerCase().replace(/\s+/g, '_'));
        });
      } else {
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            rowData[header] = cell.value;
          }
        });
        if (Object.keys(rowData).length > 0) {
          data.push(rowData);
        }
      }
    });

    projects = data;
    embeddings = [];

    // Generate embeddings for all projects
    console.log(`Generating embeddings for ${projects.length} projects...`);
    for (let i = 0; i < projects.length; i++) {
      const text = buildProjectText(projects[i]);
      const vector = await generateEmbedding(text);
      if (vector) {
        embeddings.push({ index: i, vector });
      }
      if ((i + 1) % 10 === 0) {
        console.log(`Embedded ${i + 1}/${projects.length} projects`);
      }
    }

    res.json({
      success: true,
      message: `Loaded ${projects.length} projects with ${embeddings.length} embeddings`,
      fields: headers,
      count: projects.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process Excel file', details: error.message });
  }
});

// Chat endpoint with streaming
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (projects.length === 0) {
      return res.status(400).json({ error: 'No data loaded. Please upload an Excel file first.' });
    }

    if (!AZURE_OPENAI_ENDPOINT) {
      return res.status(500).json({ error: 'Azure OpenAI endpoint not configured' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const userQuery = messages[messages.length - 1]?.content || '';
    const relevantProjects = await searchSimilarProjects(userQuery, 10);
    const systemPrompt = buildSystemPrompt(relevantProjects);

    const client = getOpenAIClient();

    const stream = await client.chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    });

    let fullContent = '';
    let toolCalls = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullContent += delta.content;
        res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
            }
            if (tc.function?.name) {
              toolCalls[tc.index].function.name = tc.function.name;
            }
            if (tc.function?.arguments) {
              toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      }
    }

    if (toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      if (toolCall.function.name && toolCall.function.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const richContent = executeFunction(toolCall.function.name, args);

          if (richContent) {
            let textContent = '';
            if (richContent.type === 'projects') {
              textContent = `Found ${richContent.total} project${richContent.total !== 1 ? 's' : ''}${richContent.showing < richContent.total ? ` (showing ${richContent.showing})` : ''}.`;
            } else if (richContent.type === 'stats') {
              textContent = `Here are the statistics by ${richContent.group_by}:`;
            }

            if (textContent && !fullContent) {
              res.write(`data: ${JSON.stringify({ type: 'text', content: textContent })}\n\n`);
            }
            res.write(`data: ${JSON.stringify({ type: 'rich', content: richContent })}\n\n`);
          }
        } catch (e) {
          console.error('Error parsing tool call:', e);
        }
      }
    }

    if (!fullContent && toolCalls.length === 0) {
      res.write(`data: ${JSON.stringify({ type: 'text', content: 'Sorry, I could not generate a response.' })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
    res.end();
  }
});

// Get current data status
router.get('/status', (req, res) => {
  res.json({
    projectsLoaded: projects.length,
    embeddingsGenerated: embeddings.length,
    fields: projects.length > 0 ? Object.keys(projects[0]) : []
  });
});

module.exports = router;
