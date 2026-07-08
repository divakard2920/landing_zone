import { useState, useEffect } from 'react';
import { api } from '../api';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Tooltip } from 'react-tooltip';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import WidgetRenderer from '../components/WidgetRenderer';

const AIUsecaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3 4 4.5 4.5 0 0 1-3-4"/>
    <path d="M12 18v4"/>
    <path d="M8 18h8"/>
  </svg>
);

const FoundationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="8.5" y="3" width="7" height="7" rx="1"/>
    <path d="M12 10v4"/>
    <path d="M6.5 14v-2a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2"/>
  </svg>
);

const DefaultAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M12 8v8"/>
    <path d="M8 12h8"/>
  </svg>
);

const AppIcon = ({ icon, usecaseType }) => {
  if (icon && icon.startsWith('/uploads')) {
    return <img src={icon} alt="app icon" className="app-icon-img" />;
  }
  if (icon) return icon;
  if (usecaseType === 'AI Usecase') return <AIUsecaseIcon />;
  if (usecaseType === 'Foundation') return <FoundationIcon />;
  return <DefaultAppIcon />;
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
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
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
  const [allDoiHistory, setAllDoiHistory] = useState([]);
  const [hoveredTimelineProject, setHoveredTimelineProject] = useState(null);
  const [timelineDoiFilter, setTimelineDoiFilter] = useState('all');

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
    division: '',
    usecase_type: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const USECASE_TYPES = ['AI Usecase', 'Foundation'];

  // Available table columns configuration (only fields with admin inputs)
  const allColumns = [
    { key: 'project', label: 'Project', required: true },
    { key: 'usecase_type', label: 'Use Case Type' },
    { key: 'doi_stage', label: 'DOI Stage' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'division', label: 'Division' },
    { key: 'function', label: 'Function' },
    { key: 'platform', label: 'Platform' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'requester', label: 'Requester' },
    { key: 'ai_spoc', label: 'AI SPOC' },
    { key: 'demand_type', label: 'Demand Type' },
    { key: 'estimated_costs', label: 'Estimated Costs' },
  ];

  const defaultColumns = ['project', 'doi_stage', 'status', 'priority', 'division', 'platform', 'timeline'];

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('tableColumns');
    return saved ? JSON.parse(saved) : defaultColumns;
  });

  const toggleColumn = (key) => {
    const column = allColumns.find(c => c.key === key);
    if (column?.required) return;

    const updated = visibleColumns.includes(key)
      ? visibleColumns.filter(k => k !== key)
      : [...visibleColumns, key];
    setVisibleColumns(updated);
    localStorage.setItem('tableColumns', JSON.stringify(updated));
  };

  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('tableColumnWidths');
    return saved ? JSON.parse(saved) : {};
  });

  const handleColumnResize = (key, width) => {
    const updated = { ...columnWidths, [key]: width };
    setColumnWidths(updated);
    localStorage.setItem('tableColumnWidths', JSON.stringify(updated));
  };

  const startResize = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const th = e.target.closest('th');
    const startWidth = th.offsetWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(80, startWidth + (moveEvent.clientX - startX));
      handleColumnResize(key, newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

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
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { theme, toggleTheme } = useTheme();

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortValue = (app, key) => {
    switch (key) {
      case 'project': return app.name?.toLowerCase() || '';
      case 'usecase_type': return app.usecase_type?.toLowerCase() || '';
      case 'doi_stage': return app.doi_stage || 0;
      case 'status': return app.current_status?.toLowerCase() || '';
      case 'priority':
        const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
        return priorityOrder[app.priority?.toLowerCase()] || 999;
      case 'division': return app.business_division?.toLowerCase() || '';
      case 'function': return app.business_function?.toLowerCase() || '';
      case 'platform': return app.platform?.toLowerCase() || '';
      case 'timeline': return app.start_date || '';
      case 'requester': return app.requester_name?.toLowerCase() || '';
      case 'ai_spoc': return app.ai_spoc?.toLowerCase() || '';
      case 'demand_type': return app.demand_type?.toLowerCase() || '';
      case 'estimated_costs': return parseFloat(app.estimated_costs) || 0;
      default: return '';
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showColumnSettings) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.column-settings-wrapper')) {
        setShowColumnSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnSettings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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

  const [doiLoading, setDoiLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      setDoiLoading(true);
      api.getDoiHistory(selectedApp.id)
        .then(res => setDoiHistory(res.data))
        .catch(err => console.error('Failed to load DOI history:', err))
        .finally(() => setDoiLoading(false));
    } else {
      setDoiHistory([]);
    }
  }, [selectedApp]);

  const loadData = async () => {
    try {
      const [appsRes, announcementsRes, widgetsRes, doiRes, allDoiHistoryRes] = await Promise.all([
        api.getApps(),
        api.getAnnouncements(),
        api.getWidgets(),
        api.getDoiStages(),
        api.getAllDoiHistory(),
      ]);
      setApps(appsRes.data);
      setAnnouncements(announcementsRes.data);
      setWidgets(widgetsRes.data);
      setDoiStages(doiRes.data);
      setAllDoiHistory(allDoiHistoryRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.submitFeedback(feedback);
      setFeedback({ name: '', email: '', type: 'suggestion', subject: '', message: '', app_id: '' });
      setAppSearchQuery('');
      setShowSupportModal(false);
      showToast('Thank you! Your feedback has been submitted.', 'success');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      showToast('Failed to submit feedback. Please try again.', 'error');
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
      app.usecase_identifier,
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
    const matchesUsecaseType = !filters.usecase_type || app.usecase_type === filters.usecase_type;

    return matchesSearch && matchesDoi && matchesPriority && matchesStatus && matchesPlatform && matchesDivision && matchesUsecaseType;
  }).sort((a, b) => {
    // If user selected a sort column, use that
    if (sortConfig.key) {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      return sortConfig.direction === 'desc' ? -comparison : comparison;
    }
    // Default sort: by usecase_identifier first (nulls last)
    if (a.usecase_identifier && !b.usecase_identifier) return -1;
    if (!a.usecase_identifier && b.usecase_identifier) return 1;
    if (a.usecase_identifier && b.usecase_identifier) {
      return a.usecase_identifier.localeCompare(b.usecase_identifier);
    }
    // Then by created_at
    if (a.created_at && b.created_at) {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    return 0;
  });

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  const clearFilters = () => {
    setFilters({ doi_stage: '', priority: '', status: '', platform: '', division: '', usecase_type: '' });
  };

  if (pageLoading) {
    return (
      <div className="app-container">
        <header className="top-header">
          <div className="brand-section">
            <div className="skeleton-box" style={{ width: 140, height: 32 }}></div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="skeleton-box" style={{ width: 100, height: 36, borderRadius: 20 }}></div>
            <div className="skeleton-box" style={{ width: 100, height: 36, borderRadius: 20 }}></div>
          </div>
        </header>
        <main className="main-content-full">
          <section className="projects-section">
            <div className="projects-header">
              <div className="skeleton-box" style={{ width: 200, height: 24 }}></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="skeleton-box" style={{ width: 250, height: 44, borderRadius: 10 }}></div>
                <div className="skeleton-box" style={{ width: 100, height: 44, borderRadius: 10 }}></div>
              </div>
            </div>
            <div className="projects-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-box" style={{ width: 40, height: 40, borderRadius: 10 }}></div>
                  <div className="skeleton-box" style={{ width: '60%', height: 12, marginTop: 16 }}></div>
                  <div className="skeleton-box" style={{ width: '80%', height: 18, marginTop: 8 }}></div>
                  <div className="skeleton-box" style={{ width: '100%', height: 8, marginTop: 16, borderRadius: 4 }}></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                    <div className="skeleton-box" style={{ height: 40, borderRadius: 6 }}></div>
                    <div className="skeleton-box" style={{ height: 40, borderRadius: 6 }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

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
            AI Pipeline
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
          <button className={`theme-switch ${theme === 'dark' ? 'dark' : ''}`} onClick={toggleTheme} data-tooltip-id="tooltip" data-tooltip-content={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            <span className="theme-switch-slider">
              <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </span>
          </button>
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
                  placeholder="Search by name, ID (AI_001, F_001), division..."
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
              <button className={`action-btn ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh} disabled={refreshing} data-tooltip-id="tooltip" data-tooltip-content="Refresh data">
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
              {viewMode === 'table' && (
                <div className="column-settings-wrapper">
                  <button
                    className="column-settings-btn"
                    onClick={() => setShowColumnSettings(!showColumnSettings)}
                    data-tooltip-id="tooltip"
                    data-tooltip-content="Customize Columns"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  {showColumnSettings && (
                    <div className="column-settings-dropdown">
                      <div className="column-settings-header">
                        <span>Customize Columns</span>
                        <button className="column-settings-close" onClick={() => setShowColumnSettings(false)}>×</button>
                      </div>
                      <div className="column-settings-list">
                        {allColumns.map(col => (
                          <label key={col.key} className={`column-option ${col.required ? 'disabled' : ''}`}>
                            <input
                              type="checkbox"
                              checked={visibleColumns.includes(col.key)}
                              onChange={() => toggleColumn(col.key)}
                              disabled={col.required}
                            />
                            <span>{col.label}</span>
                            {col.required && <span className="required-badge">Required</span>}
                          </label>
                        ))}
                      </div>
                      <div className="column-settings-footer">
                        <button className="btn btn-sm btn-outline" onClick={() => { setVisibleColumns(defaultColumns); localStorage.setItem('tableColumns', JSON.stringify(defaultColumns)); }}>
                          Reset to Default
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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

                <select
                  value={filters.usecase_type}
                  onChange={(e) => setFilters({...filters, usecase_type: e.target.value})}
                  className="filter-select"
                >
                  <option value="">All Use Case Types</option>
                  {USECASE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                {activeFiltersCount > 0 && (
                  <button className="clear-filters" onClick={clearFilters}>× Clear</button>
                )}
              </div>
            </div>
          )}

          {/* Content Display */}
          {activeTab === 'analytics' ? (
            <>
              {activeFiltersCount > 0 && (
                <div className="results-header">
                  <span className="results-count">Showing analytics for {filteredApps.length} of {apps.length} projects</span>
                </div>
              )}

              {/* Project Timeline Chart */}
              {(() => {
                const projectsWithHistory = filteredApps.filter(app => app.doi_stage >= 0).map(app => {
                  const history = allDoiHistory.filter(h => h.app_id === app.id);
                  const startDate = history.length > 0 ? new Date(history[0].changed_at) : (app.start_date ? new Date(app.start_date) : null);
                  const endDate = app.end_date ? new Date(app.end_date) : null;
                  const progress = ((app.doi_stage || 0) / 5) * 100;
                  return { ...app, history, startDate, endDate, progress };
                }).filter(app => app.startDate);

                if (projectsWithHistory.length === 0) return null;

                const allDates = projectsWithHistory.flatMap(p => [p.startDate, p.endDate || new Date()]).filter(Boolean);
                const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
                const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
                const today = new Date();

                minDate.setMonth(minDate.getMonth() - 1);
                maxDate.setMonth(maxDate.getMonth() + 3);
                if (maxDate < today) maxDate.setTime(today.getTime() + 90 * 24 * 60 * 60 * 1000);

                const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
                const getPosition = (date) => ((date - minDate) / (1000 * 60 * 60 * 24) / totalDays) * 100;

                const months = [];
                const current = new Date(minDate);
                current.setDate(1);
                while (current <= maxDate) {
                  months.push(new Date(current));
                  current.setMonth(current.getMonth() + 1);
                }

                const doiColors = ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'];
                const doiLabels = ['DOI 0', 'DOI 1', 'DOI 2', 'DOI 3', 'DOI 4', 'DOI 5'];

                // Apply DOI filter
                const filteredProjects = timelineDoiFilter === 'all'
                  ? projectsWithHistory
                  : projectsWithHistory.filter(p => p.doi_stage === parseInt(timelineDoiFilter));

                return (
                  <div className="timeline-chart-container" style={{ background: 'var(--bg-panel)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Project Timeline</h3>

                      {/* DOI Stage Filter */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>Filter:</span>
                        <button
                          onClick={() => setTimelineDoiFilter('all')}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            background: timelineDoiFilter === 'all' ? 'var(--brand-primary)' : 'var(--bg-muted)',
                            color: timelineDoiFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 0.15s'
                          }}
                        >
                          All ({projectsWithHistory.length})
                        </button>
                        {[0, 1, 2, 3, 4, 5].map(stage => {
                          const count = projectsWithHistory.filter(p => p.doi_stage === stage).length;
                          return (
                            <button
                              key={stage}
                              onClick={() => setTimelineDoiFilter(stage.toString())}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                background: timelineDoiFilter === stage.toString() ? doiColors[stage] : 'var(--bg-muted)',
                                color: timelineDoiFilter === stage.toString() ? '#fff' : 'var(--text-secondary)',
                                opacity: count === 0 ? 0.5 : 1,
                                transition: 'all 0.15s'
                              }}
                              disabled={count === 0}
                            >
                              DOI {stage} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Info panel - shows legend & stats when not hovering, project details when hovering */}
                    <div style={{ minHeight: '36px', marginBottom: '4px' }}>
                      {hoveredTimelineProject ? (() => {
                        const hoveredProject = filteredProjects.find(p => p.id === hoveredTimelineProject);
                        if (!hoveredProject) return null;
                        const sortedHistory = [...hoveredProject.history].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
                        const firstDate = sortedHistory.length > 0 ? new Date(sortedHistory[0].changed_at).toDateString() : null;
                        const lastDate = sortedHistory.length > 0 ? new Date(sortedHistory[sortedHistory.length - 1].changed_at).toDateString() : null;
                        const isSameDayProgression = firstDate === lastDate && sortedHistory.length > 1;

                        return (
                          <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            fontSize: '0.75rem'
                          }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {hoveredProject.name}
                              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                                ({hoveredProject.business_division || 'No Division'})
                              </span>
                              {isSameDayProgression && (
                                <span style={{ fontSize: '0.65rem', color: '#f59e0b', marginLeft: '6px' }}>• rapid</span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                              {hoveredProject.startDate ? new Date(hoveredProject.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No start'}
                              {' → '}
                              {hoveredProject.endDate ? new Date(hoveredProject.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing'}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {sortedHistory.map((h, hIdx) => (
                                <span key={hIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: doiColors[h.to_stage || 0],
                                    display: 'inline-block'
                                  }} />
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    D{h.to_stage} {new Date(h.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })() : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                          fontSize: '0.7rem'
                        }}>
                          {/* DOI Stage Legend */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {doiStages.map(stage => (
                              <span key={stage.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: doiColors[stage.id],
                                  display: 'inline-block'
                                }} />
                                <span style={{ color: 'var(--text-muted)' }}>DOI {stage.id}</span>
                              </span>
                            ))}
                          </div>
                          {/* Quick Stats */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontWeight: 600, color: '#10b981' }}>{filteredProjects.filter(p => p.doi_stage === 5).length}</span> Completed
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{filteredProjects.filter(p => p.doi_stage >= 2 && p.doi_stage < 5).length}</span> In Progress
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontWeight: 600, color: '#f59e0b' }}>{filteredProjects.filter(p => p.doi_stage < 2).length}</span> Early Stage
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ position: 'relative' }}>
                      {/* Month headers - fixed */}
                      <div style={{ display: 'flex', marginBottom: '8px', minWidth: '900px', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)', overflowX: 'auto' }}>
                        <div style={{ width: '150px', flexShrink: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project</div>
                        <div style={{ flex: 1, position: 'relative', height: '16px' }}>
                          {(() => {
                            let firstVisible = true;
                            return months.map((month, idx) => {
                              const pos = getPosition(month);
                              if (pos < 2) return null;
                              const showYear = firstVisible || month.getMonth() === 0;
                              firstVisible = false;
                              return (
                                <div key={idx} style={{
                                  position: 'absolute',
                                  left: `${pos}%`,
                                  fontSize: '0.65rem',
                                  fontWeight: 500,
                                  color: 'var(--text-muted)',
                                  borderLeft: '1px solid var(--border-light)',
                                  paddingLeft: '4px',
                                  height: '100%'
                                }}>
                                  {month.toLocaleDateString('en-US', { month: 'short', year: showYear ? 'numeric' : undefined })}
                                </div>
                              );
                            });
                          })()}
                          {/* Today marker label */}
                          <div style={{
                            position: 'absolute',
                            left: `${getPosition(today)}%`,
                            transform: 'translateX(-50%)',
                            fontSize: '0.6rem',
                            fontWeight: 600,
                            color: '#ef4444',
                            background: 'var(--bg-primary)',
                            padding: '0 4px',
                            borderRadius: '3px',
                            whiteSpace: 'nowrap',
                            top: '-2px'
                          }}>
                            Today
                          </div>
                        </div>
                      </div>

                      {/* Scrollable project rows */}
                      <div className="timeline-scroll-container" style={{ maxHeight: '180px', overflowY: 'auto', overflowX: 'auto', paddingRight: '8px' }}>

                      {/* Project rows */}
                      {filteredProjects.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No projects found for this DOI stage
                        </div>
                      )}
                      {filteredProjects.map((project, idx) => {
                        const barStart = getPosition(project.startDate);
                        const projectEnd = project.endDate || today;
                        const barEnd = getPosition(projectEnd);
                        const barWidth = Math.max(barEnd - barStart, 1);
                        const todayPos = getPosition(today);
                        const isHovered = hoveredTimelineProject === project.id;

                        return (
                          <div
                            key={project.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '2px',
                              minWidth: '900px',
                              padding: '2px 0',
                              borderRadius: '4px',
                              background: isHovered ? 'var(--bg-hover)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={() => setHoveredTimelineProject(project.id)}
                            onMouseLeave={() => setHoveredTimelineProject(null)}
                          >
                            <div style={{ width: '150px', flexShrink: 0, paddingRight: '8px', paddingLeft: '4px' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={project.name}>
                                {project.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({Math.round(project.progress)}%)</span>
                              </div>
                            </div>
                            <div style={{ flex: 1, height: '18px', position: 'relative' }}>
                              {/* Grid lines for months */}
                              {months.map((month, mIdx) => (
                                <div key={mIdx} style={{
                                  position: 'absolute',
                                  left: `${getPosition(month)}%`,
                                  top: 0,
                                  bottom: 0,
                                  width: '1px',
                                  background: 'var(--border-light)',
                                  opacity: 0.5
                                }} />
                              ))}

                              {/* Today marker */}
                              <div style={{
                                position: 'absolute',
                                left: `${todayPos}%`,
                                top: 0,
                                bottom: 0,
                                width: '2px',
                                background: '#ef4444',
                                zIndex: 3,
                                opacity: 0.7
                              }} />

                              {/* Project bar - solid when not hovered, segmented when hovered */}
                              {!isHovered ? (
                                <div style={{
                                  position: 'absolute',
                                  left: `${barStart}%`,
                                  width: `${barWidth}%`,
                                  height: '14px',
                                  top: '2px',
                                  borderRadius: '7px',
                                  background: `linear-gradient(90deg, ${doiColors[project.doi_stage || 0]} ${project.progress}%, rgba(148, 163, 184, 0.25) ${project.progress}%)`,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                  zIndex: 2
                                }} />
                              ) : (
                                <>
                                  {/* Segmented bar on hover */}
                                  {(() => {
                                    const segments = [];
                                    const sortedHistory = [...project.history].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

                                    // Check if all transitions happened on the same day (rapid progression)
                                    const firstDate = sortedHistory.length > 0 ? new Date(sortedHistory[0].changed_at).toDateString() : null;
                                    const lastDate = sortedHistory.length > 0 ? new Date(sortedHistory[sortedHistory.length - 1].changed_at).toDateString() : null;
                                    const isSameDayProgression = firstDate === lastDate && sortedHistory.length > 1;

                                    if (isSameDayProgression) {
                                      // Same-day progression: show small clustered segments at the actual date,
                                      // then extend the final stage to project end
                                      const transitionPos = getPosition(new Date(sortedHistory[0].changed_at));
                                      const minSegWidth = 1.5; // Minimum width for each segment to be visible
                                      const clusterWidth = minSegWidth * sortedHistory.length;
                                      const lastEntry = sortedHistory[sortedHistory.length - 1];

                                      // Show small segments clustered at the transition date
                                      for (let i = 0; i < sortedHistory.length; i++) {
                                        const entry = sortedHistory[i];
                                        const segStart = transitionPos + (i * minSegWidth);
                                        const isLast = i === sortedHistory.length - 1;
                                        // Last segment extends to project end
                                        const segWidth = isLast ? Math.max(getPosition(projectEnd) - segStart, minSegWidth) : minSegWidth;

                                        segments.push(
                                          <div key={i} style={{
                                            position: 'absolute',
                                            left: `${segStart}%`,
                                            width: `${segWidth}%`,
                                            height: '18px',
                                            top: '0px',
                                            background: doiColors[entry.to_stage || 0],
                                            borderRadius: i === 0 ? '6px 0 0 6px' : isLast ? '0 6px 6px 0' : '0',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                            zIndex: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRight: !isLast ? '2px solid rgba(255,255,255,0.5)' : 'none',
                                            transition: 'all 0.2s'
                                          }}>
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 700,
                                              color: '#fff',
                                              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                            }}>
                                              {segWidth > 3 ? `DOI ${entry.to_stage}` : entry.to_stage}
                                            </span>
                                          </div>
                                        );
                                      }
                                    } else {
                                      // Normal time-based segmentation
                                      for (let i = 0; i < sortedHistory.length; i++) {
                                        const entry = sortedHistory[i];
                                        const segStart = getPosition(new Date(entry.changed_at));
                                        const nextEntry = sortedHistory[i + 1];
                                        const segEnd = nextEntry ? getPosition(new Date(nextEntry.changed_at)) : getPosition(projectEnd);
                                        const segWidth = Math.max(segEnd - segStart, 0.5);

                                        segments.push(
                                          <div key={i} style={{
                                            position: 'absolute',
                                            left: `${segStart}%`,
                                            width: `${segWidth}%`,
                                            height: '18px',
                                            top: '0px',
                                            background: doiColors[entry.to_stage || 0],
                                            borderRadius: i === 0 ? '6px 0 0 6px' : i === sortedHistory.length - 1 ? '0 6px 6px 0' : '0',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                            zIndex: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRight: i < sortedHistory.length - 1 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                                            transition: 'all 0.2s'
                                          }}>
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 700,
                                              color: '#fff',
                                              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                            }}>
                                              {segWidth > 3 ? `DOI ${entry.to_stage}` : entry.to_stage}
                                            </span>
                                          </div>
                                        );
                                      }

                                      // Add remaining unfilled segment if project not complete
                                      if (project.doi_stage < 5 && sortedHistory.length > 0) {
                                        const lastEntry = sortedHistory[sortedHistory.length - 1];
                                        const unfilledStart = getPosition(new Date(lastEntry.changed_at));
                                        const unfilledEnd = getPosition(projectEnd);
                                        if (unfilledEnd > unfilledStart) {
                                          segments.push(
                                            <div key="unfilled" style={{
                                              position: 'absolute',
                                              left: `${unfilledStart}%`,
                                              width: `${unfilledEnd - unfilledStart}%`,
                                              height: '18px',
                                              top: '0px',
                                              background: 'rgba(148, 163, 184, 0.3)',
                                              borderRadius: '0 6px 6px 0',
                                              zIndex: 1,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}>
                                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                                Remaining
                                              </span>
                                            </div>
                                          );
                                        }
                                      }
                                    }

                                    return segments;
                                  })()}
                                </>
                              )}

                              {/* DOI milestones - only show when not hovered */}
                              {!isHovered && project.history.filter(h => h.to_stage > 0).map((h, hIdx) => {
                                const pos = getPosition(new Date(h.changed_at));
                                return (
                                  <div key={hIdx} style={{
                                    position: 'absolute',
                                    left: `${pos}%`,
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: doiColors[h.to_stage || 0],
                                    border: '2px solid #fff',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                    zIndex: 4
                                  }} />
                                );
                              })}

                            </div>
                          </div>
                        );
                      })}

                      </div>
                      {filteredProjects.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
                          {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

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
                    filteredApps.map((app, index) => (
                    <div key={app.id} className="project-card" onClick={() => setSelectedApp(app)} style={{
                        '--doi-color': ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'][app.doi_stage || 0]
                      }}>
                      <span className="card-serial-no">{index + 1}</span>
                      <div className="project-card-header">
                        <div className="project-card-icon">
                          <AppIcon icon={app.icon} usecaseType={app.usecase_type} />
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
                      <div className="project-card-ids">
                        {app.usecase_identifier && <span className="project-card-usecase-id">{app.usecase_identifier}</span>}
                        {app.project_id && <span className="project-card-id">#{app.project_id}</span>}
                      </div>

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
                          <th className="sno-column">#</th>
                          {allColumns.filter(col => visibleColumns.includes(col.key)).map(col => (
                            <th
                              key={col.key}
                              className="sortable-th resizable-th"
                              onClick={() => handleSort(col.key)}
                              style={columnWidths[col.key] ? { width: columnWidths[col.key] + 'px' } : {}}
                            >
                              <span className="th-content">
                                {col.label}
                                <span className={`sort-icon ${sortConfig.key === col.key ? 'active' : ''}`}>
                                  {sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </span>
                              </span>
                              <span className="resize-handle" onMouseDown={(e) => startResize(e, col.key)} onClick={(e) => e.stopPropagation()}></span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApps.map((app, index) => (
                          <tr key={app.id} onClick={() => setSelectedApp(app)} className="projects-table-row" style={{ '--doi-color': ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'][app.doi_stage || 0] }}>
                            <td className="sno-column">{index + 1}</td>
                            {visibleColumns.includes('project') && (
                              <td>
                                <div className="table-project-cell">
                                  <div className="table-project-icon">
                                    <AppIcon icon={app.icon} usecaseType={app.usecase_type} />
                                  </div>
                                  <div className="table-project-info">
                                    <span className="table-project-name">{app.name}</span>
                                    <div className="table-project-ids">
                                      {app.usecase_identifier && <span className="table-usecase-id">{app.usecase_identifier}</span>}
                                      {app.project_id && <span className="table-project-id">#{app.project_id}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )}
                            {visibleColumns.includes('usecase_type') && (
                              <td>
                                {app.usecase_type ? (
                                  <span className={`usecase-type-badge ${app.usecase_type === 'AI Usecase' ? 'ai' : 'foundation'}`}>
                                    {app.usecase_type === 'AI Usecase' ? 'AI' : 'Foundation'}
                                  </span>
                                ) : '-'}
                              </td>
                            )}
                            {visibleColumns.includes('doi_stage') && (
                              <td>
                                <span className="doi-badge" style={{
                                  '--doi-color': ['#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#059669'][app.doi_stage || 0]
                                }}>
                                  DOI {app.doi_stage || 0}
                                </span>
                              </td>
                            )}
                            {visibleColumns.includes('status') && (
                              <td><span className="status-text">{app.current_status || '-'}</span></td>
                            )}
                            {visibleColumns.includes('priority') && (
                              <td>
                                {app.priority ? (
                                  <span className={`priority-badge-sm priority-${app.priority.toLowerCase()}`}>{app.priority}</span>
                                ) : '-'}
                              </td>
                            )}
                            {visibleColumns.includes('division') && (
                              <td>{app.business_division || '-'}</td>
                            )}
                            {visibleColumns.includes('function') && (
                              <td>{app.business_function || '-'}</td>
                            )}
                            {visibleColumns.includes('platform') && (
                              <td>{app.platform || '-'}</td>
                            )}
                            {visibleColumns.includes('timeline') && (
                              <td className="timeline-cell">
                                {app.start_date || app.end_date ? (
                                  <span>{app.start_date || 'TBD'} → {app.end_date || 'TBD'}</span>
                                ) : '-'}
                              </td>
                            )}
                            {visibleColumns.includes('requester') && (
                              <td>{app.requester_name || '-'}</td>
                            )}
                            {visibleColumns.includes('ai_spoc') && (
                              <td>{app.ai_spoc || '-'}</td>
                            )}
                            {visibleColumns.includes('demand_type') && (
                              <td>{app.demand_type || '-'}</td>
                            )}
                            {visibleColumns.includes('estimated_costs') && (
                              <td>{app.estimated_costs || '-'}</td>
                            )}
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
                  <AppIcon icon={selectedApp.icon} usecaseType={selectedApp.usecase_type} />
                </div>
                <div className="slider-title-block">
                  <h2>{selectedApp.name}</h2>
                  <div className="slider-ids">
                    {selectedApp.usecase_identifier && <span className="usecase-id-label">{selectedApp.usecase_identifier}</span>}
                    {selectedApp.project_id && <span className="project-id-label">#{selectedApp.project_id}</span>}
                  </div>
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
              {(doiLoading || doiHistory.length > 0 || selectedApp.created_at) && (
                <div className="slider-section">
                  <h4>DOI Stage Journey</h4>
                  {doiLoading ? (
                    <div className="skeleton-timeline">
                      <div className="skeleton-item"><div className="skeleton-dot"></div><div className="skeleton-text"></div></div>
                      <div className="skeleton-item"><div className="skeleton-dot"></div><div className="skeleton-text"></div></div>
                    </div>
                  ) : (
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
                  )}
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
                    <option value="other">Other</option>
                  </select>
                </div>
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

      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {toast.type === 'error' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              )}
              {toast.type === 'success' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m5 12 5 5L20 7"/>
                </svg>
              )}
            </div>
            <span>{toast.message}</span>
          </div>
          <button className="toast-close" onClick={() => setToast({ ...toast, show: false })}>&times;</button>
        </div>
      )}

      <Tooltip id="tooltip" />
    </div>
  );
}

export default Landing;
