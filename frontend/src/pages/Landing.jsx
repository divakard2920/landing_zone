import { useState, useEffect } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';
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

  const filteredApps = apps.filter(app => {
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

    return searchFields.some(field =>
      field && field.toLowerCase().includes(query)
    ) || teamNames.toLowerCase().includes(query);
  });

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="top-header">
        <div className="brand-section">
          <img src="/knorr-bremse.svg" alt="Knorr-Bremse" className="brand-logo" />
          <div className="brand-subtitle">KBase <span className="brand-tagline">| AI Landing Zone</span></div>
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

      {/* Split Screen Layout */}
      <main className="main-content-area">
        {/* Left Sidebar - Scrollable Apps List */}
        <aside className="left-sidebar">
          <div className="sidebar-header">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
            {apps.length > 0 && <span className="app-count">{apps.length}</span>}
          </div>
          <div className="app-list">
            {apps.length > 0 ? (
              apps.map(app => (
                <div
                  key={app.id}
                  className={`app-list-item ${selectedApp?.id === app.id ? 'selected' : ''}`}
                  onClick={() => setSelectedApp(app)}
                >
                  <div className="app-list-icon">
                    <AppIcon icon={app.icon} />
                  </div>
                  <span className="app-list-name">{app.name}</span>
                </div>
              ))
            ) : (
              <div className="app-list-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 12 }}>
                  <rect width="7" height="7" x="3" y="3" rx="1"/>
                  <rect width="7" height="7" x="14" y="3" rx="1"/>
                  <rect width="7" height="7" x="14" y="14" rx="1"/>
                  <rect width="7" height="7" x="3" y="14" rx="1"/>
                </svg>
                <p>No applications yet</p>
                <span>Apps will appear here once added</span>
              </div>
            )}
          </div>
        </aside>

        {/* Center Panel */}
        <section className="center-panel">
          {/* Main Search Bar */}
          <div className="search-container">
            <input
              type="text"
              className="main-search-input"
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) {
                  setSelectedApp(null); // Clear selection if typing to search
                }
              }}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
          </div>

          {/* Content Display: Selected App Detail OR Search Results */}
          {selectedApp ? (
            <div className="detail-view-dashboard">
              {/* Compact Header */}
              <div className="dashboard-header">
                <div className="dashboard-header-left">
                  <div className="detail-icon">
                    <AppIcon icon={selectedApp.icon} />
                  </div>
                  <div>
                    <h2>{selectedApp.name}</h2>
                    {selectedApp.project_id && <span className="project-id-label">#{selectedApp.project_id}</span>}
                  </div>
                </div>
                <div className="dashboard-header-right">
                  <div className="detail-badges">
                    {selectedApp.doi_stage !== undefined && (
                      <span className={`doi-badge doi-${selectedApp.doi_stage}`}>
                        {getDoiLabel(selectedApp.doi_stage)}
                      </span>
                    )}
                    {selectedApp.current_status && (
                      <span className="status-badge">{selectedApp.current_status}</span>
                    )}
                    {selectedApp.priority && (
                      <span className={`priority-badge priority-${selectedApp.priority.toLowerCase()}`}>{selectedApp.priority}</span>
                    )}
                  </div>
                  <div className="dashboard-actions">
                    {selectedApp.url && (
                      <a href={selectedApp.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                        Launch
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => setSelectedApp(null)}>Close</button>
                  </div>
                </div>
              </div>

              {/* Dashboard Cards Grid */}
              <div className="dashboard-cards">
                {/* Business Info Card */}
                <div className="dash-card">
                  <h4>Business</h4>
                  <div className="dash-card-content">
                    {selectedApp.business_division && (
                      <div className="dash-item">
                        <span className="dash-label">Division</span>
                        <span className="dash-value">{selectedApp.business_division}</span>
                      </div>
                    )}
                    {selectedApp.business_function && (
                      <div className="dash-item">
                        <span className="dash-label">Function</span>
                        <span className="dash-value">{selectedApp.business_function}</span>
                      </div>
                    )}
                    {selectedApp.category && (
                      <div className="dash-item">
                        <span className="dash-label">Category</span>
                        <span className="dash-value">{selectedApp.category}</span>
                      </div>
                    )}
                    {selectedApp.strategic_focus && (
                      <div className="dash-item">
                        <span className="dash-label">Strategic Focus</span>
                        <span className="dash-value">{selectedApp.strategic_focus}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* People Card */}
                <div className="dash-card">
                  <h4>People</h4>
                  <div className="dash-card-content">
                    {selectedApp.requester_name && (
                      <div className="dash-item">
                        <span className="dash-label">Requester</span>
                        <span className="dash-value">{selectedApp.requester_name}</span>
                      </div>
                    )}
                    {selectedApp.ai_spoc && (
                      <div className="dash-item">
                        <span className="dash-label">AI SPOC</span>
                        <span className="dash-value">{selectedApp.ai_spoc}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Technical Card */}
                <div className="dash-card">
                  <h4>Technical</h4>
                  <div className="dash-card-content">
                    {selectedApp.platform && (
                      <div className="dash-item">
                        <span className="dash-label">Platform</span>
                        <span className="dash-value">{selectedApp.platform}</span>
                      </div>
                    )}
                    {selectedApp.demand_type && (
                      <div className="dash-item">
                        <span className="dash-label">Demand Type</span>
                        <span className="dash-value">{selectedApp.demand_type}</span>
                      </div>
                    )}
                    {selectedApp.ai_skills && (
                      <div className="dash-item">
                        <span className="dash-label">AI Skills</span>
                        <span className="dash-value">{selectedApp.ai_skills}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline & Budget Card */}
                <div className="dash-card">
                  <h4>Timeline & Budget</h4>
                  <div className="dash-card-content">
                    {selectedApp.start_date && (
                      <div className="dash-item">
                        <span className="dash-label">Start</span>
                        <span className="dash-value">{selectedApp.start_date}</span>
                      </div>
                    )}
                    {selectedApp.end_date && (
                      <div className="dash-item">
                        <span className="dash-label">End</span>
                        <span className="dash-value">{selectedApp.end_date}</span>
                      </div>
                    )}
                    {selectedApp.estimated_costs && (
                      <div className="dash-item">
                        <span className="dash-label">Est. Costs</span>
                        <span className="dash-value">{selectedApp.estimated_costs}</span>
                      </div>
                    )}
                    {selectedApp.last_status && (
                      <div className="dash-item">
                        <span className="dash-label">Last Status</span>
                        <span className="dash-value">{selectedApp.last_status}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description Card - spans full width if exists */}
                {selectedApp.description && (
                  <div className="dash-card dash-card-wide">
                    <h4>Description</h4>
                    <p className="dash-description">{selectedApp.description}</p>
                  </div>
                )}

                {/* Team Members Card */}
                {selectedApp.team && selectedApp.team.length > 0 && (
                  <div className="dash-card dash-card-wide">
                    <h4>Team Members ({selectedApp.team.length})</h4>
                    <div className="dash-team-grid">
                      {selectedApp.team.map(member => (
                        <div key={member.id} className="dash-team-item">
                          <span className="dash-team-avatar">{member.name.charAt(0).toUpperCase()}</span>
                          <div className="dash-team-info">
                            <span className="dash-team-name">{member.name}</span>
                            {member.role && <span className="dash-team-role">{member.role}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DOI Stage History */}
                {(doiHistory.length > 0 || selectedApp.created_at) && (
                  <div className="dash-card dash-card-wide">
                    <h4>DOI Stage Journey</h4>
                    <div className="doi-timeline">
                      {/* Show initial DOI 0 from project creation if no initial history entry */}
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
            </div>
          ) : searchQuery ? (
            <div className="results-grid">
              {filteredApps.map(app => (
                <div key={app.id} className="result-card" onClick={() => setSelectedApp(app)}>
                  <div className="app-list-icon">
                    <AppIcon icon={app.icon} />
                  </div>
                  <div className="result-info">
                    <h4>{app.name}</h4>
                    <p>{app.description || 'No description available.'}</p>
                  </div>
                </div>
              ))}
              {filteredApps.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>
                  No results found for "{searchQuery}".
                </div>
              )}
            </div>
          ) : (
            <div className="widgets-dashboard">
              {widgets.length > 0 ? (
                widgets.map(widget => (
                  <WidgetRenderer
                    key={widget.id}
                    widget={widget}
                    apps={apps}
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
          )}
        </section>
      </main>

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
                    <option value="request">App Request</option>
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
    </div>
  );
}

export default Landing;
