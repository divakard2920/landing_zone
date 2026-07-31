const express = require('express');
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
const { AzureOpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const { queryAll, query } = require('../db/database');
const { searchSimilarProjects } = require('../services/embedding');

const router = express.Router();

// T-Shirt Sizing Configuration
const SIZING_CONFIG = {
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
  ebitThresholds: { 5: 5.0, 4: 3.5, 3: 2.0, 2: 0.5 },
  quadrantThresholds: { highValue: 3.5, lowEffort: 3.5 }
};

// Calculate T-shirt sizing from scores
const calculateTShirtSize = (scores) => {
  const dataBlock = Math.min(
    scores.data_existence || 3, scores.data_access || 3,
    scores.data_quality || 3, scores.data_ownership || 3
  );
  const dependencyBlock = Math.min(
    scores.interfaces || 3, scores.delivery_dependencies || 3, scores.platform_fit || 3
  );

  const effortScore =
    (scores.tech_feasibility || 3) * SIZING_CONFIG.effortWeights.tech_feasibility +
    dataBlock * SIZING_CONFIG.effortWeights.data_block +
    dependencyBlock * SIZING_CONFIG.effortWeights.dependency_block +
    (scores.time_to_value || 3) * SIZING_CONFIG.effortWeights.time_to_value +
    (scores.build_effort || 3) * SIZING_CONFIG.effortWeights.build_effort +
    (scores.change_adoption || 3) * SIZING_CONFIG.effortWeights.change_adoption +
    (scores.rollout_complexity || 3) * SIZING_CONFIG.effortWeights.rollout_complexity +
    (scores.risk_compliance || 3) * SIZING_CONFIG.effortWeights.risk_compliance;

  const allScores = [
    scores.tech_feasibility, scores.data_existence, scores.data_access,
    scores.data_quality, scores.data_ownership, scores.interfaces,
    scores.delivery_dependencies, scores.platform_fit, scores.time_to_value,
    scores.build_effort, scores.change_adoption, scores.rollout_complexity,
    scores.risk_compliance, scores.value_confidence
  ];
  const knockoutCount = allScores.filter(s => s === 1).length;

  let effortSize = 'XL';
  if (effortScore >= SIZING_CONFIG.effortThresholds.XS) effortSize = 'XS';
  else if (effortScore >= SIZING_CONFIG.effortThresholds.S) effortSize = 'S';
  else if (effortScore >= SIZING_CONFIG.effortThresholds.M) effortSize = 'M';
  else if (effortScore >= SIZING_CONFIG.effortThresholds.L) effortSize = 'L';

  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL'];
  let sizeIndex = sizeOrder.indexOf(effortSize);
  if (knockoutCount >= 2) sizeIndex = Math.max(3, Math.min(4, sizeIndex + 2));
  else if (knockoutCount === 1) sizeIndex = Math.min(4, sizeIndex + 1);
  effortSize = sizeOrder[sizeIndex];

  const ebitTotal = (scores.efficiency_savings || 0) + (scores.revenue_uplift || 0) + (scores.cost_avoidance || 0);
  let impactScore = 1;
  if (ebitTotal >= SIZING_CONFIG.ebitThresholds[5]) impactScore = 5;
  else if (ebitTotal >= SIZING_CONFIG.ebitThresholds[4]) impactScore = 4;
  else if (ebitTotal >= SIZING_CONFIG.ebitThresholds[3]) impactScore = 3;
  else if (ebitTotal >= SIZING_CONFIG.ebitThresholds[2]) impactScore = 2;

  const valueConfidence = scores.value_confidence || 3;
  const valueScore = Math.min(impactScore, valueConfidence);

  let valueSize = 'XS';
  if (valueScore >= 5) valueSize = 'XL';
  else if (valueScore >= 4) valueSize = 'L';
  else if (valueScore >= 3) valueSize = 'M';
  else if (valueScore >= 2) valueSize = 'S';

  const isHighValue = valueScore >= SIZING_CONFIG.quadrantThresholds.highValue;
  const isLowEffort = effortScore >= SIZING_CONFIG.quadrantThresholds.lowEffort;
  let quadrant;
  if (isHighValue && isLowEffort) quadrant = 'Quick Win';
  else if (isHighValue && !isLowEffort) quadrant = 'Strategic Bet';
  else if (!isHighValue && isLowEffort) quadrant = 'Fill-in';
  else quadrant = 'Reconsider';

  const complianceGate = (scores.risk_compliance || 5) <= 2;

  let recommendation = complianceGate
    ? 'COMPLIANCE GATE: Risk & Compliance score is low - clear regulatory/legal requirements before proceeding. '
    : '';
  switch (quadrant) {
    case 'Quick Win': recommendation += 'Start now - high value, low effort.'; break;
    case 'Strategic Bet': recommendation += 'Invest selectively - high value but requires de-risking first.'; break;
    case 'Fill-in': recommendation += 'Opportunistic only - proceed with spare capacity.'; break;
    case 'Reconsider': recommendation += 'Stop or rescope - value does not justify effort.'; break;
  }

  return {
    effortScore: Math.round(effortScore * 100) / 100,
    effortSize,
    valueScore,
    valueSize,
    ebitTotal: Math.round(ebitTotal * 100) / 100,
    quadrant,
    complianceGate,
    knockoutCount,
    recommendation
  };
};


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

const getAllProjects = async () => {
  return queryAll(`
    SELECT
      id, name, description, usecase_type, doi_stage, current_status,
      priority, business_division, business_function, platform,
      demand_type, requester_name, ai_spoc, start_date, end_date,
      usecase_identifier, icon
    FROM apps
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `);
};

const getDoiStages = async () => {
  return queryAll('SELECT * FROM doi_stages ORDER BY id');
};

const getRelevantProjects = async (userQuery, limit = 10) => {
  try {
    const results = await searchSimilarProjects(userQuery, limit);
    return results;
  } catch (error) {
    console.error('RAG search failed, falling back to all projects:', error.message);
    const all = await getAllProjects();
    return all.slice(0, limit);
  }
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'show_projects',
      description: 'Display projects as visual cards. Use for showing, listing, or searching projects.',
      parameters: {
        type: 'object',
        properties: {
          filter_type: {
            type: 'string',
            enum: ['doi_stage', 'priority', 'status', 'division', 'usecase_type', 'search', 'all'],
            description: 'Filter type. Use "search" to search by keyword across all fields.'
          },
          filter_value: {
            type: 'string',
            description: 'Value to filter/search by (e.g., "HR", "Finance", "High", "0")'
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
  },
  {
    type: 'function',
    function: {
      name: 'submit_use_case_intake',
      description: 'Submit a new use case intake to the database. Use when all required information has been collected from the user through conversation.',
      parameters: {
        type: 'object',
        properties: {
          idea_name: { type: 'string', description: 'Name of the use case idea' },
          idea_owner: { type: 'string', description: 'Person who owns/proposed the idea' },
          sponsor: { type: 'string', description: 'Business sponsor for the use case' },
          division: { type: 'string', description: 'Business division (e.g., CVS, TBS, ITS, Group)' },
          product_owner: { type: 'string', description: 'Product owner responsible' },
          line_of_business: { type: 'string', description: 'Line of business' },
          motivation: { type: 'string', description: 'Why this use case is needed' },
          description_target: { type: 'string', description: 'What the solution should achieve' },
          value_add: { type: 'string', description: 'Expected business value' },
          problem_evidence: { type: 'string', description: 'Evidence of the problem' },
          solution_maturity: { type: 'string', description: 'Maturity level of proposed solution' },
          value_proof: { type: 'string', description: 'How value will be proven' },
          dependencies_risks: { type: 'string', description: 'Key dependencies and risks' },
          solution_approach: { type: 'string', enum: ['AI Solution', 'IT Solution', 'Hybrid'], description: 'Your analysis of the solution approach' },
          efficiency_savings: { type: 'number', description: 'Cost savings in EUR millions p.a.' },
          revenue_uplift: { type: 'number', description: 'Revenue uplift in EUR millions p.a.' },
          cost_avoidance: { type: 'number', description: 'Cost avoidance in EUR millions p.a.' },
          value_confidence: { type: 'integer', description: 'Confidence in value (1-5)' },
          data_existence: { type: 'integer', description: 'Data exists and complete (1-5)' },
          data_access: { type: 'integer', description: 'Data accessible and legal (1-5)' },
          data_quality: { type: 'integer', description: 'Data quality (1-5)' },
          data_ownership: { type: 'integer', description: 'Clear data ownership (1-5)' },
          tech_feasibility: { type: 'integer', description: 'Technical feasibility (1-5)' },
          interfaces: { type: 'integer', description: 'Interface complexity (1-5)' },
          delivery_dependencies: { type: 'integer', description: 'Dependencies on other projects (1-5)' },
          platform_fit: { type: 'integer', description: 'Fits target architecture (1-5)' },
          time_to_value: { type: 'integer', description: 'Time to first value (1-5)' },
          build_effort: { type: 'integer', description: 'Build effort (1-5)' },
          change_adoption: { type: 'integer', description: 'Change management needed (1-5)' },
          rollout_complexity: { type: 'integer', description: 'Rollout complexity (1-5)' },
          risk_compliance: { type: 'integer', description: 'Risk and compliance (1-5)' }
        },
        required: ['idea_name', 'idea_owner', 'division', 'motivation', 'description_target', 'solution_approach']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_use_case_sizing',
      description: 'Calculate T-shirt sizing for a use case based on scores. Use when you have collected scoring parameters from user.',
      parameters: {
        type: 'object',
        properties: {
          efficiency_savings: { type: 'number' },
          revenue_uplift: { type: 'number' },
          cost_avoidance: { type: 'number' },
          value_confidence: { type: 'integer' },
          data_existence: { type: 'integer' },
          data_access: { type: 'integer' },
          data_quality: { type: 'integer' },
          data_ownership: { type: 'integer' },
          tech_feasibility: { type: 'integer' },
          interfaces: { type: 'integer' },
          delivery_dependencies: { type: 'integer' },
          platform_fit: { type: 'integer' },
          time_to_value: { type: 'integer' },
          build_effort: { type: 'integer' },
          change_adoption: { type: 'integer' },
          rollout_complexity: { type: 'integer' },
          risk_compliance: { type: 'integer' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_intake_summary',
      description: 'Display a summary card of collected use case information before final submission.',
      parameters: {
        type: 'object',
        properties: {
          idea_name: { type: 'string' },
          division: { type: 'string' },
          motivation: { type: 'string' },
          description_target: { type: 'string' },
          solution_approach: { type: 'string', enum: ['AI Solution', 'IT Solution', 'Hybrid'], description: 'Your analysis of whether this is AI/IT/Hybrid' },
          sizing_preview: { type: 'object', description: 'Preview sizing results' }
        },
        required: ['idea_name', 'solution_approach']
      }
    }
  }
];

const executeFunction = async (functionName, args, context) => {
  const { doiStages } = context;
  const projects = await getAllProjects();

  switch (functionName) {
    case 'show_projects': {
      let filtered = [...projects];
      const { filter_type, filter_value, limit = 10 } = args;

      if (filter_type !== 'all' && filter_value !== undefined) {
        const searchVal = filter_value.toLowerCase();
        switch (filter_type) {
          case 'doi_stage':
            filtered = filtered.filter(p => String(p.doi_stage) === String(filter_value));
            break;
          case 'priority':
            filtered = filtered.filter(p => p.priority?.toLowerCase() === searchVal);
            break;
          case 'status':
            filtered = filtered.filter(p => p.current_status?.toLowerCase().includes(searchVal));
            break;
          case 'division':
            filtered = filtered.filter(p => p.business_division?.toLowerCase().includes(searchVal));
            break;
          case 'usecase_type':
            filtered = filtered.filter(p => p.usecase_type?.toLowerCase().includes(searchVal));
            break;
          case 'search':
            // Try semantic search first
            try {
              const semanticResults = await searchSimilarProjects(filter_value, limit, { minSimilarity: 0.65 });
              if (semanticResults.length > 0) {
                filtered = semanticResults;
                break;
              }
            } catch (err) {
              console.error('Semantic search failed:', err.message);
            }
            // Fallback to word-boundary keyword search
            const escapedSearch = searchVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchPattern = new RegExp(`\\b${escapedSearch}\\b`, 'i');
            filtered = filtered.filter(p => {
              const searchText = [
                p.name, p.description, p.business_division, p.business_function,
                p.current_status, p.usecase_type, p.platform, p.requester_name,
                p.ai_spoc, p.usecase_identifier, p.demand_type
              ].filter(Boolean).join(' ');
              return searchPattern.test(searchText);
            });
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

    case 'submit_use_case_intake': {
      const id = uuidv4();
      const sizing = calculateTShirtSize(args);
      const solutionApproach = args.solution_approach || 'To Be Determined';

      try {
        await query(`
          INSERT INTO use_case_intake (
            id, idea_name, idea_owner, sponsor, division, product_owner, line_of_business,
            motivation, description_target, value_add, problem_evidence, solution_maturity,
            value_proof, dependencies_risks, efficiency_savings, revenue_uplift, cost_avoidance,
            value_confidence, data_existence, data_access, data_quality, data_ownership,
            tech_feasibility, interfaces, delivery_dependencies, platform_fit, time_to_value,
            build_effort, change_adoption, rollout_complexity, risk_compliance,
            effort_score, effort_size, value_score, value_size, ebit_total, quadrant,
            compliance_gate, knockout_count, solution_approach, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
            $32, $33, $34, $35, $36, $37, $38, $39, $40, $41
          )
        `, [
          id,
          args.idea_name,
          args.idea_owner || null,
          args.sponsor || null,
          args.division || null,
          args.product_owner || null,
          args.line_of_business || null,
          args.motivation || null,
          args.description_target || null,
          args.value_add || null,
          args.problem_evidence || null,
          args.solution_maturity || null,
          args.value_proof || null,
          args.dependencies_risks || null,
          args.efficiency_savings || 0,
          args.revenue_uplift || 0,
          args.cost_avoidance || 0,
          args.value_confidence || 3,
          args.data_existence || 3,
          args.data_access || 3,
          args.data_quality || 3,
          args.data_ownership || 3,
          args.tech_feasibility || 3,
          args.interfaces || 3,
          args.delivery_dependencies || 3,
          args.platform_fit || 3,
          args.time_to_value || 3,
          args.build_effort || 3,
          args.change_adoption || 3,
          args.rollout_complexity || 3,
          args.risk_compliance || 3,
          sizing.effortScore,
          sizing.effortSize,
          sizing.valueScore,
          sizing.valueSize,
          sizing.ebitTotal,
          sizing.quadrant,
          sizing.complianceGate,
          sizing.knockoutCount,
          solutionApproach,
          'Submitted'
        ]);

        return {
          type: 'intake_submitted',
          data: {
            id,
            idea_name: args.idea_name,
            division: args.division,
            solution_approach: solutionApproach,
            sizing: sizing
          }
        };
      } catch (error) {
        console.error('Error submitting use case intake:', error);
        return {
          type: 'intake_error',
          error: error.message
        };
      }
    }

    case 'calculate_use_case_sizing': {
      const sizing = calculateTShirtSize(args);
      return {
        type: 'sizing_result',
        data: sizing
      };
    }

    case 'show_intake_summary': {
      return {
        type: 'intake_summary',
        data: {
          idea_name: args.idea_name,
          division: args.division,
          motivation: args.motivation,
          description_target: args.description_target,
          solution_approach: args.solution_approach,
          sizing_preview: args.sizing_preview
        }
      };
    }

    default:
      return null;
  }
};

const buildSystemPrompt = (relevantProjects, doiStages, totalCount) => {
  return `You are an AI assistant for KBase, the AI Projects Portal. You help users with project information AND new use case intake.

## IMPORTANT: Scope Restriction
- You help with projects, AI initiatives, DOI stages, project status, analytics, and KBase-related topics
- You also help users submit NEW use case ideas through conversational intake
- For ANY off-topic questions (sports, weather, general knowledge, coding help, etc.), politely decline and redirect

## DOI Stages Reference
${JSON.stringify(doiStages, null, 2)}

## Relevant Projects (${relevantProjects.length} of ${totalCount} total)
${JSON.stringify(relevantProjects, null, 2)}

## Tools Available
- show_projects: Display project cards with visual UI
- show_statistics: Display analytics/charts
- show_project_detail: Show single project details
- submit_use_case_intake: Submit a new use case to the database
- calculate_use_case_sizing: Calculate T-shirt sizing from scores
- classify_solution_approach: Classify as AI/IT/Hybrid solution

## USE CASE INTAKE FLOW
When user wants to submit a new idea or use case, guide them conversationally:

**Step 1 - Basic Info** (collect naturally through conversation):
- Idea Name: What should we call this use case?
- Idea Owner: Who is proposing this?
- Division: Which business division? (CVS, TBS, ITS, Group, etc.)
- Sponsor: Who is the business sponsor?
- Product Owner: Who will own the product?
- Line of Business: Which LOB does this serve?

**Step 2 - Details** (understand the use case):
- Motivation: Why is this needed? What problem are we solving?
- Description/Target: What should the solution achieve?
- Value Add: What business value will it deliver?
- Problem Evidence: What evidence shows this problem exists?
- Solution Maturity: Is there a known solution approach?
- Value Proof: How will we prove the value?
- Dependencies/Risks: Any key dependencies or risks?

**Step 3 - Value Scoring** (ask about expected benefits):
- Efficiency Savings: Cost savings in EUR millions p.a.
- Revenue Uplift: Revenue increase in EUR millions p.a.
- Cost Avoidance: Costs avoided in EUR millions p.a.
- Value Confidence: Present these options:
  5 = Value already proven with baseline measurements or production evidence
  4 = Strong benchmark, internal evidence or comparable use case exists
  3 = Benefit plausible but key assumptions still unvalidated
  2 = Value mostly estimated; baseline unclear
  1 = No quantified value or no value owner

**Step 4 - Data & Technical Scoring** (present options and let user choose):

DATA READINESS:
- Data Existence & Completeness:
  5 = All critical data exists with right granularity and sufficient history
  4 = Core data exists; only minor peripheral gaps
  3 = Core data exists but relevant gaps in periods, locations or fields
  2 = Major data parts missing or fragmented across silos
  1 = Data largely does not exist; paper, unstructured or tribal knowledge

- Data Access & Legal Usability:
  5 = Data accessible for AI use; permissions, legal basis and security clear
  4 = Access mostly clear; minor approval steps needed
  3 = Access path exists but approvals/security review required
  2 = Access unclear or restricted; legal/security issues likely
  1 = Data cannot be used for this purpose under current constraints

- Data Quality:
  5 = Quality measured and good; data trusted and already productively used
  4 = Quality known and acceptable; limited cleansing/mapping required
  3 = Quality not measured; sampling shows inconsistencies
  2 = Quality poor; duplicates, inconsistencies, missing stewardship
  1 = Quality so poor that re-collection may be cheaper than cleansing

- Data Ownership & Governance:
  5 = Data owner, steward, definitions and refresh rhythm clearly defined
  4 = Owner and refresh rhythm known; minor definition gaps
  3 = Owner exists but definitions or stewardship are incomplete
  2 = Ownership unclear; no reliable refresh or issue handling
  1 = No accountable owner or governance model

TECHNICAL READINESS:
- Tech Feasibility:
  5 = Proven pattern with known solution approach and mature technology
  4 = Well-understood use case; manageable accuracy/performance risk
  3 = Some tech uncertainty; validation required
  2 = Significant uncertainty; extensive experimentation needed
  1 = No evidence tech can reliably solve the problem

- Technical Interfaces:
  5 = Standalone; no interfaces
  4 = 1-2 standard interfaces to modern systems
  3 = 3-5 interfaces or one batch legacy integration
  2 = Several interfaces incl. core legacy such as ERP/MES
  1 = More than 5 interfaces incl. real-time core legacy

- Delivery Dependencies:
  5 = No dependency on other use cases or planned enablers
  4 = Uses shared enablers already in production
  3 = Depends on committed enabler/use case; sequencing required
  2 = One blocking dependency on unbuilt enabler or not-started use case
  1 = Multiple blocking dependencies in a chain

- Platform / Architecture Fit:
  5 = Fits existing target architecture and approved platforms
  4 = Minor architecture adjustments required
  3 = Architecture decision required but options are clear
  2 = New platform/component likely required
  1 = Conflicts with target architecture or requires major platform decision

**Step 5 - Effort & Risk Scoring**:
- Time-to-Value:
  5 = First measurable value in production in 3 months or less
  4 = First measurable value in production in 3-6 months
  3 = First measurable value in production in 6-12 months
  2 = First measurable value in production in 12-18 months
  1 = First measurable value in production after more than 18 months

- Build Effort:
  5 = Small configuration or light build; existing components reused
  4 = Moderate build with limited custom development
  3 = Several components or model pipelines to build
  2 = Large build across multiple teams
  1 = Major program-level build effort

- Change & Adoption:
  5 = No process/method/tool change; adoption is tool activation
  4 = No process/method change, tool change only; limited training
  3 = Process change + tool change; training and process adjustments required
  2 = Process + method + tool change; fundamental changes, change program needed
  1 = New process, new method, new tool; dedicated change program needed

- Rollout Complexity:
  5 = Single team / <10 users
  4 = One department / 10-50 users
  3 = Function or BU / 50-250 users
  2 = Division or multiple sites / 250-1,000 users
  1 = Enterprise-wide / >1,000 users

- Risk & Compliance:
  5 = No personal, customer, regulated or safety-critical data/use
  4 = Internal data only; low security or legal complexity
  3 = Sensitive internal data or standard security/privacy review needed
  2 = Personal/customer/regulated data or works council/legal review likely
  1 = High-risk or regulated AI use requiring extensive approval or redesign

**Step 6 - Review & Submit**:
After collecting info, show a summary, calculate sizing, classify as AI/IT/Hybrid, then submit.

IMPORTANT: When asking about scores, present the full description options (not just numbers) so users can understand what each level means.

## SOLUTION APPROACH CLASSIFICATION (AI / IT / Hybrid)
Analyze the use case through conversation and determine the appropriate approach:

**AI Solution** - Use case requires:
- Learning from data patterns (prediction, forecasting, anomaly detection)
- Understanding unstructured content (text, images, documents, speech)
- Making intelligent decisions that improve over time
- Automation that requires human-like reasoning or judgment
- Examples: Demand forecasting, document classification, chatbots, quality inspection with computer vision, recommendation engines

**IT Solution** - Use case can be solved with:
- Standard software/tools (dashboards, reports, workflows)
- System integrations and data pipelines
- Process automation with clear rules (no learning needed)
- Database/infrastructure work
- Examples: BI dashboards, ERP integration, data migration, workflow automation, portal development

**Hybrid** - Use case needs both:
- AI capabilities embedded in IT infrastructure
- ML models deployed within business applications
- Examples: AI-powered search in a portal, predictive analytics dashboard, intelligent document processing system

Ask clarifying questions to understand:
- What decisions/actions need to be made?
- Is there a need to learn from data or just process it?
- Are there patterns to discover or known rules to follow?
- Is human-like understanding (language, vision) required?

## INTAKE CONVERSATION STYLE
- Be conversational, not form-like
- Group related questions naturally
- If user provides info proactively, acknowledge and move on
- Analyze the use case to determine AI/IT/Hybrid through understanding, not keywords
- Use calculate_use_case_sizing to preview results before submitting
- Only call submit_use_case_intake when all required fields are collected

## When to Use Tools vs Text
USE TOOLS only when user explicitly asks to "show", "list", "display" OR for intake submission
USE TEXT for explanations, Q&A, and conversational intake questions

## Guidelines
- Answer questions using the relevant projects provided
- For intake, guide users step by step naturally
- If data is null/empty, say "not specified"`;
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

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const userQuery = messages[messages.length - 1]?.content || '';
    const doiStages = await getDoiStages();
    const allProjects = await getAllProjects();
    const relevantProjects = await getRelevantProjects(userQuery, 10);

    const systemPrompt = buildSystemPrompt(relevantProjects, doiStages, allProjects.length);

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
    let currentToolCall = null;

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

    // Process tool calls if any
    if (toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      if (toolCall.function.name && toolCall.function.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const richContent = await executeFunction(toolCall.function.name, args, { doiStages });

          if (richContent) {
            let textContent = '';
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
                break;
              case 'intake_submitted':
                textContent = `Use case "${richContent.data.idea_name}" has been submitted successfully! Classified as: ${richContent.data.solution_approach}. Quadrant: ${richContent.data.sizing.quadrant}, Effort: ${richContent.data.sizing.effortSize}, Value: ${richContent.data.sizing.valueSize}.`;
                break;
              case 'intake_error':
                textContent = `Error submitting use case: ${richContent.error}`;
                break;
              case 'sizing_result':
                textContent = `T-Shirt Sizing: Effort ${richContent.data.effortSize} (score: ${richContent.data.effortScore}), Value ${richContent.data.valueSize} (score: ${richContent.data.valueScore}). Quadrant: ${richContent.data.quadrant}. ${richContent.data.recommendation}`;
                break;
              case 'intake_summary':
                textContent = `Summary for "${richContent.data.idea_name}" - Classified as: ${richContent.data.solution_approach}`;
                break;
            }

            if (textContent && !fullContent) {
              res.write(`data: ${JSON.stringify({ type: 'text', content: textContent })}\n\n`);
            }

            if (richContent.type !== 'not_found') {
              res.write(`data: ${JSON.stringify({ type: 'rich', content: richContent })}\n\n`);
            }
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
    console.error('Agent chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
    res.end();
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!AZURE_OPENAI_ENDPOINT,
    deployment: AZURE_OPENAI_DEPLOYMENT
  });
});

router.post('/generate-embeddings', async (req, res) => {
  try {
    const { generateAllEmbeddings } = require('../services/embedding');
    await generateAllEmbeddings();
    res.json({ success: true, message: 'Embeddings generated for all projects' });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({ error: 'Failed to generate embeddings', details: error.message });
  }
});

module.exports = router;
