const express = require('express');
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
const { AzureOpenAI } = require('openai');
const { queryAll } = require('../db/database');

const router = express.Router();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

let openaiClient = null;

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

const getProjectsContext = async () => {
  try {
    const projects = await queryAll(`
      SELECT
        id, name, description, usecase_type, doi_stage, current_status,
        priority, business_division, business_function, platform,
        demand_type, requester_name, ai_spoc, start_date, end_date,
        usecase_identifier, icon
      FROM apps
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);

    const doiStages = await queryAll('SELECT * FROM doi_stages ORDER BY id');

    return { projects, doiStages };
  } catch (error) {
    console.error('Error fetching projects context:', error);
    return { projects: [], doiStages: [] };
  }
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'show_projects',
      description: 'Display projects as visual cards. Use this when user asks to show, list, or display projects.',
      parameters: {
        type: 'object',
        properties: {
          filter_type: {
            type: 'string',
            enum: ['doi_stage', 'priority', 'status', 'division', 'usecase_type', 'all'],
            description: 'The type of filter to apply'
          },
          filter_value: {
            type: 'string',
            description: 'The value to filter by (e.g., "0" for DOI 0, "High" for priority)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of projects to show (default 10)'
          }
        },
        required: ['filter_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_statistics',
      description: 'Display statistics/analytics as visual charts or cards. Use when user asks for counts, analytics, summary, or overview.',
      parameters: {
        type: 'object',
        properties: {
          stat_type: {
            type: 'string',
            enum: ['by_doi', 'by_priority', 'by_status', 'by_division', 'by_type', 'overview'],
            description: 'The type of statistics to show'
          }
        },
        required: ['stat_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_project_detail',
      description: 'Display detailed information about a specific project. Use when user asks about a specific project by name.',
      parameters: {
        type: 'object',
        properties: {
          project_name: {
            type: 'string',
            description: 'The name or partial name of the project'
          }
        },
        required: ['project_name']
      }
    }
  }
];

const executeFunction = (functionName, args, context) => {
  const { projects, doiStages } = context;

  switch (functionName) {
    case 'show_projects': {
      let filtered = [...projects];
      const { filter_type, filter_value, limit = 10 } = args;

      if (filter_type !== 'all' && filter_value !== undefined) {
        switch (filter_type) {
          case 'doi_stage':
            filtered = filtered.filter(p => String(p.doi_stage) === String(filter_value));
            break;
          case 'priority':
            filtered = filtered.filter(p => p.priority?.toLowerCase() === filter_value.toLowerCase());
            break;
          case 'status':
            filtered = filtered.filter(p => p.current_status?.toLowerCase().includes(filter_value.toLowerCase()));
            break;
          case 'division':
            filtered = filtered.filter(p => p.business_division?.toLowerCase().includes(filter_value.toLowerCase()));
            break;
          case 'usecase_type':
            filtered = filtered.filter(p => p.usecase_type?.toLowerCase().includes(filter_value.toLowerCase()));
            break;
        }
      }

      return {
        type: 'projects',
        data: filtered.slice(0, limit).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          doi_stage: p.doi_stage,
          doiLabel: doiStages.find(d => d.id === p.doi_stage)?.label || '',
          status: p.current_status,
          priority: p.priority,
          division: p.business_division,
          usecase_type: p.usecase_type,
          usecase_identifier: p.usecase_identifier,
          start_date: p.start_date,
          end_date: p.end_date,
          icon: p.icon
        })),
        total: filtered.length,
        showing: Math.min(filtered.length, limit)
      };
    }

    case 'show_statistics': {
      const { stat_type } = args;

      if (stat_type === 'overview') {
        return {
          type: 'stats_overview',
          data: {
            total: projects.length,
            by_doi: doiStages.map(d => ({
              label: `DOI ${d.id}`,
              name: d.label,
              count: projects.filter(p => p.doi_stage === d.id).length
            })),
            by_priority: ['High', 'Medium', 'Low'].map(p => ({
              label: p,
              count: projects.filter(proj => proj.priority === p).length
            })),
            by_type: ['AI Usecase', 'Foundation'].map(t => ({
              label: t,
              count: projects.filter(p => p.usecase_type === t).length
            }))
          }
        };
      }

      const statMap = {
        by_doi: () => doiStages.map(d => ({
          label: `DOI ${d.id} - ${d.label}`,
          count: projects.filter(p => p.doi_stage === d.id).length
        })),
        by_priority: () => ['High', 'Medium', 'Low'].map(p => ({
          label: p,
          count: projects.filter(proj => proj.priority === p).length
        })),
        by_status: () => {
          const statuses = [...new Set(projects.map(p => p.current_status).filter(Boolean))];
          return statuses.map(s => ({
            label: s,
            count: projects.filter(p => p.current_status === s).length
          }));
        },
        by_division: () => {
          const divisions = [...new Set(projects.map(p => p.business_division).filter(Boolean))];
          return divisions.map(d => ({
            label: d,
            count: projects.filter(p => p.business_division === d).length
          }));
        },
        by_type: () => ['AI Usecase', 'Foundation'].map(t => ({
          label: t,
          count: projects.filter(p => p.usecase_type === t).length
        }))
      };

      return {
        type: 'stats',
        stat_type,
        data: statMap[stat_type]?.() || []
      };
    }

    case 'show_project_detail': {
      const { project_name } = args;
      const project = projects.find(p =>
        p.name.toLowerCase().includes(project_name.toLowerCase()) ||
        p.usecase_identifier?.toLowerCase().includes(project_name.toLowerCase())
      );

      if (!project) {
        return { type: 'not_found', query: project_name };
      }

      return {
        type: 'project_detail',
        data: {
          ...project,
          doiLabel: doiStages.find(d => d.id === project.doi_stage)?.label || ''
        }
      };
    }

    default:
      return null;
  }
};

const buildSystemPrompt = (context) => {
  const { projects, doiStages } = context;

  return `You are an AI assistant for the IT Project Management Portal. You have complete knowledge of all projects and can answer any question about them.

## DOI Stages Reference
${JSON.stringify(doiStages, null, 2)}

## Complete Project Data (${projects.length} projects)
${JSON.stringify(projects, null, 2)}

## Tools Available
- show_projects: Display project cards (use for "show", "list", "display" requests)
- show_statistics: Display analytics/charts (use for counts, summaries, overviews)
- show_project_detail: Show single project details

## Guidelines
- Answer questions using the actual data above
- Use tools for visual displays, text for direct questions
- If data is null/empty, say "not specified" - don't make up information`;
};

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!AZURE_OPENAI_ENDPOINT) {
      return res.status(500).json({ error: 'Azure OpenAI endpoint not configured' });
    }

    const context = await getProjectsContext();
    const systemPrompt = buildSystemPrompt(context);

    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    });

    const choice = response.choices[0];
    const assistantMessage = choice?.message;

    let textContent = assistantMessage?.content || '';
    let richContent = null;

    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      richContent = executeFunction(functionName, args, context);

      if (!textContent && richContent) {
        switch (richContent.type) {
          case 'projects':
            textContent = `Found ${richContent.total} project${richContent.total !== 1 ? 's' : ''}${richContent.showing < richContent.total ? ` (showing ${richContent.showing})` : ''}.`;
            break;
          case 'stats':
          case 'stats_overview':
            textContent = 'Here are the statistics:';
            break;
          case 'project_detail':
            textContent = `Here are the details for ${richContent.data.name}:`;
            break;
          case 'not_found':
            textContent = `I couldn't find a project matching "${richContent.query}". Please check the name and try again.`;
            richContent = null;
            break;
        }
      }
    }

    if (!textContent && !richContent) {
      textContent = 'Sorry, I could not generate a response.';
    }

    res.json({
      message: textContent,
      richContent,
      usage: response.usage
    });

  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat request',
      details: error.message
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!AZURE_OPENAI_ENDPOINT,
    deployment: AZURE_OPENAI_DEPLOYMENT
  });
});

module.exports = router;
