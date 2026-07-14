import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';
import { STATUS_OPTIONS, PRIORITY_OPTIONS, DEMAND_TYPES, PLATFORMS, USECASE_TYPES } from '../constants';

const isUploadedFile = (url) => url && (url.startsWith('/uploads') || url.startsWith('/api/') || url.startsWith('https://'));

const AIUsecaseIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3 4 4.5 4.5 0 0 1-3-4"/>
    <path d="M12 18v4"/>
    <path d="M8 18h8"/>
  </svg>
);

const FoundationIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="8.5" y="3" width="7" height="7" rx="1"/>
    <path d="M12 10v4"/>
    <path d="M6.5 14v-2a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2"/>
  </svg>
);

const DefaultAppIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M12 8v8"/>
    <path d="M8 12h8"/>
  </svg>
);

const AppIcon = ({ icon, usecaseType }) => {
  if (isUploadedFile(icon)) {
    return <img src={icon} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />;
  }
  if (icon) {
    return (
      <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
        {icon}
      </div>
    );
  }
  if (usecaseType === 'AI Usecase') {
    return (
      <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--ai-usecase-bg, #dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ai-usecase-color, #1e40af)' }}>
        <AIUsecaseIcon />
      </div>
    );
  }
  if (usecaseType === 'Foundation') {
    return (
      <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--foundation-bg, #f3e8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foundation-color, #7c3aed)' }}>
        <FoundationIcon />
      </div>
    );
  }
  return (
    <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
      <DefaultAppIcon />
    </div>
  );
};

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [project, setProject] = useState(null);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [originalProject, setOriginalProject] = useState(null);
  const [doiHistory, setDoiHistory] = useState([]);
  const [doiStages, setDoiStages] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hoveredField, setHoveredField] = useState(null);
  const [requesterInput, setRequesterInput] = useState('');
  const [doiChangedAt, setDoiChangedAt] = useState('');
  const [doiDateError, setDoiDateError] = useState(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', role: '', email: '' });
  const [teamError, setTeamError] = useState(null);

  useEffect(() => {
    loadProject();
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) setCurrentAdmin(JSON.parse(adminUser));
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showAdminProfile && !e.target.closest('.admin-profile-wrapper')) {
        setShowAdminProfile(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAdminProfile]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {}
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const loadProject = async () => {
    try {
      setLoading(true);
      const [projectRes, doiHistoryRes, doiStagesRes, teamRes] = await Promise.all([
        api.admin.getApps(),
        api.getDoiHistory(id),
        api.getDoiStages(),
        api.admin.getTeam(id)
      ]);

      const projectData = projectRes.data.find(p => p.id === id);
      if (!projectData) {
        navigate('/admin?tab=projects');
        return;
      }

      setProject(projectData);
      setOriginalProject(projectData);
      setDoiHistory(doiHistoryRes.data);
      setDoiStages(doiStagesRes.data);
      setTeam(teamRes.data);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = project && originalProject && JSON.stringify(project) !== JSON.stringify(originalProject);

  const logActivity = async (action, entityType, entityId, entityName, details = null) => {
    try {
      await api.admin.logActivity({
        admin_id: currentAdmin?.id,
        admin_name: currentAdmin?.name,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        details
      });
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
  };

  const saveAllChanges = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.admin.updateApp(id, { ...project, doi_changed_at: doiChangedAt });

      // Log activity with changes
      const changes = [];
      if (originalProject.doi_stage !== project.doi_stage) {
        const fromDoi = doiStages.find(d => d.id === originalProject.doi_stage);
        const toDoi = doiStages.find(d => d.id === project.doi_stage);
        changes.push(`DOI stage from "${fromDoi?.label || 'DOI ' + originalProject.doi_stage}" to "${toDoi?.label || 'DOI ' + project.doi_stage}"`);
      }
      if (originalProject.current_status !== project.current_status) {
        changes.push(`status from "${originalProject.current_status || 'none'}" to "${project.current_status || 'none'}"`);
      }
      if (originalProject.priority !== project.priority) {
        changes.push(`priority from "${originalProject.priority || 'none'}" to "${project.priority || 'none'}"`);
      }
      if (originalProject.name !== project.name) {
        changes.push(`name from "${originalProject.name}" to "${project.name}"`);
      }
      const details = changes.length > 0 ? `Changed: ${changes.join(', ')}` : null;
      logActivity('updated', 'project', id, project.name, details);

      setOriginalProject({ ...project });
      setDoiChangedAt('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      const doiHistoryRes = await api.getDoiHistory(id);
      setDoiHistory(doiHistoryRes.data);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to save';
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setProject({ ...originalProject });
    setEditingField(null);
    setDoiChangedAt('');
  };

  const updateDoiHistoryDate = async (historyId, newDate) => {
    // Find the current history entry and its index
    const currentIndex = doiHistory.findIndex(h => h.id === historyId);
    if (currentIndex === -1) return;

    const currentEntry = doiHistory[currentIndex];
    const newDateObj = new Date(newDate);

    // Check previous stage date (must be after previous stage)
    if (currentIndex > 0) {
      const prevEntry = doiHistory[currentIndex - 1];
      const prevDate = new Date(prevEntry.changed_at);
      if (newDateObj < prevDate) {
        setDoiDateError(`DOI ${currentEntry.to_stage} date cannot be before DOI ${prevEntry.to_stage} (${formatDateForInput(prevEntry.changed_at)})`);
        setTimeout(() => setDoiDateError(null), 5000);
        return;
      }
    }

    // Check next stage date (must be before next stage)
    if (currentIndex < doiHistory.length - 1) {
      const nextEntry = doiHistory[currentIndex + 1];
      const nextDate = new Date(nextEntry.changed_at);
      if (newDateObj > nextDate) {
        setDoiDateError(`DOI ${currentEntry.to_stage} date cannot be after DOI ${nextEntry.to_stage} (${formatDateForInput(nextEntry.changed_at)})`);
        setTimeout(() => setDoiDateError(null), 5000);
        return;
      }
    }

    setDoiDateError(null);
    try {
      await api.admin.updateDoiHistoryDate(historyId, newDate);
      setDoiHistory(doiHistory.map(h =>
        h.id === historyId ? { ...h, changed_at: newDate } : h
      ));

      // If DOI 0 date changed, also update project start_date
      if (currentEntry.to_stage === 0) {
        setProject(prev => ({ ...prev, start_date: newDate }));
        setOriginalProject(prev => ({ ...prev, start_date: newDate }));
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to update DOI date:', error);
    }
  };

  const handleIconUpload = async (file) => {
    try {
      const res = await api.admin.uploadIcon(file);
      const newProject = { ...project, icon: res.data.url };
      setProject(newProject);
      await api.admin.updateApp(id, newProject);
      setOriginalProject(newProject);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!project) return null;

  const getDOILabel = (stage) => {
    const doi = doiStages.find(d => d.id === stage);
    return doi ? doi.label : `Stage ${stage}`;
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getRequesters = () => {
    if (!project?.requester_name) return [];
    return project.requester_name.split(',').map(r => r.trim()).filter(r => r);
  };

  const addRequester = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = getRequesters();
    if (!current.includes(trimmed)) {
      setProject({ ...project, requester_name: [...current, trimmed].join(', ') });
    }
    setRequesterInput('');
  };

  const removeRequester = (name) => {
    const current = getRequesters().filter(r => r !== name);
    setProject({ ...project, requester_name: current.join(', ') });
  };

  const addTeamMember = async () => {
    if (!teamForm.name.trim()) {
      setTeamError('Name is required');
      setTimeout(() => setTeamError(null), 3000);
      return;
    }
    try {
      await api.admin.addTeamMember(id, teamForm);
      const teamRes = await api.admin.getTeam(id);
      setTeam(teamRes.data);
      setTeamForm({ name: '', role: '', email: '' });
      setShowAddTeam(false);
      logActivity('added', 'team_member', id, teamForm.name, `Added to ${project.name}`);
    } catch (error) {
      setTeamError(error.response?.data?.error || 'Failed to add team member');
      setTimeout(() => setTeamError(null), 3000);
    }
  };

  const removeTeamMember = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from team?`)) return;
    try {
      await api.admin.deleteTeamMember(memberId);
      setTeam(team.filter(m => m.id !== memberId));
      logActivity('removed', 'team_member', id, memberName, `Removed from ${project.name}`);
    } catch (error) {
      setTeamError('Failed to remove team member');
      setTimeout(() => setTeamError(null), 3000);
    }
  };

  const Field = ({ label, field, value, type = 'text', options = [], multiline = false }) => {
    const isEditing = editingField === field;
    const isHovered = hoveredField === field;
    const isChanged = project && originalProject && project[field] !== originalProject[field];

    if (isEditing) {
      return (
        <tr>
          <td style={{ padding: '10px 16px 10px 0', color: 'var(--text-muted)', fontSize: '0.9rem', verticalAlign: 'top', whiteSpace: 'nowrap', width: '140px' }}>{label}</td>
          <td style={{ padding: '6px 0' }}>
            {type === 'select' ? (
              <select
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--brand-primary)', borderRadius: '4px', fontSize: '0.9rem', outline: 'none', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                value={project[field] || ''}
                onChange={e => { setProject({ ...project, [field]: e.target.value }); setEditingField(null); }}
                onBlur={() => setEditingField(null)}
                autoFocus
              >
                <option value="">—</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : multiline ? (
              <textarea
                ref={el => { if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--brand-primary)', borderRadius: '4px', fontSize: '0.9rem', outline: 'none', resize: 'vertical', minHeight: '60px', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                value={project[field] || ''}
                onChange={e => setProject({ ...project, [field]: e.target.value })}
                onBlur={() => setEditingField(null)}
              />
            ) : (
              <input
                type={type}
                ref={el => { if (el) { el.focus(); if (el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); } }}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--brand-primary)', borderRadius: '4px', fontSize: '0.9rem', outline: 'none', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                value={project[field] || ''}
                onChange={e => setProject({ ...project, [field]: e.target.value })}
                onBlur={() => setEditingField(null)}
                onKeyDown={e => e.key === 'Enter' && setEditingField(null)}
              />
            )}
          </td>
        </tr>
      );
    }

    
    return (
      <tr
        onClick={() => setEditingField(field)}
        onMouseEnter={() => setHoveredField(field)}
        onMouseLeave={() => setHoveredField(null)}
        style={{ cursor: 'pointer', background: isChanged ? 'var(--change-bg)' : 'transparent' }}
      >
        <td style={{ padding: '10px 16px 10px 0', color: 'var(--text-muted)', fontSize: '0.9rem', verticalAlign: 'top', whiteSpace: 'nowrap', width: '140px' }}>
          {isChanged && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--change-indicator)', marginRight: 6 }}></span>}
          {label}
        </td>
        <td style={{ padding: '10px 0', fontSize: '0.9rem', color: 'var(--text-primary)', position: 'relative' }}>
          <span style={{ whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>{value || '—'}</span>
          {isHovered && (
            <svg style={{ marginLeft: '8px', opacity: 0.4, verticalAlign: 'middle' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="admin-page">
      {/* Top Header */}
      <header className="top-header">
        <div className="brand-section">
          <img src="/knorr-bremse.svg" alt="Knorr-Bremse" className="brand-logo" />
          <div className="brand-subtitle">KBase <span className="brand-tagline">| Admin Panel</span></div>
        </div>

        <div className="header-tabs"></div>

        <div className="header-actions">
          <button className={`theme-switch ${theme === 'dark' ? 'dark' : ''}`} onClick={toggleTheme}>
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
          {currentAdmin && (
            <div className="admin-profile-wrapper">
              <button className="admin-avatar-btn" onClick={() => setShowAdminProfile(!showAdminProfile)}>
                {currentAdmin.name.charAt(0).toUpperCase()}
              </button>
              {showAdminProfile && (
                <div className="admin-profile-dropdown">
                  <div className="admin-profile-info">
                    <div className="admin-profile-avatar">{currentAdmin.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{currentAdmin.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{currentAdmin.email}</div>
                    </div>
                  </div>
                  <div className="admin-profile-actions">
                    <Link to="/" className="admin-profile-link" onClick={() => setShowAdminProfile(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      Go to Portal
                    </Link>
                    <button className="admin-profile-link logout" onClick={handleLogout}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-main" style={{ padding: '24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Back Link */}
          <button
            onClick={() => navigate('/admin?tab=projects')}
            style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Projects
          </button>

          {/* Project Header */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <AppIcon icon={project.icon} usecaseType={project.usecase_type} />
                <label style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, background: 'var(--bg-card)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <input type="file" accept="image/*" hidden onChange={e => e.target.files[0] && handleIconUpload(e.target.files[0])} />
                </label>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</h1>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {project.usecase_identifier && <span style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'var(--identifier-bg)', color: 'var(--identifier-color)', borderRadius: '6px', fontWeight: 500 }}>{project.usecase_identifier}</span>}
                  {project.usecase_type && <span style={{ fontSize: '0.8rem', padding: '4px 10px', background: project.usecase_type === 'AI Usecase' ? 'var(--ai-usecase-bg)' : 'var(--foundation-bg)', color: project.usecase_type === 'AI Usecase' ? 'var(--ai-usecase-color)' : 'var(--foundation-color)', borderRadius: '6px' }}>{project.usecase_type}</span>}
                  {project.current_status && <span style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'var(--bg-muted)', borderRadius: '6px' }}>{project.current_status}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {error && <span style={{ color: 'var(--error-text)', fontSize: '0.85rem', padding: '6px 12px', background: 'var(--error-bg)', borderRadius: '6px' }}>{error}</span>}
              {success && <span style={{ color: 'var(--success-text)', fontSize: '0.85rem', padding: '6px 12px', background: 'var(--success-bg)', borderRadius: '6px' }}>Saved</span>}
              {hasChanges && (
                <>
                  <button
                    onClick={discardChanges}
                    style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveAllChanges}
                    disabled={saving}
                    style={{ padding: '8px 16px', background: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '40px' }}>
          {/* Main Content */}
          <div>

            {/* Description */}
            <div style={{ marginBottom: '32px' }}>
              {(() => {
                const descChanged = project.description !== originalProject?.description;
                return (
                  <div
                    onClick={() => setEditingField('description')}
                    onMouseEnter={() => setHoveredField('description')}
                    onMouseLeave={() => setHoveredField(null)}
                    style={{ cursor: 'pointer', position: 'relative', background: descChanged ? 'var(--change-bg)' : 'transparent', padding: '8px', marginLeft: '-8px', borderRadius: '6px' }}
                  >
                    {editingField === 'description' ? (
                      <textarea
                        style={{ width: '100%', padding: '12px', border: '1px solid var(--brand-primary)', borderRadius: '6px', fontSize: '1rem', lineHeight: 1.6, outline: 'none', resize: 'vertical', minHeight: '100px', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                        value={project.description || ''}
                        onChange={e => setProject({ ...project, description: e.target.value })}
                        onBlur={() => setEditingField(null)}
                        autoFocus
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, color: project.description ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {descChanged && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--change-indicator)', marginRight: 8 }}></span>}
                        {project.description || 'No description'}
                        {hoveredField === 'description' && (
                          <svg style={{ marginLeft: '8px', opacity: 0.4, verticalAlign: 'middle' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        )}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Info Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>General</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <Field label="Name" field="name" value={project.name} />
                    <Field label="Use Case Type" field="usecase_type" value={project.usecase_type} type="select" options={USECASE_TYPES} />
                    <Field label="Current Status" field="current_status" value={project.current_status} type="select" options={STATUS_OPTIONS} />
                    <Field label="Priority" field="priority" value={project.priority} type="select" options={PRIORITY_OPTIONS} />
                    <Field label="Platform" field="platform" value={project.platform} type="select" options={PLATFORMS} />
                    <Field label="Application URL" field="url" value={project.url} type="url" />
                  </tbody>
                </table>
              </div>

              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>Organization</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <Field label="Business Division" field="business_division" value={project.business_division} />
                    <Field label="Business Function" field="business_function" value={project.business_function} />
                    {/* Requester Name(s) with chips */}
                    {(() => {
                      const isChanged = project?.requester_name !== originalProject?.requester_name;
                      const isEditing = editingField === 'requester_name';
                      const isHovered = hoveredField === 'requester_name';
                      return (
                        <tr
                          onClick={() => !isEditing && setEditingField('requester_name')}
                          onMouseEnter={() => setHoveredField('requester_name')}
                          onMouseLeave={() => setHoveredField(null)}
                          style={{ cursor: 'pointer', background: isChanged ? 'var(--change-bg)' : 'transparent' }}
                        >
                          <td style={{ padding: '10px 16px 10px 0', color: 'var(--text-muted)', fontSize: '0.9rem', verticalAlign: 'top', whiteSpace: 'nowrap', width: '140px' }}>
                            {isChanged && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--change-indicator)', marginRight: 6 }}></span>}
                            Requester Name(s)
                          </td>
                          <td style={{ padding: '6px 0', fontSize: '0.9rem' }}>
                            {isEditing ? (
                              <div className="tag-input-container" style={{ border: '1px solid var(--brand-primary)', borderRadius: '4px', padding: '4px 8px', background: 'var(--bg-base)', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                {getRequesters().map((name, idx) => (
                                  <span key={idx} className="tag-item" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--brand-primary)', color: 'white', borderRadius: '4px', fontSize: '0.85rem' }}>
                                    {name}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeRequester(name); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }} title="Remove requester">&times;</button>
                                  </span>
                                ))}
                                <input
                                  type="text"
                                  value={requesterInput}
                                  onChange={e => setRequesterInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                      e.preventDefault();
                                      addRequester(requesterInput);
                                    } else if (e.key === 'Backspace' && !requesterInput && getRequesters().length > 0) {
                                      removeRequester(getRequesters()[getRequesters().length - 1]);
                                    } else if (e.key === 'Escape') {
                                      setEditingField(null);
                                    }
                                  }}
                                  onBlur={() => { addRequester(requesterInput); setEditingField(null); }}
                                  placeholder={getRequesters().length === 0 ? "Type name and press Enter" : "Add another..."}
                                  style={{ border: 'none', outline: 'none', flex: 1, minWidth: '120px', padding: '4px', fontSize: '0.9rem', background: 'transparent', color: 'var(--text-primary)' }}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                {getRequesters().length > 0 ? (
                                  getRequesters().map((name, idx) => (
                                    <span key={idx} style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--bg-muted)', borderRadius: '4px', fontSize: '0.85rem' }}>{name}</span>
                                  ))
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                                {isHovered && (
                                  <svg style={{ marginLeft: '4px', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })()}
                    <Field label="AI SPOC" field="ai_spoc" value={project.ai_spoc} />
                    <Field label="Demand Type" field="demand_type" value={project.demand_type} type="select" options={DEMAND_TYPES} />
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginTop: '32px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>Schedule & Budget</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', width: '140px', flexShrink: 0 }}>
                      {project.start_date !== originalProject?.start_date && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--change-indicator)', marginRight: 6 }}></span>}
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={project.start_date ? formatDateForInput(project.start_date) : ''}
                      onChange={e => setProject({ ...project, start_date: e.target.value })}
                      style={{ padding: '6px 10px', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.9rem', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', width: '140px', flexShrink: 0 }}>
                      {project.end_date !== originalProject?.end_date && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--change-indicator)', marginRight: 6 }}></span>}
                      End Date
                    </label>
                    <input
                      type="date"
                      value={project.end_date ? formatDateForInput(project.end_date) : ''}
                      onChange={e => setProject({ ...project, end_date: e.target.value })}
                      style={{ padding: '6px 10px', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.9rem', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <Field label="Estimated Costs" field="estimated_costs" value={project.estimated_costs} />
                  </tbody>
                </table>
              </div>

              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>Technical</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <Field label="AI Skills" field="ai_skills" value={project.ai_skills} />
                    <Field label="Strategic Focus" field="strategic_focus" value={project.strategic_focus} />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Risks & Dependencies */}
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>Risks & Dependencies</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Field label="Risks" field="risks" value={project.risks} multiline />
                  <Field label="Dependencies" field="dependencies" value={project.dependencies} multiline />
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* DOI Progress */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DOI Stage</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{Math.round((project.doi_stage / 5) * 100)}%</span>
              </div>

              {/* Progress Steps */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
                {[0, 1, 2, 3, 4, 5].map(stage => (
                  <div
                    key={stage}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      background: stage <= project.doi_stage ? 'var(--brand-primary)' : 'var(--bg-muted)',
                      transition: 'background 0.2s'
                    }}
                  />
                ))}
              </div>

              {/* Current Stage Display */}
              <div style={{ background: 'var(--bg-muted)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                    {project.doi_stage}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{getDOILabel(project.doi_stage)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Stage</div>
                  </div>
                </div>
              </div>

              {/* Stage Selector */}
              {(() => {
                const doiChanged = project.doi_stage !== originalProject?.doi_stage;
                return (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      {doiChanged && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--change-indicator)', marginRight: 6 }}></span>}
                      Change Stage
                    </label>
                    <select
                      value={project.doi_stage}
                      onChange={(e) => {
                        setProject({ ...project, doi_stage: parseInt(e.target.value) });
                        setDoiChangedAt('');
                      }}
                      style={{ width: '100%', padding: '10px 12px', border: doiChanged ? '1px solid var(--change-indicator)' : '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem', background: doiChanged ? 'var(--change-bg)' : 'var(--bg-base)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      {doiStages.map(d => <option key={d.id} value={d.id}>DOI {d.id} — {d.label}</option>)}
                    </select>
                    {doiChanged && (
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Stage Change Date</label>
                        <input
                          type="date"
                          value={doiChangedAt}
                          onChange={(e) => setDoiChangedAt(e.target.value)}
                          max={formatDateForInput(new Date())}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Leave empty for current date</small>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* History Section */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>History</h3>
              {doiDateError && (
                <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '6px', color: 'var(--error-text)', fontSize: '0.8rem' }}>
                  {doiDateError}
                </div>
              )}
              {doiHistory.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  {/* Vertical line */}
                  <div style={{ position: 'absolute', left: '11px', top: '12px', bottom: '12px', width: '2px', background: 'var(--border-light)' }} />

                  {doiHistory.map((h, i) => {
                    const isLatest = i === doiHistory.length - 1;
                    const doiColors = {
                      0: '#94a3b8',
                      1: '#f59e0b',
                      2: '#3b82f6',
                      3: '#8b5cf6',
                      4: '#10b981',
                      5: '#059669'
                    };
                    const stageColor = doiColors[h.to_stage] || 'var(--brand-primary)';
                    return (
                      <div key={h.id} style={{ display: 'flex', gap: '14px', marginBottom: i < doiHistory.length - 1 ? '16px' : 0, position: 'relative' }}>
                        {/* Timeline dot */}
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: isLatest ? stageColor : 'var(--bg-muted)',
                          border: isLatest ? 'none' : `2px solid ${stageColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isLatest ? 'white' : stageColor,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          flexShrink: 0,
                          zIndex: 1
                        }}>
                          {h.to_stage}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, paddingTop: '2px' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: isLatest ? 600 : 400, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            {getDOILabel(h.to_stage)}
                          </div>
                          <input
                            type="date"
                            value={formatDateForInput(h.changed_at)}
                            max={formatDateForInput(new Date())}
                            onChange={e => updateDoiHistoryDate(h.id, e.target.value)}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid var(--border-light)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              background: 'var(--bg-base)',
                              cursor: 'pointer',
                              fontFamily: 'inherit'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No stage changes yet</p>
              )}
              </div>

              {/* Team Section */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Team ({team.length})</h3>
                <button
                  onClick={() => setShowAddTeam(!showAddTeam)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-primary)', fontSize: '1.2rem', padding: 0, lineHeight: 1 }}
                  title="Add team member"
                >
                  {showAddTeam ? '−' : '+'}
                </button>
              </div>

              {teamError && (
                <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '6px', color: 'var(--error-text)', fontSize: '0.8rem' }}>
                  {teamError}
                </div>
              )}

              {showAddTeam && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <input
                    type="text"
                    placeholder="Name *"
                    value={teamForm.name}
                    onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--bg-muted)', color: 'var(--text-primary)', marginBottom: '6px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Role"
                      value={teamForm.role}
                      onChange={e => setTeamForm({ ...teamForm, role: e.target.value })}
                      style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--bg-muted)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={teamForm.email}
                      onChange={e => setTeamForm({ ...teamForm, email: e.target.value })}
                      style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.8rem', background: 'var(--bg-muted)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setShowAddTeam(false); setTeamForm({ name: '', role: '', email: '' }); }}
                      style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addTeamMember}
                      style={{ padding: '6px 12px', background: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {team.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {team.map(member => (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px', borderRadius: '6px', marginLeft: '-6px', marginRight: '-6px' }} className="team-member-row">
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{member.name}</div>
                        {member.role && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.role}</div>}
                      </div>
                      <button
                        onClick={() => removeTeamMember(member.id, member.name)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', opacity: 0.5 }}
                        title="Remove"
                        onMouseEnter={e => e.target.style.opacity = 1}
                        onMouseLeave={e => e.target.style.opacity = 0.5}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                !showAddTeam && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No team members</p>
              )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}

export default ProjectDetail;
