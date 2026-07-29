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
  effortThresholds: {
    XS: 4.5,
    S: 3.5,
    M: 2.5,
    L: 1.75
  },
  effortBands: {
    XS: { duration: '< 3 months', cost: '< 100k EUR', midpoint: 50 },
    S: { duration: '3-6 months', cost: '100-250k EUR', midpoint: 175 },
    M: { duration: '6-12 months', cost: '250-600k EUR', midpoint: 425 },
    L: { duration: '12-18 months', cost: '600k - 1.2M EUR', midpoint: 900 },
    XL: { duration: '> 18 months', cost: '> 1.2M EUR', midpoint: 1500 }
  },
  ebitThresholds: {
    5: 5.0,
    4: 3.5,
    3: 2.0,
    2: 0.5
  },
  quadrantThresholds: {
    highValue: 3.5,
    lowEffort: 3.5
  }
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

const searchSimilarProjects = async (query, limit = 5, threshold = 0.7) => {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding || embeddings.length === 0) {
    return [];
  }

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

// Calculate T-shirt sizing
const calculateTShirtSize = (scores) => {
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

  // Count how many scores are rated '1' (knock-out rule)
  const allScores = [
    scores.tech_feasibility, scores.data_existence, scores.data_access,
    scores.data_quality, scores.data_ownership, scores.interfaces,
    scores.delivery_dependencies, scores.platform_fit, scores.time_to_value,
    scores.build_effort, scores.change_adoption, scores.rollout_complexity,
    scores.risk_compliance, scores.value_confidence
  ];
  const countOfOnes = allScores.filter(s => s === 1).length;

  // Base effort size from score
  let effortSize = 'XL';
  if (effortScore >= CONFIG.effortThresholds.XS) effortSize = 'XS';
  else if (effortScore >= CONFIG.effortThresholds.S) effortSize = 'S';
  else if (effortScore >= CONFIG.effortThresholds.M) effortSize = 'M';
  else if (effortScore >= CONFIG.effortThresholds.L) effortSize = 'L';

  // Apply knock-out rule: any '1' bumps size up one step, 2+ '1's -> +2 steps (min L)
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL'];
  let sizeIndex = sizeOrder.indexOf(effortSize);
  if (countOfOnes >= 2) {
    sizeIndex = Math.max(3, Math.min(4, sizeIndex + 2)); // +2 steps, minimum L
  } else if (countOfOnes === 1) {
    sizeIndex = Math.min(4, sizeIndex + 1); // +1 step
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

  let quadrant;
  const isHighValue = valueScore >= CONFIG.quadrantThresholds.highValue;
  const isLowEffort = effortScore >= CONFIG.quadrantThresholds.lowEffort;

  if (isHighValue && isLowEffort) quadrant = 'Quick Win';
  else if (isHighValue && !isLowEffort) quadrant = 'Strategic Bet';
  else if (!isHighValue && isLowEffort) quadrant = 'Fill-in';
  else quadrant = 'Reconsider';

  const complianceGate = (scores.risk_compliance || 5) <= 2;

  let recommendation;
  if (complianceGate) {
    recommendation = `COMPLIANCE GATE: Risk & Compliance score is low - clear regulatory/legal requirements before proceeding. `;
  } else {
    recommendation = '';
  }

  switch (quadrant) {
    case 'Quick Win':
      recommendation += 'Start now - high value, low effort.';
      break;
    case 'Strategic Bet':
      recommendation += 'Invest selectively - high value but requires de-risking first.';
      break;
    case 'Fill-in':
      recommendation += 'Opportunistic only - proceed with spare capacity.';
      break;
    case 'Reconsider':
      recommendation += 'Stop or rescope - value does not justify effort.';
      break;
  }

  return {
    effortScore: Math.round(effortScore * 100) / 100,
    effortSize,
    effortBand: CONFIG.effortBands[effortSize],
    valueScore,
    valueSize,
    ebitTotal: Math.round(ebitTotal * 100) / 100,
    impactScore,
    quadrant,
    complianceGate,
    recommendation,
    dataBlock,
    dependencyBlock,
    knockOutCount: countOfOnes
  };
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'show_projects',
      description: 'Display projects as visual cards. Use when user asks to show, list, or display projects.',
      parameters: {
        type: 'object',
        properties: {
          filter_field: { type: 'string', description: 'Field to filter by (e.g., status, division, quadrant)' },
          filter_value: { type: 'string', description: 'Value to filter' },
          limit: { type: 'number', description: 'Max projects to show (default 10)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_statistics',
      description: 'Display statistics/analytics grouped by a field. Use when user asks for counts, summary, breakdown, or distribution.',
      parameters: {
        type: 'object',
        properties: {
          group_by: { type: 'string', description: 'Field to group by for statistics (e.g., status, quadrant, division)' }
        },
        required: ['group_by']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_similar_projects',
      description: 'Search for similar existing projects/use cases in the portfolio using semantic search. Use this when user describes a new idea to check for duplicates, or when searching for related projects.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the use case to search for similar projects'
          }
        },
        required: ['description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_sizing',
      description: 'Calculate T-shirt sizing ONLY when the user has EXPLICITLY confirmed ALL required scores. Do NOT call this with inferred or estimated values. Ask user to confirm each score before calling.',
      parameters: {
        type: 'object',
        properties: {
          efficiency_savings: { type: 'number', description: 'Efficiency & cost savings in EUR millions p.a. - MUST be confirmed by user' },
          revenue_uplift: { type: 'number', description: 'Revenue & margin uplift in EUR millions p.a. - MUST be confirmed by user' },
          cost_avoidance: { type: 'number', description: 'Quantified cost avoidance in EUR millions p.a. - MUST be confirmed by user' },
          value_confidence: { type: 'number', description: 'Value confidence (1-5) - MUST be explicitly confirmed' },
          tech_feasibility: { type: 'number', description: 'Technical feasibility (1-5) - MUST be explicitly confirmed' },
          data_existence: { type: 'number', description: 'Data existence (1-5) - MUST be explicitly confirmed' },
          data_access: { type: 'number', description: 'Data access (1-5) - MUST be explicitly confirmed' },
          data_quality: { type: 'number', description: 'Data quality (1-5) - MUST be explicitly confirmed' },
          data_ownership: { type: 'number', description: 'Data ownership (1-5) - MUST be explicitly confirmed' },
          interfaces: { type: 'number', description: 'Interfaces complexity (1-5) - MUST be explicitly confirmed' },
          delivery_dependencies: { type: 'number', description: 'Delivery dependencies (1-5) - MUST be explicitly confirmed' },
          platform_fit: { type: 'number', description: 'Platform fit (1-5) - MUST be explicitly confirmed' },
          time_to_value: { type: 'number', description: 'Time-to-value (1-5) - MUST be explicitly confirmed' },
          build_effort: { type: 'number', description: 'Build effort (1-5) - MUST be explicitly confirmed' },
          change_adoption: { type: 'number', description: 'Change & adoption (1-5) - MUST be explicitly confirmed' },
          rollout_complexity: { type: 'number', description: 'Rollout complexity (1-5) - MUST be explicitly confirmed' },
          risk_compliance: { type: 'number', description: 'Risk & compliance (1-5) - MUST be explicitly confirmed' }
        },
        required: ['efficiency_savings', 'value_confidence', 'tech_feasibility', 'data_existence', 'data_access', 'data_quality', 'data_ownership', 'interfaces', 'delivery_dependencies', 'platform_fit', 'time_to_value', 'build_effort', 'change_adoption', 'rollout_complexity', 'risk_compliance']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_intake_summary',
      description: 'Display a summary of all collected information about the use case intake.',
      parameters: {
        type: 'object',
        properties: {
          idea_name: { type: 'string' },
          problem_statement: { type: 'string' },
          target_description: { type: 'string' },
          value_proposition: { type: 'string' },
          problem_evidence: { type: 'string' },
          solution_maturity: { type: 'string' },
          business_case: { type: 'string' },
          dependencies_risks: { type: 'string' },
          similar_projects: { type: 'array', items: { type: 'string' } },
          ai_suitability: { type: 'string' },
          sizing_result: { type: 'object' }
        }
      }
    }
  }
];

const executeFunction = async (functionName, args) => {
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

    case 'search_similar_projects': {
      const similar = await searchSimilarProjects(args.description, 5, 0.65);
      return {
        type: 'similar_projects',
        data: similar,
        found: similar.length,
        message: similar.length > 0
          ? `Found ${similar.length} similar project(s) in the portfolio.`
          : 'No similar projects found in the current portfolio.'
      };
    }

    case 'calculate_sizing': {
      const result = calculateTShirtSize(args);
      return {
        type: 'sizing_result',
        ...result
      };
    }

    case 'show_intake_summary': {
      return {
        type: 'intake_summary',
        ...args
      };
    }

    default:
      return null;
  }
};

const buildSystemPrompt = (relevantProjects = []) => {
  const projectCount = projects.length;
  const fields = projectCount > 0 ? Object.keys(projects[0]).join(', ') : 'No data loaded';

  return `You are Kiwi, a friendly AI assistant for project portfolio management.

## Portfolio Data
${projectCount > 0 ? `${projectCount} projects loaded. Fields: ${fields}` : 'No portfolio loaded yet.'}
${relevantProjects.length > 0 ? `\nRelevant projects:\n${JSON.stringify(relevantProjects.slice(0, 3), null, 2)}` : ''}

## Tools Available
- show_projects: Display project cards. Use for "show", "list", "display" requests.
- show_statistics: Show counts by field. Use for "how many", "breakdown", "by status" requests.
- search_similar_projects: Find similar projects by description.
- calculate_sizing: Calculate T-shirt size when you have all scoring data.
- show_intake_summary: Show summary of intake data collected.

## For New Use Case Intake
When user describes a new idea:
1. Understand the problem and expected value (EUR millions)
2. Ask user to rate EACH scoring field explicitly (1-5)
3. ONLY call calculate_sizing after ALL 15 scores are CONFIRMED by user
4. NEVER infer or estimate scores - always ask user to confirm each one

## Required Scores to Collect (all 1-5, 5=best)
- Value: efficiency_savings (EUR M), revenue_uplift (EUR M), cost_avoidance (EUR M), value_confidence
- Data: data_existence, data_access, data_quality, data_ownership
- Tech: tech_feasibility, interfaces, delivery_dependencies, platform_fit
- Effort: time_to_value, build_effort, change_adoption, rollout_complexity, risk_compliance

## CRITICAL Guidelines
- Ask ONE scoring question at a time
- Do NOT infer or assume scores - get explicit user confirmation
- Do NOT call calculate_sizing until user has confirmed ALL required scores
- For off-topic questions, politely redirect`;
};

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/kiwi-agent.html'));
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

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    console.log('Chat request received:', messages?.length, 'messages');

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!AZURE_OPENAI_ENDPOINT) {
      return res.status(500).json({ error: 'Azure OpenAI endpoint not configured' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get user query and search for relevant projects
    const userQuery = messages[messages.length - 1]?.content || '';
    console.log('User query:', userQuery);

    const relevantProjects = projects.length > 0 ? await searchSimilarProjects(userQuery, 3, 0.5) : [];
    console.log('Found', relevantProjects.length, 'relevant projects');

    const systemPrompt = buildSystemPrompt(relevantProjects);
    const client = getOpenAIClient();
    console.log('Calling Azure OpenAI...');

    const stream = await client.chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1500,
      stream: true
    });

    let fullContent = '';
    let toolCalls = [];
    console.log('Stream started');

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

    console.log('Stream ended. Content length:', fullContent.length, 'Tool calls:', toolCalls.length);

    // Execute tool calls
    for (const toolCall of toolCalls) {
      if (toolCall?.function?.name && toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const richContent = await executeFunction(toolCall.function.name, args);

          if (richContent) {
            // Add text explanation for tool results if no text content was streamed
            if (!fullContent) {
              let textMsg = '';
              if (richContent.type === 'projects') {
                textMsg = `Here are ${richContent.showing} of ${richContent.total} projects:`;
              } else if (richContent.type === 'stats') {
                textMsg = `Here's the breakdown by ${richContent.group_by}:`;
              } else if (richContent.type === 'similar_projects') {
                textMsg = richContent.found > 0
                  ? `I found ${richContent.found} similar project(s) in the portfolio:`
                  : 'No similar projects found in the current portfolio.';
              } else if (richContent.type === 'sizing_result') {
                textMsg = `Based on the assessment, here's the T-shirt sizing result:`;
              }
              if (textMsg) {
                res.write(`data: ${JSON.stringify({ type: 'text', content: textMsg })}\n\n`);
                fullContent = textMsg;
              }
            }
            res.write(`data: ${JSON.stringify({ type: 'rich', content: richContent })}\n\n`);
          }
        } catch (e) {
          console.error('Error executing tool:', e);
        }
      }
    }

    if (!fullContent && toolCalls.length === 0) {
      const welcomeMsg = "Hello! I'm Kiwi, your AI Use Case Intake Consultant. Tell me about the idea or problem you're looking to solve with AI, and I'll help you assess it. You can also upload a portfolio Excel file to query existing projects.";
      res.write(`data: ${JSON.stringify({ type: 'text', content: welcomeMsg })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
    res.end();
  }
});

router.get('/status', (req, res) => {
  res.json({
    projectsLoaded: projects.length,
    embeddingsGenerated: embeddings.length,
    fields: projects.length > 0 ? Object.keys(projects[0]) : [],
    configLoaded: true
  });
});

module.exports = router;
