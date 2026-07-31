const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
const { AzureOpenAI } = require('openai');
const { query, queryAll } = require('../db/database');

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_EMBEDDING_DEPLOYMENT = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-large';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

let embeddingClient = null;

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

const buildProjectText = (project) => {
  const parts = [
    project.name,
    project.description,
    project.usecase_type,
    project.business_division,
    project.business_function,
    project.platform,
    project.current_status,
    project.requester_name,
    project.ai_spoc,
    project.demand_type
  ].filter(Boolean);

  return parts.join(' | ');
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

const updateProjectEmbedding = async (projectId) => {
  const project = await query('SELECT * FROM apps WHERE id = $1', [projectId]);
  if (!project.rows[0]) return;

  const text = buildProjectText(project.rows[0]);
  const embedding = await generateEmbedding(text);

  if (embedding) {
    const vectorStr = `[${embedding.join(',')}]`;
    await query('UPDATE apps SET embedding = $1 WHERE id = $2', [vectorStr, projectId]);
    console.log(`Updated embedding for project: ${project.rows[0].name}`);
  }
};

const generateAllEmbeddings = async () => {
  const projects = await queryAll('SELECT * FROM apps WHERE deleted_at IS NULL AND embedding IS NULL');
  console.log(`Generating embeddings for ${projects.length} projects...`);

  for (const project of projects) {
    await updateProjectEmbedding(project.id);
  }

  console.log('All embeddings generated');
};

const searchSimilarProjects = async (queryText, limit = 5, maxDistance = 0.6) => {
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];

  const vectorStr = `[${embedding.join(',')}]`;

  const result = await query(`
    SELECT *, embedding <=> $1 AS distance
    FROM apps
    WHERE deleted_at IS NULL
      AND embedding IS NOT NULL
      AND embedding <=> $1 < $3
    ORDER BY embedding <=> $1
    LIMIT $2
  `, [vectorStr, limit, maxDistance]);

  return result.rows;
};

module.exports = {
  generateEmbedding,
  updateProjectEmbedding,
  generateAllEmbeddings,
  searchSimilarProjects,
  buildProjectText
};
