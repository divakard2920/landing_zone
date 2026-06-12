import { useState, useEffect } from 'react';
import { api } from '../api';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Tooltip } from 'react-tooltip';

const STATUS_OPTIONS = [
  'Active', 'On Hold', 'Completed', 'Cancelled', 'In Review',
  'Ongoing Project', 'POC active', 'POC completed', 'Use case defined',
  'Active in progress', 'Awaiting decision', 'To be started', 'MVP has been built'
];

const DEMAND_TYPES = [
  'L1 - Platform Provision',
  'L2 - Solution Partnering',
  'L3 - Fully Managed'
];

const PLATFORMS = ['Microsoft', 'AWS', 'GCP', 'Azure', 'Other'];

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

const emptyProjectForm = {
  name: '', description: '', url: '', icon: '', category: '',
  business_division: '', business_function: '', requester_name: '', ai_spoc: '',
  priority: '', strategic_focus: '', doi_stage: 0, doi_changed_at: '', project_id: '',
  current_status: '', last_status: '', demand_type: '', platform: '',
  estimated_costs: '', start_date: '', end_date: '', ai_skills: '',
  risks: '', dependencies: ''
};

function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const setActiveTab = (tab) => {
    if (tab === 'dashboard') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  const [currentAdmin, setCurrentAdmin] = useState(() => {
    const saved = localStorage.getItem('adminUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [projects, setProjects] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [doiStages, setDoiStages] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [projectForm, setProjectForm] = useState({ ...emptyProjectForm });
  const [editingProject, setEditingProject] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');

  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'info' });
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  const [selectedProjectForTeam, setSelectedProjectForTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamForm, setTeamForm] = useState({ name: '', role: '', email: '' });
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  const [widgets, setWidgets] = useState([]);
  const [widgetForm, setWidgetForm] = useState({
    title: '', chart_type: 'donut', data_field: 'doi_stage', color_scheme: 'default', display_order: 0
  });
  const [editingWidget, setEditingWidget] = useState(null);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, confirmText: 'Delete', type: 'danger' });
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogLimit, setActivityLogLimit] = useState(10);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const { theme, toggleTheme } = useTheme();

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
      loadActivityLogs(activityLogLimit);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  const loadActivityLogs = async (limit = 10) => {
    try {
      const res = await api.admin.getActivityLogs(limit);
      setActivityLogs(res.data);
      setHasMoreLogs(res.data.length >= limit);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    }
  };

  const handleLoadMoreLogs = async () => {
    setLoadingMoreLogs(true);
    const newLimit = activityLogLimit + 20;
    try {
      const res = await api.admin.getActivityLogs(newLimit);
      setActivityLogs(res.data);
      setActivityLogLimit(newLimit);
      setHasMoreLogs(res.data.length >= newLimit);
    } catch (error) {
      console.error('Failed to load more logs:', error);
    } finally {
      setLoadingMoreLogs(false);
    }
  };

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 3000);
  };

  const showConfirm = (title, message, onConfirm, confirmText = 'Delete', type = 'danger') => {
    setConfirmDialog({ show: true, title, message, onConfirm, confirmText, type });
  };

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) confirmDialog.onConfirm();
    setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, confirmText: 'Delete', type: 'danger' });
  };

  const handleCancelConfirm = () => {
    setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, confirmText: 'Delete', type: 'danger' });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [appsRes, annRes, fbRes, widgetsRes, doiRes, usersRes, logsRes] = await Promise.all([
        api.admin.getApps(),
        api.admin.getAnnouncements(),
        api.admin.getFeedback(),
        api.admin.getWidgets(),
        api.admin.getDoiStages(),
        api.admin.getAdminUsers(),
        api.admin.getActivityLogs(10)
      ]);
      setProjects(appsRes.data);
      setAnnouncements(annRes.data);
      setFeedback(fbRes.data);
      setWidgets(widgetsRes.data);
      setDoiStages(doiRes.data);
      setAdminUsers(usersRes.data);
      setActivityLogs(logsRes.data);
      setHasMoreLogs(logsRes.data.length >= 10);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      // Ignore errors
    }
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingAdmin) {
        await api.admin.updateAdminUser(editingAdmin.id, adminForm);
        const changes = [];
        if (editingAdmin.name !== adminForm.name) changes.push(`name: ${editingAdmin.name} → ${adminForm.name}`);
        if (editingAdmin.email !== adminForm.email) changes.push(`email changed`);
        if (adminForm.password) changes.push(`password updated`);
        logActivity('updated', 'admin user', editingAdmin.id, adminForm.name, changes.length > 0 ? changes.join(', ') : null);
        showToast('Admin updated successfully', 'success');
      } else {
        const res = await api.admin.createAdminUser(adminForm);
        logActivity('created', 'admin user', res.data.id, adminForm.name, `Email: ${adminForm.email}`);
        showToast('Admin created successfully', 'success');
      }
      setAdminForm({ name: '', email: '', password: '' });
      setEditingAdmin(null);
      setShowAdminModal(false);
      loadData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save admin', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAdmin = (admin) => {
    setEditingAdmin(admin);
    setAdminForm({ name: admin.name, email: admin.email, password: '' });
    setShowAdminModal(true);
  };

  const handleDeleteAdmin = (admin) => {
    showConfirm('Delete Admin', `Are you sure you want to delete ${admin.name}? They will no longer be able to access the admin panel.`, async () => {
      try {
        await api.admin.deleteAdminUser(admin.id);
        logActivity('deleted', 'admin user', admin.id, admin.name);
        showToast('Admin deleted', 'success');
        loadData();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete admin', 'error');
      }
    });
  };

  const handleToggleAdminStatus = async (admin) => {
    try {
      await api.admin.updateAdminUser(admin.id, { ...admin, is_active: !admin.is_active });
      logActivity('updated', 'admin user', admin.id, admin.name, `Status: ${admin.is_active ? 'Active → Inactive' : 'Inactive → Active'}`);
      showToast(`Admin ${admin.is_active ? 'deactivated' : 'activated'}`, 'success');
      loadData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update admin', 'error');
    }
  };

  const handleProjectSubmit = async (e) => {
    e.preventDefault();

    // Check if DOI stage is being lowered
    if (editingProject && projectForm.doi_stage < editingProject.doi_stage) {
      showConfirm(
        'Lower DOI Stage?',
        `You are about to lower the DOI stage from DOI ${editingProject.doi_stage} to DOI ${projectForm.doi_stage}. This is an unusual action. Are you sure you want to proceed?`,
        async () => {
          await saveProject();
        },
        'Proceed',
        'warning'
      );
      return;
    }

    await saveProject();
  };

  const saveProject = async () => {
    setSaving(true);
    try {
      if (editingProject) {
        await api.admin.updateApp(editingProject.id, projectForm);

        // Build change details
        const changes = [];
        if (editingProject.doi_stage !== projectForm.doi_stage) {
          const fromDoi = doiStages.find(d => d.id === editingProject.doi_stage);
          const toDoi = doiStages.find(d => d.id === projectForm.doi_stage);
          changes.push(`DOI stage from "${fromDoi?.label || 'DOI ' + editingProject.doi_stage}" to "${toDoi?.label || 'DOI ' + projectForm.doi_stage}"`);
        }
        if (editingProject.current_status !== projectForm.current_status) {
          changes.push(`status from "${editingProject.current_status || 'none'}" to "${projectForm.current_status || 'none'}"`);
        }
        if (editingProject.priority !== projectForm.priority) {
          changes.push(`priority from "${editingProject.priority || 'none'}" to "${projectForm.priority || 'none'}"`);
        }
        if (editingProject.name !== projectForm.name) {
          changes.push(`name from "${editingProject.name}" to "${projectForm.name}"`);
        }

        const details = changes.length > 0 ? `Changed: ${changes.join(', ')}` : null;
        logActivity('updated', 'project', editingProject.id, projectForm.name, details);
      } else {
        const res = await api.admin.createApp(projectForm);
        const doi = doiStages.find(d => d.id === projectForm.doi_stage);
        const details = `Initial DOI: ${doi?.label || 'DOI ' + projectForm.doi_stage}${projectForm.priority ? ', Priority: ' + projectForm.priority : ''}`;
        logActivity('created', 'project', res.data.id, projectForm.name, details);
      }
      setProjectForm({ ...emptyProjectForm });
      setEditingProject(null);
      setShowProjectModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save project', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setProjectForm({ ...emptyProjectForm, ...project, doi_changed_at: '' });
    setShowProjectModal(true);
  };

  const handleDeleteProject = (id, name) => {
    showConfirm('Delete Project', 'Are you sure you want to delete this project? This action cannot be undone.', async () => {
      await api.admin.deleteApp(id);
      logActivity('deleted', 'project', id, name);
      loadData();
    });
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingAnnouncement) {
        await api.admin.updateAnnouncement(editingAnnouncement.id, {
          ...announcementForm,
          is_active: editingAnnouncement.is_active
        });
        const changes = [];
        if (editingAnnouncement.title !== announcementForm.title) changes.push(`title changed`);
        if (editingAnnouncement.content !== announcementForm.content) changes.push(`content updated`);
        if (editingAnnouncement.type !== announcementForm.type) changes.push(`type: ${editingAnnouncement.type} → ${announcementForm.type}`);
        logActivity('updated', 'announcement', editingAnnouncement.id, announcementForm.title, changes.length > 0 ? changes.join(', ') : null);
        setEditingAnnouncement(null);
      } else {
        const res = await api.admin.createAnnouncement(announcementForm);
        logActivity('created', 'announcement', res.data.id, announcementForm.title, `Type: ${announcementForm.type}`);
      }
      setAnnouncementForm({ title: '', content: '', type: 'info' });
      loadData();
    } catch (error) {
      console.error('Failed to save announcement', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAnnouncement = (item) => {
    setEditingAnnouncement(item);
    setAnnouncementForm({ title: item.title, content: item.content, type: item.type });
  };

  const handleCancelEditAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', content: '', type: 'info' });
  };

  const handleDeleteAnnouncement = (id, title) => {
    showConfirm('Delete Announcement', 'Are you sure you want to delete this announcement?', async () => {
      await api.admin.deleteAnnouncement(id);
      logActivity('deleted', 'announcement', id, title);
      loadData();
    });
  };

  const handleUpdateFeedbackStatus = async (id, status) => {
    await api.admin.updateFeedbackStatus(id, status);
    loadData();
  };

  const loadTeamMembers = async (appId) => {
    try {
      const res = await api.admin.getTeam(appId);
      setTeamMembers(res.data);
    } catch (error) {
      console.error('Failed to load team members', error);
    }
  };

  const loadAllTeamMembers = async () => {
    try {
      const res = await api.admin.getAllTeamMembers();
      setAllTeamMembers(res.data);
    } catch (error) {
      console.error('Failed to load all team members', error);
    }
  };

  const handleSelectProjectForTeam = (project) => {
    setSelectedProjectForTeam(project);
    loadTeamMembers(project.id);
    loadAllTeamMembers();
  };

  const handleAddTeamMember = async (e) => {
    e.preventDefault();
    if (!selectedProjectForTeam) return;
    setSaving(true);
    try {
      if (editingTeamMember) {
        await api.admin.updateTeamMember(editingTeamMember.id, teamForm);
        setEditingTeamMember(null);
      } else {
        await api.admin.addTeamMember(selectedProjectForTeam.id, teamForm);
      }
      setTeamForm({ name: '', role: '', email: '' });
      setTeamSearchQuery('');
      loadTeamMembers(selectedProjectForTeam.id);
      loadAllTeamMembers();
    } catch (error) {
      if (error.response?.data?.error) {
        showToast(error.response.data.error, 'error');
      } else {
        console.error('Failed to save team member', error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeamMember = (member) => {
    setEditingTeamMember(member);
    setTeamForm({ name: member.name, role: member.role || '', email: member.email || '' });
    setTeamSearchQuery(member.name);
  };

  const handleCancelEditTeamMember = () => {
    setEditingTeamMember(null);
    setTeamForm({ name: '', role: '', email: '' });
    setTeamSearchQuery('');
  };

  const handleSelectExistingMember = (member) => {
    setTeamForm({ name: member.name, role: member.role || '', email: member.email || '' });
    setTeamSearchQuery(member.name);
    setShowTeamDropdown(false);
  };

  const handleDeleteTeamMember = (id) => {
    showConfirm('Remove Team Member', 'Are you sure you want to remove this team member from the project?', async () => {
      await api.admin.deleteTeamMember(id);
      loadTeamMembers(selectedProjectForTeam.id);
    });
  };

  const handleWidgetSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingWidget) {
        await api.admin.updateWidget(editingWidget.id, { ...widgetForm, is_active: editingWidget.is_active });
        const changes = [];
        if (editingWidget.chart_type !== widgetForm.chart_type) changes.push(`chart type: ${editingWidget.chart_type} → ${widgetForm.chart_type}`);
        if (editingWidget.data_field !== widgetForm.data_field) changes.push(`data field: ${editingWidget.data_field} → ${widgetForm.data_field}`);
        logActivity('updated', 'widget', editingWidget.id, widgetForm.title, changes.length > 0 ? changes.join(', ') : null);
      } else {
        const res = await api.admin.createWidget(widgetForm);
        logActivity('created', 'widget', res.data.id, widgetForm.title, `Chart: ${widgetForm.chart_type}, Field: ${widgetForm.data_field}`);
      }
      setWidgetForm({ title: '', chart_type: 'donut', data_field: 'doi_stage', color_scheme: 'default', display_order: 0 });
      setEditingWidget(null);
      setShowWidgetModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save widget', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditWidget = (widget) => {
    setEditingWidget(widget);
    setWidgetForm({
      title: widget.title,
      chart_type: widget.chart_type,
      data_field: widget.data_field,
      color_scheme: widget.color_scheme || 'default',
      display_order: widget.display_order || 0
    });
    setShowWidgetModal(true);
  };

  const handleToggleWidget = async (widget) => {
    await api.admin.updateWidget(widget.id, { ...widget, is_active: !widget.is_active });
    logActivity('updated', 'widget', widget.id, widget.title, `Status: ${widget.is_active ? 'Active → Inactive' : 'Inactive → Active'}`);
    loadData();
  };

  const handleDeleteWidget = (id, title) => {
    showConfirm('Delete Widget', 'Are you sure you want to delete this widget?', async () => {
      await api.admin.deleteWidget(id);
      logActivity('deleted', 'widget', id, title);
      loadData();
    });
  };

  const getDOILabel = (stage) => {
    const doi = doiStages.find(d => d.id === stage);
    return doi ? `DOI ${doi.id} - ${doi.label}` : `DOI ${stage}`;
  };

  const renderHeader = () => (
    <header className="top-header">
      <div className="brand-section">
        <img src="/knorr-bremse.svg" alt="Knorr-Bremse" className="brand-logo" />
        <div className="brand-subtitle">KBase <span className="brand-tagline">| Admin Panel</span></div>
      </div>

      <div className="header-tabs">
        <button className={`header-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
          </svg>
          Dashboard
        </button>
        <button className={`header-tab ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
            <path d="M12 12v10"/><path d="M8 22h8"/><path d="M7 12h10"/>
          </svg>
          AI Pipeline
        </button>
        <button className={`header-tab ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          </svg>
          Teams
        </button>
        <button className={`header-tab ${activeTab === 'widgets' ? 'active' : ''}`} onClick={() => setActiveTab('widgets')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
          </svg>
          Widgets
        </button>
        <button className={`header-tab ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => setActiveTab('announcements')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/>
          </svg>
          Announcements
        </button>
        <button className={`header-tab ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Feedback
        </button>
        <button className={`header-tab ${activeTab === 'admin-users' ? 'active' : ''}`} onClick={() => setActiveTab('admin-users')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Admin Users
        </button>
      </div>

      <div className="header-actions">
        <button className={`theme-switch ${theme === 'dark' ? 'dark' : ''}`} onClick={toggleTheme} data-tooltip-id="admin-tooltip" data-tooltip-content={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
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
          <div className="admin-user-pill">
            <div className="admin-avatar">{currentAdmin.name.charAt(0).toUpperCase()}</div>
            <span>{currentAdmin.name}</span>
          </div>
        )}
        <Link to="/" className="btn btn-outline btn-sm">
          Portal
        </Link>
        <button onClick={handleLogout} className="logout-btn" data-tooltip-id="admin-tooltip" data-tooltip-content="Logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );

  if (pageLoading) {
    return (
      <div className="admin-page">
        {renderHeader()}
        <main className="admin-main">
          <div className="admin-stats-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="stat-card" style={{ background: 'var(--bg-muted)' }}>
                <div className="skeleton-box" style={{ width: 60, height: 36, marginBottom: 8 }}></div>
                <div className="skeleton-box" style={{ width: 100, height: 16 }}></div>
              </div>
            ))}
          </div>
          <div className="skeleton-box" style={{ width: 160, height: 24, margin: '32px 0 16px' }}></div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  {[120, 80, 100, 80, 80].map((w, i) => (
                    <th key={i}><div className="skeleton-box" style={{ width: w, height: 14 }}></div></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td><div className="skeleton-box" style={{ width: '90%', height: 16 }}></div></td>
                    <td><div className="skeleton-box" style={{ width: '70%', height: 16 }}></div></td>
                    <td><div className="skeleton-box" style={{ width: 80, height: 24, borderRadius: 12 }}></div></td>
                    <td><div className="skeleton-box" style={{ width: '60%', height: 16 }}></div></td>
                    <td><div className="skeleton-box" style={{ width: '50%', height: 16 }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {renderHeader()}

      <main className="admin-main">
        <div className="admin-content-header">
          <h1>{activeTab === 'admin-users' ? 'Admin Users' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}</h1>
          {activeTab === 'projects' && (
            <button className="btn btn-primary" onClick={() => { setEditingProject(null); setProjectForm({ ...emptyProjectForm }); setShowProjectModal(true); }}>
              + Add Project
            </button>
          )}
          {activeTab === 'widgets' && (
            <button className="btn btn-primary" onClick={() => { setEditingWidget(null); setWidgetForm({ title: '', chart_type: 'donut', data_field: 'doi_stage', color_scheme: 'default', display_order: 0 }); setShowWidgetModal(true); }}>
              + Add Widget
            </button>
          )}
        </div>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-number">{projects.length}</div>
                <div className="stat-label">Total Projects</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{projects.filter(p => p.doi_stage >= 3).length}</div>
                <div className="stat-label">In Production</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{projects.filter(p => p.doi_stage < 3).length}</div>
                <div className="stat-label">In Development</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{feedback.filter(f => f.status === 'new').length}</div>
                <div className="stat-label">New Requests</div>
              </div>
            </div>

            <h3 style={{ margin: '32px 0 16px' }}>Recent Projects</h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Division</th>
                    <th>DOI Stage</th>
                    <th>Status</th>
                    <th>AI SPOC</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.slice(0, 5).map(project => (
                    <tr key={project.id}>
                      <td style={{ fontWeight: 600 }}>{project.name}</td>
                      <td>{project.business_division || '-'}</td>
                      <td><span className={`doi-badge doi-${project.doi_stage || 0}`}>{getDOILabel(project.doi_stage || 0)}</span></td>
                      <td>{project.current_status || '-'}</td>
                      <td>{project.ai_spoc || '-'}</td>
                    </tr>
                  ))}
                  {projects.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No projects yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 style={{ margin: '32px 0 16px' }}>Activity Log</h3>
            <div className="activity-log-container">
              {activityLogs.length === 0 ? (
                <p className="activity-empty">No activity recorded yet.</p>
              ) : (
                <div className="activity-list">
                  {activityLogs.map(log => (
                    <div
                      key={log.id}
                      className={`activity-item ${log.details ? 'has-details' : ''} ${expandedLogId === log.id ? 'expanded' : ''}`}
                      onClick={() => log.details && setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    >
                      <div className="activity-icon">
                        {log.action === 'created' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
                          </svg>
                        )}
                        {log.action === 'updated' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                          </svg>
                        )}
                        {log.action === 'deleted' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        )}
                        {!['created', 'updated', 'deleted'].includes(log.action) && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                          </svg>
                        )}
                      </div>
                      <div className="activity-content">
                        <div className="activity-summary">
                          <span className="activity-admin">{log.admin_name || 'System'}</span>
                          <span className="activity-action">{log.action}</span>
                          <span className="activity-entity-type">{log.entity_type}</span>
                          {log.entity_name && <span className="activity-entity-name">"{log.entity_name}"</span>}
                          {log.details && (
                            <svg className="expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="m6 9 6 6 6-6"/>
                            </svg>
                          )}
                        </div>
                        {log.details && expandedLogId === log.id && (
                          <div className="activity-details">{log.details}</div>
                        )}
                      </div>
                      <div className="activity-time">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  ))}
                  {hasMoreLogs && (
                    <button
                      className="show-more-btn"
                      onClick={handleLoadMoreLogs}
                      disabled={loadingMoreLogs}
                    >
                      {loadingMoreLogs ? 'Loading...' : 'Show More'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects */}
        {activeTab === 'projects' && (
          <div className="admin-table-container">
            <div className="admin-search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search projects by name, ID, division, status..."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
              />
              {projectSearchQuery && (
                <button className="search-clear" onClick={() => setProjectSearchQuery('')}>×</button>
              )}
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Division</th>
                  <th>Function</th>
                  <th>DOI</th>
                  <th>Status</th>
                  <th>Platform</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.filter(project => {
                  if (!projectSearchQuery) return true;
                  const query = projectSearchQuery.toLowerCase();
                  return (
                    project.name?.toLowerCase().includes(query) ||
                    project.project_id?.toLowerCase().includes(query) ||
                    project.business_division?.toLowerCase().includes(query) ||
                    project.business_function?.toLowerCase().includes(query) ||
                    project.current_status?.toLowerCase().includes(query) ||
                    project.platform?.toLowerCase().includes(query) ||
                    project.requester_name?.toLowerCase().includes(query) ||
                    project.ai_spoc?.toLowerCase().includes(query)
                  );
                }).map(project => (
                  <tr key={project.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {project.icon && (
                          project.icon.startsWith('/uploads')
                            ? <img src={project.icon} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                            : <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{project.icon}</span>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{project.name}</div>
                          {project.project_id && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {project.project_id}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{project.business_division || '-'}</td>
                    <td>{project.business_function || '-'}</td>
                    <td><span className={`doi-badge doi-${project.doi_stage || 0}`}>DOI {project.doi_stage || 0}</span></td>
                    <td>{project.current_status || '-'}</td>
                    <td>{project.platform || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEditProject(project)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProject(project.id, project.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No projects. Click "Add Project" to create one.</td></tr>
                )}
                {projects.length > 0 && projectSearchQuery && projects.filter(p => {
                  const query = projectSearchQuery.toLowerCase();
                  return (
                    p.name?.toLowerCase().includes(query) ||
                    p.project_id?.toLowerCase().includes(query) ||
                    p.business_division?.toLowerCase().includes(query) ||
                    p.business_function?.toLowerCase().includes(query) ||
                    p.current_status?.toLowerCase().includes(query) ||
                    p.platform?.toLowerCase().includes(query) ||
                    p.requester_name?.toLowerCase().includes(query) ||
                    p.ai_spoc?.toLowerCase().includes(query)
                  );
                }).length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No projects match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Teams */}
        {activeTab === 'teams' && (
          <div style={{ display: 'flex', gap: '24px' }}>
            <div className="admin-table-container" style={{ width: '280px', flexShrink: 0 }}>
              <div style={{ padding: '16px', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>Select Project</div>
              <div style={{ padding: '8px' }}>
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => handleSelectProjectForTeam(project)}
                    className={`team-project-item ${selectedProjectForTeam?.id === project.id ? 'selected' : ''}`}
                  >
                    {project.icon?.startsWith('/uploads')
                      ? <img src={project.icon} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                      : <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{project.icon || 'AI'}</span>
                    }
                    <span>{project.name}</span>
                  </div>
                ))}
                {projects.length === 0 && <div style={{ padding: '16px', color: 'var(--text-muted)', textAlign: 'center' }}>No projects</div>}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              {selectedProjectForTeam ? (
                <>
                  <div className="admin-table-container" style={{ marginBottom: '24px' }}>
                    <div style={{ padding: '16px', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>
                      Team Members - {selectedProjectForTeam.name}
                    </div>
                    <table className="admin-table">
                      <thead>
                        <tr><th>Name</th><th>Role</th><th>Email</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {teamMembers.map(m => (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600 }}>{m.name}</td>
                            <td>{m.role || '-'}</td>
                            <td>{m.email || '-'}</td>
                            <td>
                              <div className="action-buttons">
                                <button className="btn btn-sm" onClick={() => handleEditTeamMember(m)}>Edit</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTeamMember(m.id)}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {teamMembers.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No team members</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  <div className="admin-table-container" style={{ padding: '24px', maxWidth: '400px' }}>
                    <h3 style={{ marginBottom: '16px' }}>{editingTeamMember ? 'Edit Team Member' : 'Add Team Member'}</h3>
                    <form onSubmit={handleAddTeamMember}>
                      <div className="form-group">
                        <label>Name *</label>
                        <div className="searchable-select">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search or type new name..."
                            value={teamSearchQuery}
                            onChange={(e) => {
                              setTeamSearchQuery(e.target.value);
                              setTeamForm({...teamForm, name: e.target.value});
                              setShowTeamDropdown(true);
                            }}
                            onFocus={() => setShowTeamDropdown(true)}
                            onBlur={() => setTimeout(() => setShowTeamDropdown(false), 150)}
                            required
                          />
                          {showTeamDropdown && allTeamMembers.length > 0 && (
                            <div className="searchable-dropdown">
                              {allTeamMembers
                                .filter(m => m.name.toLowerCase().includes(teamSearchQuery.toLowerCase()))
                                .map((m, idx) => (
                                  <div
                                    key={idx}
                                    className="searchable-option"
                                    onClick={() => handleSelectExistingMember(m)}
                                  >
                                    <div style={{ fontWeight: 500 }}>{m.name}</div>
                                    {m.role && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.role}</div>}
                                  </div>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Role</label>
                        <input type="text" className="form-control" value={teamForm.role} onChange={e => setTeamForm({...teamForm, role: e.target.value})} placeholder="e.g. Developer, AI SPOC" />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input type="email" className="form-control" value={teamForm.email} onChange={e => setTeamForm({...teamForm, email: e.target.value})} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                          {saving ? 'Saving...' : (editingTeamMember ? 'Update' : 'Add Member')}
                        </button>
                        {editingTeamMember && <button type="button" className="btn btn-outline" onClick={handleCancelEditTeamMember} disabled={saving}>Cancel</button>}
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Select a project to manage its team</div>
              )}
            </div>
          </div>
        )}

        {/* Announcements */}
        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', gap: '24px' }}>
            <div className="admin-table-container" style={{ flex: 2 }}>
              <table className="admin-table">
                <thead><tr><th>Type</th><th>Title</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {announcements.map(item => (
                    <tr key={item.id}>
                      <td><span className={`ticker-badge ${item.type}`}>{item.type}</span></td>
                      <td style={{ fontWeight: 600 }}>{item.title}</td>
                      <td>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-sm" onClick={() => handleEditAnnouncement(item)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAnnouncement(item.id, item.title)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {announcements.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No announcements</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="admin-table-container" style={{ flex: 1, padding: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>{editingAnnouncement ? 'Edit Announcement' : 'Post Announcement'}</h3>
              <form onSubmit={handleAnnouncementSubmit}>
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" className="form-control" value={announcementForm.title} onChange={e => setAnnouncementForm({...announcementForm, title: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="form-control" value={announcementForm.type} onChange={e => setAnnouncementForm({...announcementForm, type: e.target.value})}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="update">Update</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Content</label>
                  <textarea className="form-control" value={announcementForm.content} onChange={e => setAnnouncementForm({...announcementForm, content: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : (editingAnnouncement ? 'Update' : 'Post')}
                  </button>
                  {editingAnnouncement && <button type="button" className="btn btn-outline" onClick={handleCancelEditAnnouncement} disabled={saving}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Feedback */}
        {activeTab === 'feedback' && (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead><tr><th>Type</th><th>Contact</th><th>Project</th><th>Subject & Message</th><th>Status</th></tr></thead>
              <tbody>
                {feedback.map(item => (
                  <tr key={item.id}>
                    <td><span className={`ticker-badge ${item.type === 'bug' ? 'warning' : 'info'}`}>{item.type}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.email || '-'}</div>
                    </td>
                    <td style={{ color: item.app_name ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {item.app_name || '-'}
                    </td>
                    <td style={{ maxWidth: '400px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.subject}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.message}</div>
                    </td>
                    <td>
                      <select className="status-select" value={item.status} onChange={e => handleUpdateFeedbackStatus(item.id, e.target.value)}>
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {feedback.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No feedback</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Widgets */}
        {activeTab === 'widgets' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Create custom analytics widgets to display on the landing page dashboard.
            </p>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Chart Type</th>
                    <th>Data Field</th>
                    <th>Color Scheme</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {widgets.map(widget => (
                    <tr key={widget.id}>
                      <td style={{ fontWeight: 600 }}>{widget.title}</td>
                      <td><span className="ticker-badge info">{widget.chart_type}</span></td>
                      <td>{widget.data_field}</td>
                      <td>{widget.color_scheme || 'default'}</td>
                      <td>{widget.display_order}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${widget.is_active ? 'btn-success' : 'btn-outline'}`}
                          onClick={() => handleToggleWidget(widget)}
                        >
                          {widget.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-sm" onClick={() => handleEditWidget(widget)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteWidget(widget.id, widget.title)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {widgets.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                        No widgets created yet. Click "+ Add Widget" to create your first analytics widget.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Admin Users */}
        {activeTab === 'admin-users' && (
          <div className="admin-table-container">
            <div className="admin-section-header">
              <p>Manage admin users who can access this panel.</p>
              <button className="btn btn-primary" onClick={() => { setEditingAdmin(null); setAdminForm({ name: '', email: '', password: '' }); setShowAdminModal(true); }}>
                + Add Admin
              </button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(admin => (
                  <tr key={admin.id}>
                    <td style={{ fontWeight: 600 }}>{admin.name}</td>
                    <td>{admin.email}</td>
                    <td>
                      {currentAdmin?.id !== admin.id ? (
                        <button
                          className={`btn btn-sm ${admin.is_active ? 'btn-success' : 'btn-outline'}`}
                          onClick={() => handleToggleAdminStatus(admin)}
                        >
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span className="btn btn-sm btn-success" style={{ cursor: 'default' }}>Active</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-sm" onClick={() => handleEditAdmin(admin)}>Edit</button>
                        {currentAdmin?.id !== admin.id && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAdmin(admin)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {adminUsers.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                      No admin users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Admin User Modal */}
        {showAdminModal && (
          <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingAdmin ? 'Edit Admin' : 'Add Admin'}</h2>
                <button className="modal-close" onClick={() => setShowAdminModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleAdminSubmit}>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={adminForm.name}
                    onChange={e => setAdminForm({...adminForm, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={adminForm.email}
                    onChange={e => setAdminForm({...adminForm, email: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{editingAdmin ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                  <input
                    type="password"
                    className="form-control"
                    value={adminForm.password}
                    onChange={e => setAdminForm({...adminForm, password: e.target.value})}
                    required={!editingAdmin}
                    placeholder={editingAdmin ? 'Leave blank to keep current password' : ''}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowAdminModal(false)} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : (editingAdmin ? 'Update' : 'Create') + ' Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Widget Modal */}
        {showWidgetModal && (
          <div className="modal-overlay" onClick={() => setShowWidgetModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingWidget ? 'Edit Widget' : 'Create Widget'}</h2>
                <button className="modal-close" onClick={() => setShowWidgetModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleWidgetSubmit}>
                <div className="form-group">
                  <label>Widget Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={widgetForm.title}
                    onChange={e => setWidgetForm({...widgetForm, title: e.target.value})}
                    placeholder="e.g. Projects by DOI Stage"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Chart Type *</label>
                  <select
                    className="form-control"
                    value={widgetForm.chart_type}
                    onChange={e => setWidgetForm({...widgetForm, chart_type: e.target.value})}
                  >
                    <option value="donut">Donut Chart</option>
                    <option value="pie">Pie Chart</option>
                    <option value="bar">Horizontal Bar Chart</option>
                    <option value="vertical_bar">Vertical Bar Chart</option>
                    <option value="progress">Progress Bars</option>
                    <option value="stat">Stat Cards</option>
                    <option value="dropdown">Dropdown Select</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Data Field *</label>
                  <select
                    className="form-control"
                    value={widgetForm.data_field}
                    onChange={e => setWidgetForm({...widgetForm, data_field: e.target.value})}
                  >
                    <option value="doi_stage">DOI Stage</option>
                    <option value="current_status">Current Status</option>
                    <option value="priority">Priority</option>
                    <option value="business_division">Business Division</option>
                    <option value="business_function">Business Function</option>
                    <option value="demand_type">Demand Type</option>
                    <option value="platform">Platform</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Color Scheme</label>
                  <select
                    className="form-control"
                    value={widgetForm.color_scheme}
                    onChange={e => setWidgetForm({...widgetForm, color_scheme: e.target.value})}
                  >
                    <option value="default">Default (Blue)</option>
                    <option value="warm">Warm (Red-Green)</option>
                    <option value="cool">Cool (Purple-Teal)</option>
                    <option value="earth">Earth (Brown-Green)</option>
                    <option value="pastel">Pastel</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Display Order</label>
                  <input
                    type="number"
                    className="form-control"
                    value={widgetForm.display_order}
                    onChange={e => setWidgetForm({...widgetForm, display_order: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Lower numbers appear first</small>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowWidgetModal(false)} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : (editingWidget ? 'Update' : 'Create') + ' Widget'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Project Modal */}
        {showProjectModal && (
          <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
            <div className="modal modal-large" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingProject ? 'Edit Project' : 'Add New Project'}</h2>
                <button className="modal-close" onClick={() => setShowProjectModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleProjectSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Project Name *</label>
                    <input type="text" className="form-control" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Project ID</label>
                    <input type="text" className="form-control" value={projectForm.project_id} onChange={e => setProjectForm({...projectForm, project_id: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Business Division</label>
                    <input type="text" className="form-control" value={projectForm.business_division} onChange={e => setProjectForm({...projectForm, business_division: e.target.value})} placeholder="e.g. CVS, RVS, Group" />
                  </div>
                  <div className="form-group">
                    <label>Business Function</label>
                    <input type="text" className="form-control" value={projectForm.business_function} onChange={e => setProjectForm({...projectForm, business_function: e.target.value})} placeholder="e.g. HR, Engineering, Finance" />
                  </div>
                  <div className="form-group">
                    <label>Requester Name</label>
                    <input type="text" className="form-control" value={projectForm.requester_name} onChange={e => setProjectForm({...projectForm, requester_name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>AI SPOC</label>
                    <input type="text" className="form-control" value={projectForm.ai_spoc} onChange={e => setProjectForm({...projectForm, ai_spoc: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select className="form-control" value={projectForm.priority} onChange={e => setProjectForm({...projectForm, priority: e.target.value})}>
                      <option value="">Select...</option>
                      {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>DOI Stage</label>
                    <select className="form-control" value={projectForm.doi_stage} onChange={e => setProjectForm({...projectForm, doi_stage: parseInt(e.target.value), doi_changed_at: ''})}>
                      {doiStages.map(d => <option key={d.id} value={d.id}>DOI {d.id} - {d.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>DOI Stage Date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={projectForm.doi_changed_at}
                      onChange={e => setProjectForm({...projectForm, doi_changed_at: e.target.value})}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <small style={{ color: 'var(--text-muted)' }}>Set a custom date for this DOI stage change</small>
                  </div>
                  <div className="form-group">
                    <label>Current Status</label>
                    <select className="form-control" value={projectForm.current_status} onChange={e => setProjectForm({...projectForm, current_status: e.target.value})}>
                      <option value="">Select...</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Demand Type</label>
                    <select className="form-control" value={projectForm.demand_type} onChange={e => setProjectForm({...projectForm, demand_type: e.target.value})}>
                      <option value="">Select...</option>
                      {DEMAND_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Platform</label>
                    <select className="form-control" value={projectForm.platform} onChange={e => setProjectForm({...projectForm, platform: e.target.value})}>
                      <option value="">Select...</option>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Estimated Costs</label>
                    <input type="text" className="form-control" value={projectForm.estimated_costs} onChange={e => setProjectForm({...projectForm, estimated_costs: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" className="form-control" value={projectForm.start_date} onChange={e => setProjectForm({...projectForm, start_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input type="date" className="form-control" value={projectForm.end_date} onChange={e => setProjectForm({...projectForm, end_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Icon</label>
                    <div className="icon-upload-group">
                      <select className="form-control" value={projectForm.icon?.startsWith('/uploads') ? '' : (projectForm.icon || '')} onChange={e => setProjectForm({...projectForm, icon: e.target.value})}>
                        <option value="">Default Icon</option>
                        <option value="AI">AI</option>
                        <option value="ML">ML</option>
                        <option value="NLP">NLP</option>
                        <option value="CV">CV</option>
                        <option value="BI">BI</option>
                        <option value="RPA">RPA</option>
                        <option value="IoT">IoT</option>
                        <option value="API">API</option>
                      </select>
                      <span className="icon-or">or</span>
                      <label className="icon-upload-btn">
                        Upload
                        <input type="file" accept="image/*" hidden onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const res = await api.admin.uploadIcon(file);
                              setProjectForm({...projectForm, icon: res.data.url});
                            } catch (err) {
                              console.error('Upload failed', err);
                            }
                          }
                        }} />
                      </label>
                      {projectForm.icon && (
                        <div className="icon-preview-wrapper" onClick={() => setProjectForm({...projectForm, icon: ''})}>
                          {projectForm.icon.startsWith('/uploads')
                            ? <img src={projectForm.icon} alt="icon" className="icon-preview" />
                            : <span className="icon-preview-text">{projectForm.icon}</span>
                          }
                          <div className="icon-delete-overlay">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"/>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Application URL</label>
                    <input type="url" className="form-control" value={projectForm.url} onChange={e => setProjectForm({...projectForm, url: e.target.value})} />
                  </div>
                  <div className="form-group full-width">
                    <label>AI Skills</label>
                    <input type="text" className="form-control" value={projectForm.ai_skills} onChange={e => setProjectForm({...projectForm, ai_skills: e.target.value})} placeholder="e.g. RAG, NLP, Computer Vision" />
                  </div>
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea className="form-control" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} rows="3" />
                  </div>
                  <div className="form-group full-width">
                    <label>Risks</label>
                    <textarea className="form-control" value={projectForm.risks} onChange={e => setProjectForm({...projectForm, risks: e.target.value})} rows="2" placeholder="List potential risks for this project" />
                  </div>
                  <div className="form-group full-width">
                    <label>Dependencies</label>
                    <textarea className="form-control" value={projectForm.dependencies} onChange={e => setProjectForm({...projectForm, dependencies: e.target.value})} rows="2" placeholder="List dependencies (other projects, systems, teams)" />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProjectModal(false)} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : (editingProject ? 'Update' : 'Create') + ' Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-content">
            {toast.type === 'error' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
            {toast.type === 'success' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
          <button className="toast-close" onClick={() => setToast({ ...toast, show: false })}>&times;</button>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.show && (
        <div className="confirm-overlay" onClick={handleCancelConfirm}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 className="confirm-title">{confirmDialog.title}</h3>
            <p className="confirm-message">{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={handleCancelConfirm}>Cancel</button>
              <button className={`btn btn-${confirmDialog.type === 'warning' ? 'warning' : 'danger'}`} onClick={handleConfirm}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}
      <Tooltip id="admin-tooltip" />
    </div>
  );
}

export default Admin;
