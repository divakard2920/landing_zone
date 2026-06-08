import { useState, useEffect } from 'react';
import { api } from '../api';
import { Link, useSearchParams } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import WidgetRenderer from '../components/WidgetRenderer';

const DefaultAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
    <path d="M12 12v10"/>
    <path d="M8 22h8"/>
    <path d="M7 12h10"/>
    <circle cx="12" cy="6" r="1"/>
  </svg>
);

const AppIcon = ({ icon }) => {
  if (!icon) return <DefaultAppIcon />;
  if (icon.startsWith('/uploads')) {
    return <img src={icon} alt="app icon" className="app-icon-img" />;
  }
  return icon;
};

function Landing() {
  const [apps, setApps] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [widgetFilters, setWidgetFilters] = useState({});
  const [doiStages, setDoiStages] = useState([]);

  const getDoiLabel = (stage) => {
    const doi = doiStages.find(d => d.id === stage);
    return doi ? `DOI ${doi.id} - ${doi.label}` : `DOI ${stage}`;
  };

  const formatDate = (dateStr, includeTime = false) => {
    // SQLite stores UTC time, append Z to parse as UTC then convert to local
    const date = new Date(dateStr.replace(' ', 'T') + 'Z');
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(includeTime && { hour: '2-digit', minute: '2-digit' })
    };
    return date.toLocaleDateString('en-US', options);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [doiHistory, setDoiHistory] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'projects';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Project filters
  const [filters, setFilters] = useState({
    doi_stage: '',
    priority: '',
    status: '',
    platform: '',
    division: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('card');

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [feedback, setFeedback] = useState({
    name: '',
    email: '',
    type: 'suggestion',
    subject: '',
    message: '',
    app_id: '',
  });
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    await loadData();
  };

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KBase';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Projects', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const headers = [
      'Project Name', 'Project ID', 'Description', 'DOI Stage', 'Status',
      'Priority', 'Platform', 'Division', 'Function', 'Demand Type',
      'Requester', 'AI SPOC', 'Start Date', 'End Date', 'Budget',
      'AI Skills', 'Team Members'
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00457E' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    filteredApps.forEach(app => {
      const row = worksheet.addRow([
        app.name,
        app.project_id || '',
        app.description || '',
        `DOI ${app.doi_stage || 0}`,
        app.current_status || '',
        app.priority || '',
        app.platform || '',
        app.business_division || '',
        app.business_function || '',
        app.demand_type || '',
        app.requester_name || '',
        app.ai_spoc || '',
        app.start_date || '',
        app.end_date || '',
        app.estimated_costs || '',
        app.ai_skills || '',
        app.team?.map(t => t.role ? `${t.name} (${t.role})` : t.name).join(', ') || '',
      ]);

      row.alignment = { vertical: 'middle', wrapText: true };

      if (app.priority === 'High') {
        row.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      } else if (app.priority === 'Medium') {
        row.getCell(6).font = { color: { argb: 'FFD97706' } };
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else if (app.priority === 'Low') {
        row.getCell(6).font = { color: { argb: 'FF16A34A' } };
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      }
    });

    worksheet.columns = [
      { width: 25 }, { width: 15 }, { width: 40 }, { width: 12 }, { width: 18 },
      { width: 10 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 20 },
      { width: 18 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 25 }, { width: 35 }
    ];

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          if (!cell.fill || cell.fill.fgColor?.argb === undefined) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `KBase_Projects_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useEffect(() => {
    if (selectedApp) {
      api.getDoiHistory(selectedApp.id)
        .then(res => setDoiHistory(res.data))
        .catch(err => console.error('Failed to load DOI history:', err));
    } else {
      setDoiHistory([]);
    }
  }, [selectedApp]);

  const loadData = async () => {
    try {
      const [appsRes, announcementsRes, widgetsRes, doiRes] = await Promise.all([
        api.getApps(),
        api.getAnnouncements(),
        api.getWidgets(),
        api.getDoiStages(),
      ]);
      setApps(appsRes.data);
      setAnnouncements(announcementsRes.data);
      setWidgets(widgetsRes.data);
      setDoiStages(doiRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.submitFeedback(feedback);
      setSubmitted(true);
      setFeedback({ name: '', email: '', type: 'suggestion', subject: '', message: '', app_id: '' });
      setAppSearchQuery('');
      setTimeout(() => {
        setSubmitted(false);
        setShowSupportModal(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSupportChange = (e) => {
    setFeedback({ ...feedback, [e.target.name]: e.target.value });
  };

  // Helper to split comma-separated values and get unique items
  const splitAndUnique = (arr, field) => {
    const values = arr.flatMap(a => (a[field] || '').split(',').map(v => v.trim()).filter(Boolean));
    return [...new Set(values)].sort();
  };

  // Get unique filter options from apps
  const filterOptions = {
    statuses: [...new Set(apps.map(a => a.current_status).filter(Boolean))].sort(),
    platforms: splitAndUnique(apps, 'platform'),
    divisions: splitAndUnique(apps, 'business_division'),
    priorities: ['High', 'Medium', 'Low']
  };

  const filteredApps = apps.filter(app => {
    // Search filter
    const query = searchQuery.toLowerCase();
    const searchFields = [
      app.name,
      app.description,
      app.business_division,
      app.business_function,
      app.requester_name,
      app.ai_spoc,
      app.current_status,
      app.demand_type,
      app.platform,
      app.ai_skills,
      app.project_id,
    ];
    const teamNames = app.team?.map(t => t.name).join(' ') || '';
    const matchesSearch = !searchQuery || searchFields.some(field =>
      field && field.toLowerCase().includes(query)
    ) || teamNames.toLowerCase().includes(query);

    // Apply dropdown filters
    const matchesDoi = !filters.doi_stage || (app.doi_stage || 0) === parseInt(filters.doi_stage);
    const matchesPriority = !filters.priority || app.priority === filters.priority;
    const matchesStatus = !filters.status || app.current_status === filters.status;
    const matchesPlatform = !filters.platform || (app.platform || '').split(',').map(v => v.trim()).includes(filters.platform);
    const matchesDivision = !filters.division || (app.business_division || '').split(',').map(v => v.trim()).includes(filters.division);

    return matchesSearch && matchesDoi && matchesPriority && matchesStatus && matchesPlatform && matchesDivision;
  }).sort((a, b) => {
    if (a.created_at && b.created_at) {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return a.id - b.id;
  });

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  const clearFilters = () => {
    setFilters({ doi_stage: '', priority: '', status: '', platform: '', division: '' });
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="top-header">
        <div className="brand-section">
          <img src="/knorr-bremse.svg" alt="Knorr-Bremse" className="brand-logo" />
          <div className="brand-subtitle">KBase <span className="brand-tagline">| AI Landing Zone</span></div>
        </div>

        {/* Header Tabs */}
        <div className="header-tabs">
          <button
            className={`header-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => { setActiveTab('projects'); setSelectedApp(null); setSearchQuery(''); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
            Projects
          </button>
          <button
            className={`header-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analytics'); setSelectedApp(null); setSearchQuery(''); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18"/>
              <path d="M18 17V9"/>
              <path d="M13 17V5"/>
              <path d="M8 17v-3"/>
            </svg>
            Analytics
          </button>
        </div>

        <div className="header-actions">
          <Link to="/admin" className="admin-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/>
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
              <path d="M12 2v2"/>
              <path d="M12 20v2"/>
              <path d="m4.93 4.93 1.41 1.41"/>
              <path d="m17.66 17.66 1.41 1.41"/>
              <path d="M2 12h2"/>
              <path d="M20 12h2"/>
              <path d="m6.34 17.66-1.41 1.41"/>
              <path d="m19.07 4.93-1.41 1.41"/>
            </svg>
            Admin
          </Link>
        </div>
      </header>

      {/* Announcements Bar */}
      {announcements.length > 0 && (
        <div className="announcements-bar">
          <div className="announcements-scroller">
            <div className="scroller-content">
              {announcements.map((item) => (
                <div key={item.id} className="announcement-ticker-item">
                  <span className={`ticker-badge ${item.type}`}>{item.type}</span>
                  <strong>{item.title}:</strong> {item.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content-full">
        <section className="center-panel-full">
          {/* Stats and Search Row */}
          <div className="stats-search-row">
            <div className="quick-stats left">
              <div className="quick-stat-card">
                <span className="quick-stat-value">{apps.length}</span>
                <span className="quick-stat-label">Total Projects</span>
              </div>
              <div className="quick-stat-card">
                <span className="quick-stat-value">{apps.filter(a => !['Completed', 'Cancelled'].includes(a.current_status)).length}</span>
                <span className="quick-stat-label">Active</span>
              </div>
            </div>

            {/* Search Bar with Filter */}
            <div className="search-filter-wrapper">
              <div className="search-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  className="main-search-input"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) {
                      setSelectedApp(null);
                    }
                  }}
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
              </div>
              <button className={`filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filters
                {activeFiltersCount > 0 && <span className="filter-count">{activeFiltersCount}</span>}
              </button>
              <button className="action-btn" onClick={handleRefresh} data-tooltip-id="tooltip" data-tooltip-content="Refresh data">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                </svg>
              </button>
              <button className="action-btn" onClick={handleExport} data-tooltip-id="tooltip" data-tooltip-content="Export to Excel">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
                  onClick={() => setViewMode('card')}
                  data-tooltip-id="tooltip"
                  data-tooltip-content="Card View"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  data-tooltip-id="tooltip"
                  data-tooltip-content="Table View"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="filter-panel">
                <div className="filter-row">
                  <select
                    value={filters.doi_stage}
                    onChange={(e) => setFilters({...filters, doi_stage: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All DOI Stages</option>
                    {doiStages.map(stage => (
                      <option key={stage.id} value={stage.id}>DOI {stage.id} - {stage.label}</option>
                    ))}
                  </select>

                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters({...filters, priority: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All Priorities</option>
                    {filterOptions.priorities.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>

                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All Statuses</option>
                    {filterOptions.statuses.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={filters.platform}
                    onChange={(e) => setFilters({...filters, platform: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All Platforms</option>
                    {filterOptions.platforms.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>

                  <select
                    value={filters.division}
                    onChange={(e) => setFilters({...filters, division: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All Divisions</option>
                    {filterOptions.divisions.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  {activeFiltersCount > 0 && (
                    <button className="clear-filters" onClick={clearFilters}>× Clear</button>
                  )}
                </div>
              </div>
            )}
            </div>

            <div className="quick-stats right">
              <div className="quick-stat-card highlight">
                <span className="quick-stat-value">{apps.filter(a => a.priority === 'High').length}</span>
                <span className="quick-stat-label">High Priority</span>
              </div>
              <div className="quick-stat-card">
                <span className="quick-stat-value">{apps.filter(a => a.doi_stage >= 4).length}</span>
                <span className="quick-stat-label">In Production</span>
              </div>
            </div>
          </div>

          {/* Content Display */}
          {activeTab === 'analytics' ? (
            <>
              {activeFiltersCount > 0 && (
                <div className="results-header">
                  <span className="results-count">Showing analytics for {filteredApps.length} of {apps.length} projects</span>
                </div>
              )}
              <div className="widgets-dashboard">
              {widgets.length > 0 ? (
                widgets.map(widget => (
                  <WidgetRenderer
                    key={widget.id}
                    widget={widget}
                    apps={filteredApps}
                    widgetFilters={widgetFilters}
                    setWidgetFilters={setWidgetFilters}
                    doiStages={doiStages}
                  />
                ))
              ) : (
                <div className="no-widgets-message">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18"/>
                    <path d="M18 17V9"/>
                    <path d="M13 17V5"/>
                    <path d="M8 17v-3"/>
                  </svg>
                  <p>No analytics widgets configured</p>
                  <span style={{ fontSize: '0.85rem' }}>Admins can create widgets from the admin panel</span>
                </div>
              )}
            </div>
            </>
          ) : (
            <>
              {viewMode === 'card' ? (
                <div className="projects-grid">
                  {filteredApps.length > 0 ? (
                    filteredApps.map(app => (
                    <div key={app.id} className="project-card" onClick={() => setSelectedApp(app)} style={{
                        '--doi-color': ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'][app.doi_stage || 0]
                      }}>
                      <div className="project-card-header">
                        <div className="project-card-icon">
                          <AppIcon icon={app.icon} />
                        </div>
                        <div className="project-card-header-right">
                          {(app.start_date || app.end_date) && (
                            <span className="project-card-timeline">{app.start_date || 'TBD'} → {app.end_date || 'TBD'}</span>
                          )}
                          {app.priority && <span className={`priority-badge-sm priority-${app.priority.toLowerCase()}`}>{app.priority}</span>}
                        </div>
                      </div>

                      <div className="doi-progress" style={{
                        '--doi-color': ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'][app.doi_stage || 0]
                      }}>
                        <div className="doi-progress-bar">
                          {[0, 1, 2, 3, 4, 5].map(stage => (
                            <div
                              key={stage}
                              className={`doi-progress-step ${stage <= (app.doi_stage || 0) ? 'active' : ''}`}
                              title={doiStages.find(d => d.id === stage)?.label || `DOI ${stage}`}
                            />
                          ))}
                        </div>
                        <span className="doi-progress-label">DOI {app.doi_stage || 0} - {doiStages.find(d => d.id === (app.doi_stage || 0))?.label || ''}</span>
                      </div>
                      <h4 className="project-card-title">{app.name}</h4>
                      {app.project_id && <span className="project-card-id">#{app.project_id}</span>}

                      <div className="project-card-info">
                        {app.current_status && (
                          <div className="card-info-item">
                            <span className="card-info-label">Status</span>
                            <span className="card-info-value status">{app.current_status}</span>
                          </div>
                        )}
                        {app.platform && (
                          <div className="card-info-item">
                            <span className="card-info-label">Platform</span>
                            <span className="card-info-value">{app.platform}</span>
                          </div>
                        )}
                        {app.business_division && (
                          <div className="card-info-item">
                            <span className="card-info-label">Division</span>
                            <span className="card-info-value">{app.business_division}</span>
                          </div>
                        )}
                        {app.demand_type && (
                          <div className="card-info-item">
                            <span className="card-info-label">Demand Type</span>
                            <span className="card-info-value">{app.demand_type}</span>
                          </div>
                        )}
                        {app.estimated_costs && (
                          <div className="card-info-item">
                            <span className="card-info-label">Budget</span>
                            <span className="card-info-value">{app.estimated_costs}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-projects-message">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect width="7" height="7" x="3" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="14" rx="1"/>
                      <rect width="7" height="7" x="3" y="14" rx="1"/>
                    </svg>
                    <p>{activeFiltersCount > 0 ? 'No matching projects' : 'No projects yet'}</p>
                    <span style={{ fontSize: '0.85rem' }}>
                      {activeFiltersCount > 0 ? 'Try adjusting your filters' : 'Projects will appear here once added by admins'}
                    </span>
                    {activeFiltersCount > 0 && (
                      <button className="btn btn-outline btn-sm" style={{ marginTop: '12px' }} onClick={clearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}
                </div>
              ) : (
                <div className="projects-table-container">
                  {filteredApps.length > 0 ? (
                    <table className="projects-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>DOI Stage</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Division</th>
                          <th>Platform</th>
                          <th>Timeline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApps.map(app => (
                          <tr key={app.id} onClick={() => setSelectedApp(app)} className="projects-table-row">
                            <td>
                              <div className="table-project-cell">
                                <div className="table-project-icon">
                                  <AppIcon icon={app.icon} />
                                </div>
                                <div className="table-project-info">
                                  <span className="table-project-name">{app.name}</span>
                                  {app.project_id && <span className="table-project-id">#{app.project_id}</span>}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="doi-badge" style={{
                                '--doi-color': ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'][app.doi_stage || 0]
                              }}>
                                DOI {app.doi_stage || 0}
                              </span>
                            </td>
                            <td><span className="status-text">{app.current_status || '-'}</span></td>
                            <td>
                              {app.priority ? (
                                <span className={`priority-badge-sm priority-${app.priority.toLowerCase()}`}>{app.priority}</span>
                              ) : '-'}
                            </td>
                            <td>{app.business_division || '-'}</td>
                            <td>{app.platform || '-'}</td>
                            <td className="timeline-cell">
                              {app.start_date || app.end_date ? (
                                <span>{app.start_date || 'TBD'} → {app.end_date || 'TBD'}</span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-projects-message">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect width="7" height="7" x="3" y="3" rx="1"/>
                        <rect width="7" height="7" x="14" y="3" rx="1"/>
                        <rect width="7" height="7" x="14" y="14" rx="1"/>
                        <rect width="7" height="7" x="3" y="14" rx="1"/>
                      </svg>
                      <p>{activeFiltersCount > 0 ? 'No matching projects' : 'No projects yet'}</p>
                      <span style={{ fontSize: '0.85rem' }}>
                        {activeFiltersCount > 0 ? 'Try adjusting your filters' : 'Projects will appear here once added by admins'}
                      </span>
                      {activeFiltersCount > 0 && (
                        <button className="btn btn-outline btn-sm" style={{ marginTop: '12px' }} onClick={clearFilters}>
                          Clear Filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Project Detail Slider */}
      {selectedApp && (
        <>
          <div className="slider-overlay" onClick={() => setSelectedApp(null)} />
          <div className="project-slider">
            <div className="slider-header">
              <div className="slider-header-left">
                <div className="detail-icon">
                  <AppIcon icon={selectedApp.icon} />
                </div>
                <div className="slider-title-block">
                  <h2>{selectedApp.name}</h2>
                  {selectedApp.project_id && <span className="project-id-label">#{selectedApp.project_id}</span>}
                </div>
              </div>
              <button className="slider-close" onClick={() => setSelectedApp(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* DOI Progress Section */}
            {selectedApp.doi_stage !== undefined && (
              <div className="slider-doi-section" style={{
                '--doi-color': ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'][selectedApp.doi_stage || 0]
              }}>
                <div className="slider-doi-progress">
                  {[0, 1, 2, 3, 4, 5].map(stage => (
                    <div
                      key={stage}
                      className={`slider-doi-step ${stage <= (selectedApp.doi_stage || 0) ? 'active' : ''} ${stage === selectedApp.doi_stage ? 'current' : ''}`}
                      title={doiStages.find(d => d.id === stage)?.label || `DOI ${stage}`}
                    >
                      <span className="doi-step-num">{stage}</span>
                    </div>
                  ))}
                </div>
                <span className="slider-doi-label">{getDoiLabel(selectedApp.doi_stage)}</span>
              </div>
            )}

            <div className="slider-badges">
              {selectedApp.current_status && (
                <span className="status-badge">{selectedApp.current_status}</span>
              )}
              {selectedApp.priority && (
                <span className={`priority-badge priority-${selectedApp.priority.toLowerCase()}`}>{selectedApp.priority}</span>
              )}
            </div>

            <div className="slider-content">
              {/* Info Cards */}
              <div className="slider-info-cards">
                {selectedApp.business_division && (
                  <div className="info-card">
                    <div className="info-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">Division</span>
                      <span className="info-card-value">{selectedApp.business_division}</span>
                    </div>
                  </div>
                )}
                {selectedApp.business_function && (
                  <div className="info-card">
                    <div className="info-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">Function</span>
                      <span className="info-card-value">{selectedApp.business_function}</span>
                    </div>
                  </div>
                )}
                {selectedApp.requester_name && (
                  <div className="info-card">
                    <div className="info-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">Requester</span>
                      <span className="info-card-value">{selectedApp.requester_name}</span>
                    </div>
                  </div>
                )}
                {selectedApp.ai_spoc && (
                  <div className="info-card">
                    <div className="info-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M12 12v10"/><path d="M8 22h8"/><path d="M7 12h10"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">AI SPOC</span>
                      <span className="info-card-value">{selectedApp.ai_spoc}</span>
                    </div>
                  </div>
                )}
                {selectedApp.platform && (
                  <div className="info-card">
                    <div className="info-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">Platform</span>
                      <span className="info-card-value">{selectedApp.platform}</span>
                    </div>
                  </div>
                )}
                {selectedApp.demand_type && (
                  <div className="info-card">
                    <div className="info-card-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">Demand Type</span>
                      <span className="info-card-value">{selectedApp.demand_type}</span>
                    </div>
                  </div>
                )}
                {selectedApp.estimated_costs && (
                  <div className="info-card">
                    <div className="info-card-icon accent">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">Est. Budget</span>
                      <span className="info-card-value highlight">{selectedApp.estimated_costs}</span>
                    </div>
                  </div>
                )}
                {(selectedApp.start_date || selectedApp.end_date) && (
                  <div className="info-card">
                    <div className="info-card-icon accent">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                      </svg>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-label">Timeline</span>
                      <span className="info-card-value">{selectedApp.start_date || 'TBD'} → {selectedApp.end_date || 'TBD'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Info Section */}
              {(selectedApp.ai_skills || selectedApp.strategic_focus || selectedApp.category || selectedApp.last_status) && (
                <div className="slider-additional-info">
                  {selectedApp.ai_skills && (
                    <div className="additional-item">
                      <span className="additional-label">AI Skills</span>
                      <span className="additional-value">{selectedApp.ai_skills}</span>
                    </div>
                  )}
                  {selectedApp.strategic_focus && (
                    <div className="additional-item">
                      <span className="additional-label">Strategic Focus</span>
                      <span className="additional-value">{selectedApp.strategic_focus}</span>
                    </div>
                  )}
                  {selectedApp.category && (
                    <div className="additional-item">
                      <span className="additional-label">Category</span>
                      <span className="additional-value">{selectedApp.category}</span>
                    </div>
                  )}
                  {selectedApp.last_status && (
                    <div className="additional-item">
                      <span className="additional-label">Last Status</span>
                      <span className="additional-value">{selectedApp.last_status}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedApp.description && (
                <div className="slider-section">
                  <h4>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
                    </svg>
                    Description
                  </h4>
                  <p>{selectedApp.description}</p>
                </div>
              )}

              {/* Risks */}
              {selectedApp.risks && (
                <div className="slider-section">
                  <h4 className="risks-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                    </svg>
                    Risks
                  </h4>
                  <p className="risks-text">{selectedApp.risks}</p>
                </div>
              )}

              {/* Dependencies */}
              {selectedApp.dependencies && (
                <div className="slider-section">
                  <h4 className="dependencies-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="16 3 21 3 21 8"/><line x1="4" x2="21" y1="20" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" x2="21" y1="15" y2="21"/><line x1="4" x2="9" y1="4" y2="4"/>
                    </svg>
                    Dependencies
                  </h4>
                  <p className="dependencies-text">{selectedApp.dependencies}</p>
                </div>
              )}

              {/* Team Members */}
              {selectedApp.team && selectedApp.team.length > 0 && (
                <div className="slider-section">
                  <h4>Team Members ({selectedApp.team.length})</h4>
                  <div className="slider-team-grid">
                    {selectedApp.team.map(member => (
                      <div key={member.id} className="slider-team-item">
                        <span className="dash-team-avatar">{member.name.charAt(0).toUpperCase()}</span>
                        <div className="dash-team-info">
                          <span className="dash-team-name">{member.name}</span>
                          {member.role && <span className="dash-team-role">{member.role}</span>}
                          {member.email && (
                            <a href={`mailto:${member.email}`} className="dash-team-email">
                              {member.email}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DOI Stage History */}
              {(doiHistory.length > 0 || selectedApp.created_at) && (
                <div className="slider-section">
                  <h4>DOI Stage Journey</h4>
                  <div className="doi-timeline">
                    {doiHistory.length === 0 || doiHistory[0].from_stage !== null ? (
                      <div className="doi-timeline-item">
                        <div className="doi-timeline-marker">
                          <span className="doi-dot doi-0">0</span>
                          {doiHistory.length > 0 && <div className="doi-timeline-line" />}
                        </div>
                        <div className="doi-timeline-content">
                          <div className="doi-timeline-header">
                            <strong>DOI 0 - {doiStages.find(d => d.id === 0)?.label || 'Ideation'}</strong>
                          </div>
                          <div className="doi-timeline-date">
                            {formatDate(selectedApp.created_at)}
                            <span className="doi-timeline-note">Project Created</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {doiHistory.map((entry, idx) => (
                      <div key={entry.id} className="doi-timeline-item">
                        <div className="doi-timeline-marker">
                          <span className={`doi-dot doi-${entry.to_stage}`}>{entry.to_stage}</span>
                          {idx < doiHistory.length - 1 && <div className="doi-timeline-line" />}
                        </div>
                        <div className="doi-timeline-content">
                          <div className="doi-timeline-header">
                            <strong>DOI {entry.to_stage} - {doiStages.find(d => d.id === entry.to_stage)?.label || ''}</strong>
                          </div>
                          <div className="doi-timeline-date">
                            {formatDate(entry.changed_at, true)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Slider Footer */}
            {selectedApp.url && (
              <div className="slider-footer">
                <a href={selectedApp.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  Launch Application
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Support Button */}
      <button className="support-fab" onClick={() => setShowSupportModal(true)} title="Support / Feedback">
        ?
      </button>

      {/* Support / Feedback Modal */}
      {showSupportModal && (
        <div className="modal-overlay" onClick={() => !loading && setShowSupportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Support & Feedback</h3>
              <button className="close-btn" onClick={() => setShowSupportModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSupportSubmit}>
              {submitted && (
                <div className="success-message">
                  Thank you! Your submission has been received.
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Name</label>
                  <input type="text" name="name" value={feedback.name} onChange={handleSupportChange} className="form-control" placeholder="Optional" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Email</label>
                  <input type="email" name="email" value={feedback.email} onChange={handleSupportChange} className="form-control" placeholder="Optional" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Type</label>
                  <select name="type" value={feedback.type} onChange={handleSupportChange} className="form-control">
                    <option value="suggestion">Suggestion</option>
                    <option value="bug">Bug Report</option>
                    <option value="request">Usecase Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {feedback.type !== 'request' && (
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Related Project</label>
                  <div className="searchable-select">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Select project (Optional)"
                      value={appSearchQuery}
                      onChange={(e) => {
                        setAppSearchQuery(e.target.value);
                        setShowAppDropdown(true);
                        if (!e.target.value) setFeedback({...feedback, app_id: ''});
                      }}
                      onFocus={() => setShowAppDropdown(true)}
                      onBlur={() => setTimeout(() => setShowAppDropdown(false), 150)}
                    />
                    {showAppDropdown && (
                      <div className="searchable-dropdown">
                        {feedback.app_id && (
                          <div
                            className="searchable-option clear-option"
                            onClick={() => {
                              setFeedback({...feedback, app_id: ''});
                              setAppSearchQuery('');
                              setShowAppDropdown(false);
                            }}
                          >
                            Clear selection
                          </div>
                        )}
                        {apps
                          .filter(app => app.name.toLowerCase().includes(appSearchQuery.toLowerCase()))
                          .map(app => (
                            <div
                              key={app.id}
                              className={`searchable-option ${feedback.app_id === app.id ? 'selected' : ''}`}
                              onClick={() => {
                                setFeedback({...feedback, app_id: app.id});
                                setAppSearchQuery(app.name);
                                setShowAppDropdown(false);
                              }}
                            >
                              {app.name}
                            </div>
                          ))
                        }
                        {apps.filter(app => app.name.toLowerCase().includes(appSearchQuery.toLowerCase())).length === 0 && (
                          <div className="searchable-option" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No projects found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>

              <div className="form-group">
                <label>Subject *</label>
                <input type="text" name="subject" value={feedback.subject} onChange={handleSupportChange} className="form-control" required placeholder="Brief summary" />
              </div>

              <div className="form-group">
                <label>Message *</label>
                <textarea name="message" value={feedback.message} onChange={handleSupportChange} className="form-control" required placeholder="Detailed description..." />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowSupportModal(false)} disabled={loading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Tooltip id="tooltip" />
    </div>
  );
}

export default Landing;
