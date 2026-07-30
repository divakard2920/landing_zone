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

// T-Shirt Sizing Configuration
const CONFIG = {
  effortWeights: {
    tech_feasibility: 0.15,
    data_block: 0.20,
    dependency_block: 0.15,
    time_to_value: 0.15,
    build_effort: 0.10,
    change_adoption: 0.12,
    rollout_complexity: 0.08,
    risk_compliance: 0.05
  },
  effortThresholds: { XS: 4.5, S: 3.5, M: 2.5, L: 1.75 },
  effortBands: {
    XS: { duration: '< 3 months', cost: '< 100k EUR', midpoint: 50 },
    S: { duration: '3-6 months', cost: '100-250k EUR', midpoint: 175 },
    M: { duration: '6-12 months', cost: '250-600k EUR', midpoint: 425 },
    L: { duration: '12-18 months', cost: '600k - 1.2M EUR', midpoint: 900 },
    XL: { duration: '> 18 months', cost: '> 1.2M EUR', midpoint: 1500 }
  },
  ebitThresholds: { 5: 5.0, 4: 3.5, 3: 2.0, 2: 0.5 },
  quadrantThresholds: { highValue: 3.5, lowEffort: 3.5 }
};

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

const cosineSimilarity = (a, b) => {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const buildProjectText = (project) => {
  return Object.values(project).filter(v => v && typeof v === 'string').join(' | ');
};

const searchSimilarProjects = async (query, limit = 5, threshold = 0.6) => {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding || embeddings.length === 0) return [];

  const scored = embeddings.map((emb, idx) => ({
    project: projects[idx],
    score: cosineSimilarity(queryEmbedding, emb.vector)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter(s => s.score >= threshold)
    .slice(0, limit)
    .map(s => ({ ...s.project, similarity: Math.round(s.score * 100) }));
};

// T-shirt sizing computation
const computeSizing = (scores) => {
  const dataBlock = Math.min(
    scores.data_existence || 5,
    scores.data_access || 5,
    scores.data_quality || 5,
    scores.data_ownership || 5
  );

  const dependencyBlock = Math.min(
    scores.interfaces || 5,
    scores.delivery_dependencies || 5,
    scores.platform_fit || 5
  );

  const effortScore =
    (scores.tech_feasibility || 3) * CONFIG.effortWeights.tech_feasibility +
    dataBlock * CONFIG.effortWeights.data_block +
    dependencyBlock * CONFIG.effortWeights.dependency_block +
    (scores.time_to_value || 3) * CONFIG.effortWeights.time_to_value +
    (scores.build_effort || 3) * CONFIG.effortWeights.build_effort +
    (scores.change_adoption || 3) * CONFIG.effortWeights.change_adoption +
    (scores.rollout_complexity || 3) * CONFIG.effortWeights.rollout_complexity +
    (scores.risk_compliance || 3) * CONFIG.effortWeights.risk_compliance;

  // Knock-out rule
  const allScores = [
    scores.tech_feasibility, scores.data_existence, scores.data_access,
    scores.data_quality, scores.data_ownership, scores.interfaces,
    scores.delivery_dependencies, scores.platform_fit, scores.time_to_value,
    scores.build_effort, scores.change_adoption, scores.rollout_complexity,
    scores.risk_compliance, scores.value_confidence
  ];
  const countOfOnes = allScores.filter(s => s === 1).length;

  let effortSize = 'XL';
  if (effortScore >= CONFIG.effortThresholds.XS) effortSize = 'XS';
  else if (effortScore >= CONFIG.effortThresholds.S) effortSize = 'S';
  else if (effortScore >= CONFIG.effortThresholds.M) effortSize = 'M';
  else if (effortScore >= CONFIG.effortThresholds.L) effortSize = 'L';

  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL'];
  let sizeIndex = sizeOrder.indexOf(effortSize);
  if (countOfOnes >= 2) {
    sizeIndex = Math.max(3, Math.min(4, sizeIndex + 2));
  } else if (countOfOnes === 1) {
    sizeIndex = Math.min(4, sizeIndex + 1);
  }
  effortSize = sizeOrder[sizeIndex];

  const ebitTotal = (scores.efficiency_savings || 0) + (scores.revenue_uplift || 0) + (scores.cost_avoidance || 0);

  let impactScore = 1;
  if (ebitTotal >= CONFIG.ebitThresholds[5]) impactScore = 5;
  else if (ebitTotal >= CONFIG.ebitThresholds[4]) impactScore = 4;
  else if (ebitTotal >= CONFIG.ebitThresholds[3]) impactScore = 3;
  else if (ebitTotal >= CONFIG.ebitThresholds[2]) impactScore = 2;

  const valueConfidence = scores.value_confidence || 3;
  const valueScore = Math.min(impactScore, valueConfidence);

  let valueSize = 'XS';
  if (valueScore >= 5) valueSize = 'XL';
  else if (valueScore >= 4) valueSize = 'L';
  else if (valueScore >= 3) valueSize = 'M';
  else if (valueScore >= 2) valueSize = 'S';

  const isHighValue = valueScore >= CONFIG.quadrantThresholds.highValue;
  const isLowEffort = effortScore >= CONFIG.quadrantThresholds.lowEffort;

  let quadrant;
  if (isHighValue && isLowEffort) quadrant = 'Quick Win';
  else if (isHighValue && !isLowEffort) quadrant = 'Strategic Bet';
  else if (!isHighValue && isLowEffort) quadrant = 'Fill-in';
  else quadrant = 'Reconsider';

  const complianceGate = (scores.risk_compliance || 5) <= 2;

  return {
    type: 'sizing_result',
    effort: {
      size: effortSize,
      score: Math.round(effortScore * 100) / 100,
      duration: CONFIG.effortBands[effortSize].duration,
      cost: CONFIG.effortBands[effortSize].cost
    },
    value: {
      size: valueSize,
      ebit: ebitTotal,
      impactScore,
      valueScore
    },
    quadrant,
    recommendation: getRecommendation(quadrant, complianceGate, effortSize),
    knockOutApplied: countOfOnes > 0 ? `${countOfOnes} score(s) of 1 detected` : null,
    complianceGate
  };
};

const getRecommendation = (quadrant, complianceGate, effortSize) => {
  if (complianceGate) {
    return 'COMPLIANCE REVIEW REQUIRED: Risk/compliance score is critical. Engage legal/compliance team before proceeding.';
  }
  switch (quadrant) {
    case 'Quick Win':
      return 'Strong candidate for immediate prioritization. Low effort with high value - consider fast-tracking.';
    case 'Strategic Bet':
      return 'High value but significant effort required. Needs executive sponsorship and careful planning.';
    case 'Fill-in':
      return 'Low effort but limited value. Consider as backlog filler when capacity allows.';
    case 'Reconsider':
      return 'High effort with low value. Recommend revisiting scope or deprioritizing.';
    default:
      return '';
  }
};

// Tools for the agent
const tools = [
  {
    type: 'function',
    function: {
      name: 'show_projects',
      description: 'Show projects from the portfolio. Use when user asks to see, list, or find projects.',
      parameters: {
        type: 'object',
        properties: {
          filter_status: { type: 'string', description: 'Filter by status' },
          filter_priority: { type: 'string', description: 'Filter by priority' },
          limit: { type: 'number', description: 'Max projects to show (default 10)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_statistics',
      description: 'Show portfolio statistics grouped by a field. Use when user asks for breakdown, summary, or stats.',
      parameters: {
        type: 'object',
        properties: {
          group_by: { type: 'string', description: 'Field to group by (status, priority, division, etc.)' }
        },
        required: ['group_by']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_similar_projects',
      description: 'Search for similar existing projects. Use ONLY ONCE when user FIRST describes a new idea. Do NOT use on follow-up messages, greetings, or questions.',
      parameters: {
        type: 'object',
        properties: {
          idea_description: { type: 'string', description: 'Description of the idea to search for' }
        },
        required: ['idea_description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_scoring_form',
      description: 'Display the scoring form for T-shirt sizing. Use when you have collected enough information about the use case and are ready for the user to score it.',
      parameters: {
        type: 'object',
        properties: {
          idea_name: { type: 'string', description: 'Name of the use case' },
          idea_summary: { type: 'string', description: 'Brief summary of what was discussed' }
        },
        required: ['idea_name']
      }
    }
  }
];

const executeFunction = async (functionName, args) => {
  switch (functionName) {
    case 'show_projects': {
      let filtered = [...projects];
      if (args.filter_status) {
        filtered = filtered.filter(p =>
          String(p.status || '').toLowerCase().includes(args.filter_status.toLowerCase())
        );
      }
      if (args.filter_priority) {
        filtered = filtered.filter(p =>
          String(p.priority || '').toLowerCase().includes(args.filter_priority.toLowerCase())
        );
      }
      const limit = args.limit || 10;
      return {
        type: 'projects',
        projects: filtered.slice(0, limit),
        total: filtered.length,
        showing: Math.min(limit, filtered.length)
      };
    }

    case 'show_statistics': {
      const groupBy = args.group_by || 'status';
      const groups = {};
      projects.forEach(p => {
        const key = String(p[groupBy] || 'Unknown');
        groups[key] = (groups[key] || 0) + 1;
      });
      return {
        type: 'statistics',
        group_by: groupBy,
        data: Object.entries(groups).map(([name, count]) => ({ name, count })),
        total: projects.length
      };
    }

    case 'check_similar_projects': {
      const similar = await searchSimilarProjects(args.idea_description, 5, 0.55);
      return {
        type: 'similar_projects',
        projects: similar,
        found: similar.length,
        search_query: args.idea_description
      };
    }

    case 'show_scoring_form': {
      return {
        type: 'scoring_form',
        idea_name: args.idea_name,
        idea_summary: args.idea_summary || ''
      };
    }

    default:
      return null;
  }
};

const buildSystemPrompt = () => {
  const projectCount = projects.length;

  return `You are Kiwi 2.0, a friendly AI Project Manager assistant.
${projectCount > 0 ? `Portfolio: ${projectCount} projects loaded.` : ''}

HOW TO BEHAVE:
- Have a natural conversation. Listen and respond to what the user actually says.
- Never repeat the same question. If user already answered something, acknowledge it and move on.
- Ask ONE question at a time, not multiple.
- React to user's answers - show you understood before asking more.

FOR PROJECT QUERIES:
Use show_projects or show_statistics tools when user wants to see existing projects.

FOR NEW IDEAS:
When user first describes an idea, use check_similar_projects to find related work.
Then have a conversation to understand:
- The problem and why it matters
- What they want to build
- Expected business value
- How it's solved today
- Data and technical needs
- Risks and dependencies

Also consider: Does this need AI/ML or could simpler approaches work?

When you have enough info, use show_scoring_form to let them evaluate it.

REMEMBER: Be helpful and conversational. Don't interrogate. Build on what user shares.`;
};

// Routes
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/kiwi-agent-v2.html'));
});

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

    console.log(`[Kiwi2] Generating embeddings for ${projects.length} projects...`);
    for (let i = 0; i < projects.length; i++) {
      const text = buildProjectText(projects[i]);
      const vector = await generateEmbedding(text);
      if (vector) {
        embeddings.push({ index: i, vector });
      }
    }
    console.log(`[Kiwi2] Generated ${embeddings.length} embeddings`);

    res.json({
      success: true,
      count: projects.length,
      fields: headers
    });
  } catch (error) {
    console.error('[Kiwi2] Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects', (req, res) => {
  res.json({ count: projects.length, projects });
});

// Compute endpoint - deterministic, no LLM
router.post('/compute', (req, res) => {
  try {
    const scores = req.body;
    const result = computeSizing(scores);
    res.json(result);
  } catch (error) {
    console.error('[Kiwi2] Compute error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoint with streaming
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    if (!AZURE_OPENAI_ENDPOINT) {
      return res.status(500).json({ error: 'Azure OpenAI endpoint not configured' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Check if similar projects search was already done in this conversation
    const alreadySearched = messages.some(m =>
      m.role === 'assistant' &&
      m.content &&
      (m.content.includes('checked our portfolio') ||
       m.content.includes('similar project') ||
       m.content.includes('SIMILAR PROJECTS'))
    );

    // Remove check_similar_projects tool if already used
    const availableTools = alreadySearched
      ? tools.filter(t => t.function.name !== 'check_similar_projects')
      : tools;

    const systemPrompt = buildSystemPrompt();
    const client = getOpenAIClient();

    const stream = await client.chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools: availableTools.length > 0 ? availableTools : undefined,
      tool_choice: availableTools.length > 0 ? 'auto' : undefined,
      temperature: 0.7,
      max_tokens: 1500,
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

    // Execute tool calls
    for (const toolCall of toolCalls) {
      if (toolCall?.function?.name && toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const richContent = await executeFunction(toolCall.function.name, args);

          if (richContent) {
            // For similar_projects with no results, just send text, no card
            if (richContent.type === 'similar_projects' && richContent.found === 0) {
              if (!fullContent) {
                const textMsg = `I checked our portfolio and didn't find any similar projects. This looks like a new area for us! Tell me more about your idea - what problem are you trying to solve?`;
                res.write(`data: ${JSON.stringify({ type: 'text', content: textMsg })}\n\n`);
                fullContent = textMsg;
              }
              continue; // Skip sending the empty card
            }

            if (!fullContent) {
              let textMsg = '';
              if (richContent.type === 'projects') {
                textMsg = `Here are ${richContent.showing} of ${richContent.total} projects:`;
              } else if (richContent.type === 'statistics') {
                textMsg = `Here's the breakdown by ${richContent.group_by}:`;
              } else if (richContent.type === 'similar_projects') {
                textMsg = `I found ${richContent.found} similar project(s) in our portfolio. You might want to connect with these teams:`;
              } else if (richContent.type === 'scoring_form') {
                textMsg = `Great, I think we have enough information. Let's score "${richContent.idea_name}" using our evaluation framework:`;
              }
              if (textMsg) {
                res.write(`data: ${JSON.stringify({ type: 'text', content: textMsg })}\n\n`);
                fullContent = textMsg;
              }
            }
            res.write(`data: ${JSON.stringify({ type: 'rich', content: richContent })}\n\n`);
          }
        } catch (e) {
          console.error('[Kiwi2] Error executing tool:', e);
        }
      }
    }

    if (!fullContent && toolCalls.length === 0) {
      res.write(`data: ${JSON.stringify({ type: 'text', content: "I'm here to help with project queries or new use case intake. What would you like to do?" })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Kiwi2] Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
