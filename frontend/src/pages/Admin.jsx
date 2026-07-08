import { useState, useEffect } from 'react';
import { api } from '../api';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Tooltip } from 'react-tooltip';

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
    return <img src={icon} alt="app icon" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />;
  }
  if (icon) return <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{icon}</span>;
  if (usecaseType === 'AI Usecase') return <AIUsecaseIcon />;
  if (usecaseType === 'Foundation') return <FoundationIcon />;
  return <DefaultAppIcon />;
};

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

const PLATFORMS = ['MS Azure', 'AWS', 'GCP', 'Other'];

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

const USECASE_TYPES = ['AI Usecase', 'Foundation'];

const emptyProjectForm = {
  name: '', description: '', url: '', icon: '', category: '',
  business_division: '', business_function: '', requester_name: '', ai_spoc: '',
  priority: '', strategic_focus: '', doi_stage: 0, doi_changed_at: '', project_id: '',
  current_status: '', last_status: '', demand_type: '', platform: '',
  estimated_costs: '', start_date: '', end_date: '', ai_skills: '',
  risks: '', dependencies: '', usecase_type: ''
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
  const [showProjectPreview, setShowProjectPreview] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [showDeletedProjects, setShowDeletedProjects] = useState(false);
  const [deletedProjects, setDeletedProjects] = useState([]);
  const [projectDoiHistory, setProjectDoiHistory] = useState([]);
  const [requesterInput, setRequesterInput] = useState('');

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
  const [alertDialog, setAlertDialog] = useState({ show: false, title: '', message: '', type: 'error' });
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogLimit, setActivityLogLimit] = useState(10);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [activityLogExpanded, setActivityLogExpanded] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { theme, toggleTheme } = useTheme();

  // Use Case Intake
  const [useCaseIntakes, setUseCaseIntakes] = useState([]);
  const [useCaseForm, setUseCaseForm] = useState({
    idea_name: '', idea_owner: '', submission_date: '', sponsor: '', division: '',
    product_owner: '', capacity_confirmed: '', line_of_business: '', motivation: '',
    description_target: '', value_add: '', problem_evidence: '', solution_maturity: '',
    value_proof: '', dependencies_risks: '',
    complexity_integration: 1, complexity_data_security: 1, complexity_solution_type: 1,
    complexity_users: 1, complexity_process_change: 1, complexity_stakeholder: 1, complexity_effort_cost: 1,
    benefit_availability: 1, benefit_time_saving: 1, benefit_cost_reduction: 1,
    benefit_legacy_consolidation: 1, benefit_automation: 1, benefit_data_quality: 1, benefit_compliance: 1,
    status: 'Draft'
  });
  const [editingUseCase, setEditingUseCase] = useState(null);
  const [showUseCaseModal, setShowUseCaseModal] = useState(false);
  const [useCaseStep, setUseCaseStep] = useState(1);
  const [viewingUseCase, setViewingUseCase] = useState(null);
  const [actionModal, setActionModal] = useState({ show: false, useCase: null, action: '', comment: '' });
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [useCaseSearchQuery, setUseCaseSearchQuery] = useState('');
  const [useCaseStatusFilter, setUseCaseStatusFilter] = useState('all');
  const [useCaseClusterFilter, setUseCaseClusterFilter] = useState('all');
  const [useCaseTshirtFilter, setUseCaseTshirtFilter] = useState('all');
  const [useCaseSortColumn, setUseCaseSortColumn] = useState('submission_date');
  const [useCaseSortDirection, setUseCaseSortDirection] = useState('desc');

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortData = (data, getSortValue) => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal || '').localeCompare(String(bVal || ''));
      }
      return sortConfig.direction === 'desc' ? -comparison : comparison;
    });
  };

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

  const showAlert = (title, message, type = 'error') => {
    setAlertDialog({ show: true, title, message, type });
  };

  const getRequesters = () => {
    if (!projectForm.requester_name) return [];
    return projectForm.requester_name.split(',').map(r => r.trim()).filter(r => r);
  };

  const addRequester = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = getRequesters();
    if (current.some(r => r.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = [...current, trimmed].join(', ');
    setProjectForm({ ...projectForm, requester_name: updated });
    setRequesterInput('');
  };

  const removeRequester = (name) => {
    const current = getRequesters().filter(r => r !== name);
    setProjectForm({ ...projectForm, requester_name: current.join(', ') });
  };

  useEffect(() => {
    loadData();
    loadDeletedProjects();
  }, []);

  // Close admin profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showAdminProfile && !e.target.closest('.admin-profile-wrapper')) {
        setShowAdminProfile(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAdminProfile]);

  const loadData = async () => {
    try {
      const [appsRes, annRes, fbRes, widgetsRes, doiRes, usersRes, logsRes, useCasesRes] = await Promise.all([
        api.admin.getApps(),
        api.admin.getAnnouncements(),
        api.admin.getFeedback(),
        api.admin.getWidgets(),
        api.admin.getDoiStages(),
        api.admin.getAdminUsers(),
        api.admin.getActivityLogs(10),
        api.admin.getUseCaseIntakes()
      ]);
      setProjects(appsRes.data);
      setAnnouncements(annRes.data);
      setFeedback(fbRes.data);
      setWidgets(widgetsRes.data);
      setDoiStages(doiRes.data);
      setAdminUsers(usersRes.data);
      setActivityLogs(logsRes.data);
      setHasMoreLogs(logsRes.data.length >= 10);
      setUseCaseIntakes(useCasesRes.data);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const loadDeletedProjects = async () => {
    try {
      const res = await api.admin.getDeletedApps();
      setDeletedProjects(res.data);
    } catch (error) {
      console.error('Failed to load deleted projects:', error);
    }
  };

  const handleRestoreProject = async (project) => {
    try {
      await api.admin.restoreApp(project.id);
      logActivity('restored', 'project', project.id, project.name);
      showToast('Project restored successfully', 'success');
      loadData();
      loadDeletedProjects();
    } catch (error) {
      showToast('Failed to restore project', 'error');
    }
  };

  const handlePermanentDelete = (project) => {
    showConfirm(
      'Permanently Delete',
      `Are you sure you want to permanently delete "${project.name}"? This action cannot be undone.`,
      async () => {
        try {
          await api.admin.permanentDeleteApp(project.id);
          logActivity('permanently deleted', 'project', project.id, project.name);
          showToast('Project permanently deleted', 'success');
          loadDeletedProjects();
        } catch (error) {
          showToast('Failed to delete project', 'error');
        }
      }
    );
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
    if (editingProject) {
      await saveProject();
    } else {
      setShowProjectPreview(true);
    }
  };

  const confirmCreateProject = async () => {
    setShowProjectPreview(false);
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
        showToast('Project updated successfully', 'success');
      } else {
        const res = await api.admin.createApp(projectForm);
        const doi = doiStages.find(d => d.id === projectForm.doi_stage);
        const details = `Initial DOI: ${doi?.label || 'DOI ' + projectForm.doi_stage}${projectForm.priority ? ', Priority: ' + projectForm.priority : ''}`;
        logActivity('created', 'project', res.data.id, projectForm.name, details);
        showToast('Project created successfully', 'success');
      }
      setProjectForm({ ...emptyProjectForm });
      setEditingProject(null);
      setShowProjectModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save project', error);
      const errorMsg = error.response?.data?.error || 'Failed to save project';
      const isDuplicate = errorMsg.toLowerCase().includes('already exists');
      showAlert(isDuplicate ? 'Duplicate Project Name' : 'Error', errorMsg, isDuplicate ? 'warning' : 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProject = async (project) => {
    setEditingProject(project);
    setProjectForm({ ...emptyProjectForm, ...project, doi_changed_at: '' });
    setRequesterInput('');
    setShowProjectModal(true);
    try {
      const res = await api.getDoiHistory(project.id);
      setProjectDoiHistory(res.data);
    } catch (error) {
      console.error('Failed to load DOI history:', error);
      setProjectDoiHistory([]);
    }
  };

  const handleDeleteProject = (id, name) => {
    showConfirm('Delete Project', 'Are you sure you want to delete this project? This action cannot be undone.', async () => {
      await api.admin.deleteApp(id);
      logActivity('deleted', 'project', id, name);
      showToast('Project deleted', 'success');
      loadData();
      loadDeletedProjects();
    });
  };

  const handleInlineUpdate = async (project, field, value) => {
    try {
      const updateData = { ...project, [field]: value };
      await api.admin.updateApp(project.id, updateData);
      const fieldLabel = field === 'current_status' ? 'Status' : 'Platform';
      logActivity('updated', 'project', project.id, project.name, `${fieldLabel}: ${project[field] || 'none'} → ${value || 'none'}`);
      showToast(`${fieldLabel} updated`, 'success');
      loadData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update', 'error');
    }
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
        showToast('Announcement updated successfully', 'success');
      } else {
        const res = await api.admin.createAnnouncement(announcementForm);
        logActivity('created', 'announcement', res.data.id, announcementForm.title, `Type: ${announcementForm.type}`);
        showToast('Announcement created successfully', 'success');
      }
      setAnnouncementForm({ title: '', content: '', type: 'info' });
      loadData();
    } catch (error) {
      console.error('Failed to save announcement', error);
      showToast('Failed to save announcement', 'error');
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
      showToast('Announcement deleted', 'success');
      loadData();
    });
  };

  const handleUpdateFeedbackStatus = async (id, status) => {
    await api.admin.updateFeedbackStatus(id, status);
    const statusLabel = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    showToast(`Feedback marked as ${statusLabel}`, 'success');
    loadData();
  };

  const loadTeamMembers = async (appId) => {
    try {
      const res = await api.admin.getTeam(appId);
      setTeamMembers(res.data);
      return res.data;
    } catch (error) {
      console.error('Failed to load team members', error);
      return [];
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
        showToast('Team member updated', 'success');
      } else {
        await api.admin.addTeamMember(selectedProjectForTeam.id, teamForm);
        showToast('Team member added', 'success');
      }
      setTeamForm({ name: '', role: '', email: '' });
      setTeamSearchQuery('');
      const updatedMembers = await loadTeamMembers(selectedProjectForTeam.id);
      loadAllTeamMembers();
      // Update the project's team count in the sidebar
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectForTeam.id
          ? { ...p, team: updatedMembers || [] }
          : p
      ));
    } catch (error) {
      if (error.response?.data?.error) {
        showToast(error.response.data.error, 'error');
      } else {
        console.error('Failed to save team member', error);
        showToast('Failed to save team member', 'error');
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
      showToast('Team member removed', 'success');
      const updatedMembers = await loadTeamMembers(selectedProjectForTeam.id);
      // Update the project's team count in the sidebar
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectForTeam.id
          ? { ...p, team: updatedMembers || [] }
          : p
      ));
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
        showToast('Widget updated successfully', 'success');
      } else {
        const res = await api.admin.createWidget(widgetForm);
        logActivity('created', 'widget', res.data.id, widgetForm.title, `Chart: ${widgetForm.chart_type}, Field: ${widgetForm.data_field}`);
        showToast('Widget created successfully', 'success');
      }
      setWidgetForm({ title: '', chart_type: 'donut', data_field: 'doi_stage', color_scheme: 'default', display_order: 0 });
      setEditingWidget(null);
      setShowWidgetModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save widget', error);
      showToast('Failed to save widget', 'error');
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
    showToast(`Widget ${widget.is_active ? 'deactivated' : 'activated'}`, 'success');
    loadData();
  };

  const handleDeleteWidget = (id, title) => {
    showConfirm('Delete Widget', 'Are you sure you want to delete this widget?', async () => {
      await api.admin.deleteWidget(id);
      logActivity('deleted', 'widget', id, title);
      showToast('Widget deleted', 'success');
      loadData();
    });
  };

  // Use Case Intake Handlers
  const emptyUseCaseForm = {
    idea_name: '', usecase_type: '', idea_owner: '', submission_date: '', sponsor: '', division: '',
    product_owner: '', capacity_confirmed: '', line_of_business: '', motivation: '',
    description_target: '', value_add: '', problem_evidence: '', solution_maturity: '',
    value_proof: '', dependencies_risks: '',
    complexity_integration: 1, complexity_data_security: 1, complexity_solution_type: 1,
    complexity_users: 1, complexity_process_change: 1, complexity_stakeholder: 1, complexity_effort_cost: 1,
    benefit_availability: 1, benefit_time_saving: 1, benefit_cost_reduction: 1,
    benefit_legacy_consolidation: 1, benefit_automation: 1, benefit_data_quality: 1, benefit_compliance: 1,
    status: 'Draft'
  };

  const calculateUseCaseScores = (form) => {
    const complexityScore = (form.complexity_integration || 1) + (form.complexity_data_security || 1) +
      (form.complexity_solution_type || 1) + (form.complexity_users || 1) + (form.complexity_process_change || 1) +
      (form.complexity_stakeholder || 1) + (form.complexity_effort_cost || 1);

    const benefitScore = (form.benefit_availability || 1) + (form.benefit_time_saving || 1) +
      (form.benefit_cost_reduction || 1) + (form.benefit_legacy_consolidation || 1) +
      (form.benefit_automation || 1) + (form.benefit_data_quality || 1) + (form.benefit_compliance || 1);

    const priorityIndex = Math.round((benefitScore / 28 * 70) + ((29 - complexityScore) / 28 * 30));

    let priorityCluster;
    if (complexityScore > 16 && benefitScore < 18) priorityCluster = 'Rework';
    else if (complexityScore <= 16 && benefitScore >= 18) priorityCluster = 'High Priority / Quick Win';
    else if (complexityScore <= 16 && benefitScore < 18) priorityCluster = 'Low Priority';
    else priorityCluster = 'Medium Priority';

    let recommendedAction;
    if (priorityCluster === 'High Priority / Quick Win') recommendedAction = 'Start with DOI1';
    else if (priorityCluster === 'Medium Priority') recommendedAction = 'Approval for DOI1 necessary';
    else if (priorityCluster === 'Low Priority') recommendedAction = 'Park in Backlog; Benefit not sufficient';
    else recommendedAction = 'Decline and rework';

    const totalScore = complexityScore + benefitScore;
    let tshirtSize;
    if (totalScore < 16) tshirtSize = 'XS';
    else if (totalScore <= 20) tshirtSize = 'S';
    else if (totalScore <= 28) tshirtSize = 'M';
    else if (totalScore <= 42) tshirtSize = 'L';
    else tshirtSize = 'XL';

    return { complexityScore, benefitScore, priorityIndex, priorityCluster, recommendedAction, tshirtSize };
  };

  const handleUseCaseSubmit = async (e) => {
    e.preventDefault();
    if (!useCaseForm.idea_name) {
      showAlert('Idea name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingUseCase) {
        await api.admin.updateUseCaseIntake(editingUseCase.id, { ...useCaseForm, status: 'Resubmitted' });
        logActivity('updated', 'use_case', editingUseCase.id, useCaseForm.idea_name);
        showToast('Use case updated and resubmitted for review', 'success');
      } else {
        const res = await api.admin.createUseCaseIntake({ ...useCaseForm, status: 'Submitted' });
        logActivity('created', 'use_case', res.data.id, useCaseForm.idea_name);
        showToast('Use case submitted successfully', 'success');
      }
      setShowUseCaseModal(false);
      setEditingUseCase(null);
      setUseCaseForm({ ...emptyUseCaseForm });
      setUseCaseStep(1);
      loadData();
    } catch (error) {
      showAlert('Failed to save use case', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditUseCase = (useCase) => {
    setEditingUseCase(useCase);
    // Format submission_date for date input (YYYY-MM-DD)
    let formattedDate = '';
    if (useCase.submission_date) {
      const date = new Date(useCase.submission_date);
      formattedDate = date.toISOString().split('T')[0];
    }
    setUseCaseForm({
      idea_name: useCase.idea_name || '',
      usecase_type: useCase.usecase_type || '',
      idea_owner: useCase.idea_owner || '',
      submission_date: formattedDate,
      sponsor: useCase.sponsor || '',
      division: useCase.division || '',
      product_owner: useCase.product_owner || '',
      capacity_confirmed: useCase.capacity_confirmed || '',
      line_of_business: useCase.line_of_business || '',
      motivation: useCase.motivation || '',
      description_target: useCase.description_target || '',
      value_add: useCase.value_add || '',
      problem_evidence: useCase.problem_evidence || '',
      solution_maturity: useCase.solution_maturity || '',
      value_proof: useCase.value_proof || '',
      dependencies_risks: useCase.dependencies_risks || '',
      complexity_integration: useCase.complexity_integration || 1,
      complexity_data_security: useCase.complexity_data_security || 1,
      complexity_solution_type: useCase.complexity_solution_type || 1,
      complexity_users: useCase.complexity_users || 1,
      complexity_process_change: useCase.complexity_process_change || 1,
      complexity_stakeholder: useCase.complexity_stakeholder || 1,
      complexity_effort_cost: useCase.complexity_effort_cost || 1,
      benefit_availability: useCase.benefit_availability || 1,
      benefit_time_saving: useCase.benefit_time_saving || 1,
      benefit_cost_reduction: useCase.benefit_cost_reduction || 1,
      benefit_legacy_consolidation: useCase.benefit_legacy_consolidation || 1,
      benefit_automation: useCase.benefit_automation || 1,
      benefit_data_quality: useCase.benefit_data_quality || 1,
      benefit_compliance: useCase.benefit_compliance || 1,
      status: useCase.status || 'Draft'
    });
    setUseCaseStep(1);
    setShowUseCaseModal(true);
  };

  const handleDeleteUseCase = (id, name) => {
    showConfirm('Delete Use Case', `Are you sure you want to delete "${name}"?`, async () => {
      await api.admin.deleteUseCaseIntake(id);
      logActivity('deleted', 'use_case', id, name);
      showToast('Use case deleted', 'success');
      loadData();
    });
  };

  const handleUseCaseAction = (useCase, action) => {
    setActionModal({ show: true, useCase, action, comment: '' });
  };

  const getActionDetails = (action) => {
    switch (action) {
      case 'approve': return { status: 'Approved', title: 'Approve Use Case', placeholder: 'Add approval notes (optional)', required: false };
      case 'start_doi1': return { status: 'In Progress', title: 'Start DOI1', placeholder: 'Add notes for starting DOI1 (optional)', required: false };
      case 'park': return { status: 'Parked', title: 'Park Use Case', placeholder: 'Why is this being parked? (optional)', required: false };
      case 'decline': return { status: 'Declined', title: 'Decline Use Case', placeholder: 'Reason for declining (required)', required: true };
      case 'rework': return { status: 'Rework Required', title: 'Send for Rework', placeholder: 'What needs to be reworked? (required)', required: true };
      default: return { status: '', title: '', placeholder: '', required: false };
    }
  };

  const handleActionConfirm = async () => {
    const { useCase, action, comment } = actionModal;
    const details = getActionDetails(action);

    if (details.required && !comment.trim()) {
      showAlert('A comment is required for this action', 'error');
      return;
    }

    const adminName = currentAdmin?.name || 'Admin';
    const timestamp = new Date().toLocaleString();
    const newNote = comment.trim()
      ? `[${timestamp}] ${details.status} by ${adminName}: ${comment}`
      : `[${timestamp}] ${details.status} by ${adminName}`;

    try {
      // Update use case status - backend will automatically move linked project to DOI 1
      await api.admin.updateUseCaseIntake(useCase.id, {
        ...useCase,
        status: details.status,
        admin_notes: useCase.admin_notes ? `${newNote}\n${useCase.admin_notes}` : newNote
      });
      logActivity('updated_status', 'use_case', useCase.id, `${useCase.idea_name} → ${details.status}`);
      const toastMsg = (action === 'approve' || action === 'start_doi1')
        ? `Use case ${details.status.toLowerCase()} - Project moved to DOI 1`
        : `Use case ${details.status.toLowerCase()}`;
      showToast(toastMsg, 'success');
      setActionModal({ show: false, useCase: null, action: '', comment: '' });
      loadData();
    } catch (error) {
      console.error('Error:', error);
      showAlert('Failed to update use case', 'error');
    }
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
        <button className={`header-tab ${activeTab === 'use-cases' ? 'active' : ''}`} onClick={() => setActiveTab('use-cases')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6"/><path d="M9 16h6"/>
          </svg>
          Use Cases
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
          {feedback.filter(f => f.status === 'new').length > 0 && (
            <span className="tab-badge">{feedback.filter(f => f.status === 'new').length}</span>
          )}
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
            <button className="btn btn-primary" onClick={() => { setEditingProject(null); setProjectForm({ ...emptyProjectForm }); setProjectDoiHistory([]); setRequesterInput(''); setShowProjectModal(true); }}>
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
                <div className="stat-number">{projects.filter(p => p.doi_stage >= 4).length}</div>
                <div className="stat-label">In Production</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{projects.filter(p => p.doi_stage < 4).length}</div>
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

            <div
              className="activity-log-header"
              onClick={() => setActivityLogExpanded(!activityLogExpanded)}
            >
              <h3>Activity Log</h3>
              <div className="activity-log-toggle">
                <span className="activity-log-count">{activityLogs.length} entries</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ transform: activityLogExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </div>
            {activityLogExpanded && <div className="activity-log-container">
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
            </div>}
          </div>
        )}

        {/* Projects */}
        {activeTab === 'projects' && (
          <div className="admin-table-container">
            <div className="projects-toolbar">
              <div className="admin-search-bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, ID (AI_001, F_001), division, status..."
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                />
                {projectSearchQuery && (
                  <button className="search-clear" onClick={() => setProjectSearchQuery('')}>×</button>
                )}
              </div>
              <button
                className={`btn btn-sm ${showDeletedProjects ? 'btn-warning' : 'btn-outline'}`}
                onClick={() => {
                  setShowDeletedProjects(!showDeletedProjects);
                  if (!showDeletedProjects) loadDeletedProjects();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                {showDeletedProjects ? 'Show Active' : `Deleted (${deletedProjects.length})`}
              </button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="sortable-th" onClick={() => handleSort('name')}><span className="th-content">Project Name<span className={`sort-icon ${sortConfig.key === 'name' ? 'active' : ''}`}>{sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></span></th>
                  <th className="sortable-th" onClick={() => handleSort('division')}><span className="th-content">Division<span className={`sort-icon ${sortConfig.key === 'division' ? 'active' : ''}`}>{sortConfig.key === 'division' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></span></th>
                  <th className="sortable-th" onClick={() => handleSort('function')}><span className="th-content">Function<span className={`sort-icon ${sortConfig.key === 'function' ? 'active' : ''}`}>{sortConfig.key === 'function' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></span></th>
                  <th className="sortable-th" onClick={() => handleSort('doi')}><span className="th-content">DOI<span className={`sort-icon ${sortConfig.key === 'doi' ? 'active' : ''}`}>{sortConfig.key === 'doi' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></span></th>
                  <th className="sortable-th" onClick={() => handleSort('status')}><span className="th-content">Status<span className={`sort-icon ${sortConfig.key === 'status' ? 'active' : ''}`}>{sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></span></th>
                  <th className="sortable-th" onClick={() => handleSort('platform')}><span className="th-content">Platform<span className={`sort-icon ${sortConfig.key === 'platform' ? 'active' : ''}`}>{sortConfig.key === 'platform' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></span></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortData((showDeletedProjects ? deletedProjects : projects).filter(project => {
                  if (!projectSearchQuery) return true;
                  const query = projectSearchQuery.toLowerCase();
                  return (
                    project.name?.toLowerCase().includes(query) ||
                    project.project_id?.toLowerCase().includes(query) ||
                    project.usecase_identifier?.toLowerCase().includes(query) ||
                    project.business_division?.toLowerCase().includes(query) ||
                    project.business_function?.toLowerCase().includes(query) ||
                    project.current_status?.toLowerCase().includes(query) ||
                    project.platform?.toLowerCase().includes(query) ||
                    project.requester_name?.toLowerCase().includes(query) ||
                    project.ai_spoc?.toLowerCase().includes(query)
                  );
                }), (p, key) => {
                  switch(key) {
                    case 'name': return p.name?.toLowerCase() || '';
                    case 'division': return p.business_division?.toLowerCase() || '';
                    case 'function': return p.business_function?.toLowerCase() || '';
                    case 'doi': return p.doi_stage || 0;
                    case 'status': return p.current_status?.toLowerCase() || '';
                    case 'platform': return p.platform?.toLowerCase() || '';
                    default: return '';
                  }
                }).map(project => (
                  <tr key={project.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="admin-project-icon">
                          <AppIcon icon={project.icon} usecaseType={project.usecase_type} />
                        </div>
                        <div>
                          {project.usecase_identifier && <div style={{ fontSize: '0.75rem', color: '#5f6f65', background: '#e8ede9', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', fontWeight: 500, marginBottom: '2px' }}>{project.usecase_identifier}</div>}
                          <div style={{ fontWeight: 600 }}>{project.name}</div>
                          {project.project_id && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {project.project_id}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{project.business_division || '-'}</td>
                    <td>{project.business_function || '-'}</td>
                    <td><span className={`doi-badge doi-${project.doi_stage || 0}`}>DOI {project.doi_stage || 0}</span></td>
                    <td>
                      {showDeletedProjects ? (
                        <span>{project.current_status || '-'}</span>
                      ) : (
                        <select
                          className="inline-select"
                          value={project.current_status || ''}
                          onChange={(e) => handleInlineUpdate(project, 'current_status', e.target.value)}
                        >
                          <option value="">-</option>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </td>
                    <td>
                      {showDeletedProjects ? (
                        <span>{project.platform || '-'}</span>
                      ) : (
                        <select
                          className="inline-select"
                          value={project.platform || ''}
                          onChange={(e) => handleInlineUpdate(project, 'platform', e.target.value)}
                        >
                          <option value="">-</option>
                          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {showDeletedProjects ? (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => handleRestoreProject(project)}>Restore</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handlePermanentDelete(project)}>Delete Forever</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleEditProject(project)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProject(project.id, project.name)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!showDeletedProjects && projects.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No projects. Click "Add Project" to create one.</td></tr>
                )}
                {showDeletedProjects && deletedProjects.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No deleted projects.</td></tr>
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
          <div className="teams-layout">
            {/* Left Sidebar - Project List */}
            <div className="teams-sidebar">
              <div className="teams-sidebar-header">
                <h3>Projects</h3>
                <p>{projects.length} total projects</p>
              </div>
              <div className="teams-sidebar-search">
                <input
                  type="text"
                  placeholder="Search projects..."
                  onChange={(e) => {
                    const search = e.target.value.toLowerCase();
                    if (!search) return;
                  }}
                />
              </div>
              <div className="teams-sidebar-list">
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => handleSelectProjectForTeam(project)}
                    className={`team-project-item ${selectedProjectForTeam?.id === project.id ? 'selected' : ''}`}
                  >
                    <span className="team-project-icon"><AppIcon icon={project.icon} usecaseType={project.usecase_type} /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="project-name">{project.name}</div>
                      <div className="project-meta">{project.team?.length || 0} members</div>
                    </div>
                  </div>
                ))}
                {projects.length === 0 && (
                  <div style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>No projects available</div>
                )}
              </div>
            </div>

            {/* Right Main Content */}
            <div className="teams-main">
              {selectedProjectForTeam ? (
                <>
                  {/* Project Header */}
                  <div className="teams-project-header">
                    <div className="teams-project-header-icon">
                      <AppIcon icon={selectedProjectForTeam.icon} usecaseType={selectedProjectForTeam.usecase_type} />
                    </div>
                    <div className="teams-project-header-info">
                      <h2>{selectedProjectForTeam.name}</h2>
                      <p>{selectedProjectForTeam.usecase_identifier || 'No identifier'}</p>
                    </div>
                    <div className="teams-project-stats">
                      <div className="teams-stat">
                        <div className="teams-stat-value">{teamMembers.length}</div>
                        <div className="teams-stat-label">Members</div>
                      </div>
                    </div>
                  </div>

                  {/* Two Column Layout: Add Form + Members List */}
                  <div className="teams-content-row">
                    {/* Add/Edit Member Form */}
                    <div className="teams-add-member">
                      <div className="teams-add-member-header">
                        <h3>{editingTeamMember ? 'Edit Member' : 'Add Member'}</h3>
                      </div>
                      <form className="teams-add-member-form" onSubmit={handleAddTeamMember}>
                        <div className="teams-form-group">
                          <label>Name *</label>
                          <div className="searchable-select">
                            <input
                              type="text"
                              placeholder="Search or type name..."
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
                        <div className="teams-form-group">
                          <label>Role</label>
                          <input
                            type="text"
                            value={teamForm.role}
                            onChange={e => setTeamForm({...teamForm, role: e.target.value})}
                            placeholder="e.g. Developer"
                          />
                        </div>
                        <div className="teams-form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={teamForm.email}
                            onChange={e => setTeamForm({...teamForm, email: e.target.value})}
                            placeholder="email@company.com"
                          />
                        </div>
                        <div className="teams-form-actions">
                          <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : (editingTeamMember ? 'Update' : 'Add')}
                          </button>
                          {editingTeamMember && (
                            <button type="button" className="btn-secondary" onClick={handleCancelEditTeamMember} disabled={saving}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Team Members List */}
                    <div className="teams-members-section">
                      <div className="teams-members-header">
                        <h3>Team Members</h3>
                      </div>
                      {teamMembers.length > 0 ? (
                        <div className="teams-members-list">
                          {teamMembers.map(m => (
                            <div key={m.id} className="team-member-row">
                              <div className="team-member-avatar">
                                {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div className="team-member-info">
                                <h4>{m.name}</h4>
                                <span className="role">{m.role || '-'}</span>
                              </div>
                              <div className="team-member-email-inline">{m.email || '-'}</div>
                              <div className="team-member-actions">
                                <button className="edit" onClick={() => handleEditTeamMember(m)}>Edit</button>
                                <button className="remove" onClick={() => handleDeleteTeamMember(m.id)}>Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="teams-empty-members">
                          <p>No team members yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="teams-empty-state">
                  <div className="teams-empty-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <h3>Select a Project</h3>
                  <p>Choose a project from the sidebar to manage its team</p>
                </div>
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

        {/* Use Cases */}
        {activeTab === 'use-cases' && (
          <div>
            <div className="admin-table-container">
              <div className="projects-toolbar">
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: '12px' }}>{useCaseIntakes.length}</span>
                <div className="admin-search-bar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by name, owner, division..."
                    value={useCaseSearchQuery}
                    onChange={(e) => setUseCaseSearchQuery(e.target.value)}
                  />
                  {useCaseSearchQuery && (
                    <button className="search-clear" onClick={() => setUseCaseSearchQuery('')}>×</button>
                  )}
                </div>
                <select
                  className="filter-select"
                  value={useCaseStatusFilter}
                  onChange={(e) => setUseCaseStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Resubmitted">Resubmitted</option>
                  <option value="Approved">Approved</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Parked">Parked</option>
                  <option value="Declined">Declined</option>
                  <option value="Rework Required">Rework Required</option>
                </select>
                <select
                  className="filter-select"
                  value={useCaseClusterFilter}
                  onChange={(e) => setUseCaseClusterFilter(e.target.value)}
                >
                  <option value="all">All Clusters</option>
                  <option value="High Priority / Quick Win">High Priority / Quick Win</option>
                  <option value="Medium Priority">Medium Priority</option>
                  <option value="Low Priority">Low Priority</option>
                  <option value="Rework">Rework</option>
                </select>
                <select
                  className="filter-select"
                  value={useCaseTshirtFilter}
                  onChange={(e) => setUseCaseTshirtFilter(e.target.value)}
                >
                  <option value="all">All T-Shirts</option>
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                </select>
                <button className="btn btn-primary" onClick={() => { setEditingUseCase(null); setUseCaseForm({ ...emptyUseCaseForm, submission_date: new Date().toISOString().split('T')[0] }); setUseCaseStep(1); setShowUseCaseModal(true); }}>
                  + New Use Case
                </button>
              </div>
              <table className="admin-table usecase-intake-table">
              <thead>
                <tr>
                  <th onClick={() => { setUseCaseSortColumn('idea_name'); setUseCaseSortDirection(useCaseSortColumn === 'idea_name' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Idea Name {useCaseSortColumn === 'idea_name' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => { setUseCaseSortColumn('usecase_type'); setUseCaseSortDirection(useCaseSortColumn === 'usecase_type' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Type {useCaseSortColumn === 'usecase_type' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => { setUseCaseSortColumn('submission_date'); setUseCaseSortDirection(useCaseSortColumn === 'submission_date' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Submitted {useCaseSortColumn === 'submission_date' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => { setUseCaseSortColumn('idea_owner'); setUseCaseSortDirection(useCaseSortColumn === 'idea_owner' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Owner {useCaseSortColumn === 'idea_owner' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => { setUseCaseSortColumn('division'); setUseCaseSortDirection(useCaseSortColumn === 'division' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Division {useCaseSortColumn === 'division' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => { setUseCaseSortColumn('priority_index'); setUseCaseSortDirection(useCaseSortColumn === 'priority_index' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Priority Index {useCaseSortColumn === 'priority_index' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => { setUseCaseSortColumn('priority_cluster'); setUseCaseSortDirection(useCaseSortColumn === 'priority_cluster' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Cluster {useCaseSortColumn === 'priority_cluster' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => { setUseCaseSortColumn('tshirt_size'); setUseCaseSortDirection(useCaseSortColumn === 'tshirt_size' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    T-Shirt {useCaseSortColumn === 'tshirt_size' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Recommendation</th>
                  <th onClick={() => { setUseCaseSortColumn('status'); setUseCaseSortDirection(useCaseSortColumn === 'status' && useCaseSortDirection === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                    Status {useCaseSortColumn === 'status' && (useCaseSortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {useCaseIntakes.filter(uc => {
                  const matchesSearch = !useCaseSearchQuery ||
                    uc.idea_name?.toLowerCase().includes(useCaseSearchQuery.toLowerCase()) ||
                    uc.idea_owner?.toLowerCase().includes(useCaseSearchQuery.toLowerCase()) ||
                    uc.division?.toLowerCase().includes(useCaseSearchQuery.toLowerCase());
                  const matchesStatus = useCaseStatusFilter === 'all' || uc.status === useCaseStatusFilter;
                  const matchesCluster = useCaseClusterFilter === 'all' || uc.priority_cluster === useCaseClusterFilter;
                  const matchesTshirt = useCaseTshirtFilter === 'all' || uc.tshirt_size === useCaseTshirtFilter;
                  return matchesSearch && matchesStatus && matchesCluster && matchesTshirt;
                }).sort((a, b) => {
                  const tshirtOrder = { 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5 };
                  let aVal = a[useCaseSortColumn];
                  let bVal = b[useCaseSortColumn];
                  if (useCaseSortColumn === 'tshirt_size') {
                    aVal = tshirtOrder[aVal] || 0;
                    bVal = tshirtOrder[bVal] || 0;
                  } else if (useCaseSortColumn === 'priority_index') {
                    aVal = aVal || 0;
                    bVal = bVal || 0;
                  } else if (useCaseSortColumn === 'submission_date') {
                    aVal = aVal ? new Date(aVal).getTime() : 0;
                    bVal = bVal ? new Date(bVal).getTime() : 0;
                  } else {
                    aVal = (aVal || '').toString().toLowerCase();
                    bVal = (bVal || '').toString().toLowerCase();
                  }
                  if (aVal < bVal) return useCaseSortDirection === 'asc' ? -1 : 1;
                  if (aVal > bVal) return useCaseSortDirection === 'asc' ? 1 : -1;
                  return 0;
                }).map(uc => (
                  <tr key={uc.id}>
                    <td style={{ fontWeight: 600 }}>{uc.idea_name}</td>
                    <td><span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: uc.usecase_type === 'AI Usecase' ? '#dbeafe' : '#f3e8ff', color: uc.usecase_type === 'AI Usecase' ? '#1e40af' : '#7c3aed' }}>{uc.usecase_type || '-'}</span></td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{uc.submission_date ? new Date(uc.submission_date).toLocaleDateString() : '-'}</td>
                    <td>{uc.idea_owner || '-'}</td>
                    <td>{uc.division || '-'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        background: uc.priority_index >= 70 ? '#dcfce7' : uc.priority_index >= 50 ? '#fef3c7' : '#fee2e2',
                        color: uc.priority_index >= 70 ? '#166534' : uc.priority_index >= 50 ? '#92400e' : '#991b1b'
                      }}>
                        {uc.priority_index}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${uc.priority_cluster === 'High Priority / Quick Win' ? 'active' : uc.priority_cluster === 'Medium Priority' ? 'on-hold' : uc.priority_cluster === 'Low Priority' ? 'cancelled' : 'in-review'}`}>
                        {uc.priority_cluster}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        background: '#e0e7ff',
                        color: '#3730a3'
                      }}>
                        {uc.tshirt_size}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: uc.priority_cluster === 'High Priority / Quick Win' ? '#166534' :
                               uc.priority_cluster === 'Rework' ? '#991b1b' : 'var(--text-primary)'
                      }}>
                        {uc.recommended_action?.replace('; Benefit not sufficient', '')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${
                        uc.status === 'Submitted' || uc.status === 'Resubmitted' ? 'active' :
                        uc.status === 'Approved' || uc.status === 'In Progress' ? 'completed' :
                        uc.status === 'Parked' ? 'on-hold' :
                        uc.status === 'Declined' ? 'cancelled' :
                        uc.status === 'Rework Required' ? 'in-review' : 'in-review'
                      }`}>{uc.status}</span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {(uc.status === 'Submitted' || uc.status === 'Resubmitted') && (
                          <>
                            {uc.priority_cluster === 'High Priority / Quick Win' && (
                              <button className="btn btn-sm btn-success" onClick={() => handleUseCaseAction(uc, 'start_doi1')}>Start DOI1</button>
                            )}
                            {uc.priority_cluster === 'Medium Priority' && (
                              <>
                                <button className="btn btn-sm btn-success" onClick={() => handleUseCaseAction(uc, 'approve')}>Approve</button>
                                <button className="btn btn-sm" onClick={() => handleUseCaseAction(uc, 'park')}>Park</button>
                              </>
                            )}
                            {uc.priority_cluster === 'Low Priority' && (
                              <button className="btn btn-sm" onClick={() => handleUseCaseAction(uc, 'park')}>Park</button>
                            )}
                            {uc.priority_cluster === 'Rework' && (
                              <>
                                <button className="btn btn-sm btn-warning" onClick={() => handleUseCaseAction(uc, 'rework')}>Rework</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleUseCaseAction(uc, 'decline')}>Decline</button>
                              </>
                            )}
                          </>
                        )}
                        {uc.status === 'Parked' && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => handleUseCaseAction(uc, 'approve')}>Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleUseCaseAction(uc, 'decline')}>Decline</button>
                          </>
                        )}
                        {uc.status === 'Rework Required' && (
                          <>
                            <button className="btn btn-sm" onClick={() => handleUseCaseAction(uc, 'park')}>Park</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleUseCaseAction(uc, 'decline')}>Decline</button>
                          </>
                        )}
                        {!['Approved', 'Declined', 'In Progress'].includes(uc.status) && (
                          <button className="btn btn-sm btn-icon" onClick={() => handleEditUseCase(uc)} title="Edit" data-tooltip-id="admin-tooltip" data-tooltip-content="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        )}
                        <button className="btn btn-sm btn-icon btn-icon-danger" onClick={() => handleDeleteUseCase(uc.id, uc.idea_name)} title="Delete" data-tooltip-id="admin-tooltip" data-tooltip-content="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                        <button className="btn btn-sm btn-icon btn-icon-primary" onClick={() => setViewingUseCase(uc)} title="View" data-tooltip-id="admin-tooltip" data-tooltip-content="View">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {useCaseIntakes.filter(uc => {
                  const matchesSearch = !useCaseSearchQuery ||
                    uc.idea_name?.toLowerCase().includes(useCaseSearchQuery.toLowerCase()) ||
                    uc.idea_owner?.toLowerCase().includes(useCaseSearchQuery.toLowerCase()) ||
                    uc.division?.toLowerCase().includes(useCaseSearchQuery.toLowerCase());
                  const matchesStatus = useCaseStatusFilter === 'all' || uc.status === useCaseStatusFilter;
                  const matchesCluster = useCaseClusterFilter === 'all' || uc.priority_cluster === useCaseClusterFilter;
                  const matchesTshirt = useCaseTshirtFilter === 'all' || uc.tshirt_size === useCaseTshirtFilter;
                  return matchesSearch && matchesStatus && matchesCluster && matchesTshirt;
                }).length === 0 && (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                      {useCaseIntakes.length === 0
                        ? 'No use cases yet. Click "New Use Case" to create one.'
                        : 'No use cases match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
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

        {/* Use Case Modal */}
        {showUseCaseModal && (
          <div className="modal-overlay" onClick={() => setShowUseCaseModal(false)}>
            <div className="modal modal-large" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header">
                <h2>{editingUseCase ? 'Edit Use Case' : 'New Use Case Intake'}</h2>
                <button className="modal-close" onClick={() => setShowUseCaseModal(false)}>&times;</button>
              </div>

              {/* Step Indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
                {[1, 2, 3, 4].map(step => {
                  const canAccess = step === 1 || (useCaseForm.idea_name?.trim() && useCaseForm.usecase_type && useCaseForm.submission_date);
                  return (
                    <div
                      key={step}
                      onClick={() => {
                        if (step > 1 && !useCaseForm.idea_name?.trim()) {
                          showAlert('Please fill in Idea Name first', 'error');
                          return;
                        }
                        if (step > 1 && !useCaseForm.usecase_type) {
                          showAlert('Please select Use Case Type first', 'error');
                          return;
                        }
                        if (step > 1 && !useCaseForm.submission_date) {
                          showAlert('Please fill in Submission Date first', 'error');
                          return;
                        }
                        setUseCaseStep(step);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                        borderRadius: '20px', cursor: canAccess ? 'pointer' : 'not-allowed',
                        background: useCaseStep === step ? 'var(--brand-primary)' : 'var(--bg-muted)',
                        color: useCaseStep === step ? 'white' : 'var(--text-secondary)',
                        fontWeight: 500, fontSize: '0.85rem',
                        opacity: canAccess ? 1 : 0.5
                      }}
                    >
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: useCaseStep === step ? 'white' : 'var(--border-light)',
                        color: useCaseStep === step ? 'var(--brand-primary)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700
                      }}>{step}</span>
                      {step === 1 ? 'Basic Info' : step === 2 ? 'Details' : step === 3 ? 'Complexity' : 'Benefit'}
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleUseCaseSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                  {/* Step 1: Basic Info */}
                  {useCaseStep === 1 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label>Idea Name *</label>
                        <input type="text" className="form-control" value={useCaseForm.idea_name} onChange={e => setUseCaseForm({...useCaseForm, idea_name: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>Use Case Type *</label>
                        <select className="form-control" value={useCaseForm.usecase_type || ''} onChange={e => setUseCaseForm({...useCaseForm, usecase_type: e.target.value})} required>
                          <option value="">Select...</option>
                          {USECASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Idea Owner</label>
                        <input type="text" className="form-control" value={useCaseForm.idea_owner} onChange={e => setUseCaseForm({...useCaseForm, idea_owner: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Submission Date *</label>
                        <input type="date" className="form-control" value={useCaseForm.submission_date} onChange={e => setUseCaseForm({...useCaseForm, submission_date: e.target.value})} max={new Date().toISOString().split('T')[0]} required />
                      </div>
                      <div className="form-group">
                        <label>Sponsor</label>
                        <input type="text" className="form-control" value={useCaseForm.sponsor} onChange={e => setUseCaseForm({...useCaseForm, sponsor: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Division</label>
                        <input type="text" className="form-control" value={useCaseForm.division} onChange={e => setUseCaseForm({...useCaseForm, division: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Product Owner</label>
                        <input type="text" className="form-control" value={useCaseForm.product_owner} onChange={e => setUseCaseForm({...useCaseForm, product_owner: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Capacity Confirmed</label>
                        <select className="form-control" value={useCaseForm.capacity_confirmed} onChange={e => setUseCaseForm({...useCaseForm, capacity_confirmed: e.target.value})}>
                          <option value="">Select...</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Line of Business</label>
                        <input type="text" className="form-control" value={useCaseForm.line_of_business} onChange={e => setUseCaseForm({...useCaseForm, line_of_business: e.target.value})} />
                      </div>
                    </div>
                  )}

                  {/* Step 2: Details */}
                  {useCaseStep === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label>Motivation <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Why?)</span></label>
                        <textarea className="form-control" rows="2" value={useCaseForm.motivation} onChange={e => setUseCaseForm({...useCaseForm, motivation: e.target.value})} placeholder="Why is this idea important?" />
                      </div>
                      <div className="form-group">
                        <label>Description & Target <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(What?)</span></label>
                        <textarea className="form-control" rows="2" value={useCaseForm.description_target} onChange={e => setUseCaseForm({...useCaseForm, description_target: e.target.value})} placeholder="What is the idea and its target?" />
                      </div>
                      <div className="form-group">
                        <label>Value Add <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Benefit?)</span></label>
                        <textarea className="form-control" rows="2" value={useCaseForm.value_add} onChange={e => setUseCaseForm({...useCaseForm, value_add: e.target.value})} placeholder="What benefits will this bring?" />
                      </div>
                      <div className="form-group">
                        <label>Problem Evidence <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(How do you know?)</span></label>
                        <textarea className="form-control" rows="2" value={useCaseForm.problem_evidence} onChange={e => setUseCaseForm({...useCaseForm, problem_evidence: e.target.value})} placeholder="What evidence supports this problem?" />
                      </div>
                      <div className="form-group">
                        <label>Solution Maturity <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Why now?)</span></label>
                        <textarea className="form-control" rows="2" value={useCaseForm.solution_maturity} onChange={e => setUseCaseForm({...useCaseForm, solution_maturity: e.target.value})} placeholder="Why is this solution ready now?" />
                      </div>
                      <div className="form-group">
                        <label>Value Proof <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Business Case)</span></label>
                        <textarea className="form-control" rows="2" value={useCaseForm.value_proof} onChange={e => setUseCaseForm({...useCaseForm, value_proof: e.target.value})} placeholder="Simplified business case" />
                      </div>
                      <div className="form-group">
                        <label>Dependencies & Risks</label>
                        <textarea className="form-control" rows="2" value={useCaseForm.dependencies_risks} onChange={e => setUseCaseForm({...useCaseForm, dependencies_risks: e.target.value})} placeholder="What are the dependencies and risks?" />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Complexity Scorecard */}
                  {useCaseStep === 3 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Complexity Scorecard</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Select the option that best describes the complexity</p>
                        </div>
                        <div style={{ padding: '8px 16px', background: '#fef3c7', borderRadius: '8px', fontWeight: 700, color: '#92400e' }}>
                          Score: {(useCaseForm.complexity_integration || 1) + (useCaseForm.complexity_data_security || 1) + (useCaseForm.complexity_solution_type || 1) + (useCaseForm.complexity_users || 1) + (useCaseForm.complexity_process_change || 1) + (useCaseForm.complexity_stakeholder || 1) + (useCaseForm.complexity_effort_cost || 1)} / 28
                        </div>
                      </div>
                      {[
                        { key: 'complexity_integration', label: 'Integration / System Landscape', options: ['1 system / standalone', '2-3 systems', '4-5 systems', '6+ or unclear'] },
                        { key: 'complexity_data_security', label: 'Data & Information Security', options: ['Non-critical, 1 source', 'Multiple sources, non-critical', 'Unstructured / distributed', 'Sensitive / personal / IP-critical'] },
                        { key: 'complexity_solution_type', label: 'Type of Solution / Implementation', options: ['Configuration of standard solution', 'Standard solution + customization', 'In-house development / custom component', 'Architecture / platform intervention, multi-layered'] },
                        { key: 'complexity_users', label: 'Users / Reach', options: ['< 20 (pilot/team)', '20-200 (department)', '200-2,000 (division)', '2,000+ (cross-functional / company-wide)'] },
                        { key: 'complexity_process_change', label: 'Process & Organizational Change', options: ['Only a tool, same process', 'Minor process adjustments', 'New workflow, roles shift', 'Cross-functional redesign, governance change'] },
                        { key: 'complexity_stakeholder', label: 'Change & Stakeholder Complexity', options: ['Single team, no change mgmt needed', 'Multiple teams, informal alignment', 'Formal change mgmt, training required', 'Works council / legal approval, cross-division'] },
                        { key: 'complexity_effort_cost', label: 'Effort / Cost (indicative)', options: ['10-50 k€', '50-250 k€', '250-750 k€', '> 750 k€'] }
                      ].map(item => (
                        <div key={item.key} style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>{item.label}</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {item.options.map((opt, idx) => (
                              <label key={idx} style={{
                                padding: '10px 8px', borderRadius: '6px', cursor: 'pointer', textAlign: 'center',
                                background: useCaseForm[item.key] === idx + 1 ? 'var(--brand-primary)' : 'white',
                                color: useCaseForm[item.key] === idx + 1 ? 'white' : 'var(--text-secondary)',
                                border: `1px solid ${useCaseForm[item.key] === idx + 1 ? 'var(--brand-primary)' : 'var(--border-light)'}`,
                                fontSize: '0.7rem', transition: 'all 0.15s', lineHeight: 1.3
                              }}>
                                <input type="radio" name={item.key} checked={useCaseForm[item.key] === idx + 1}
                                  onChange={() => setUseCaseForm({...useCaseForm, [item.key]: idx + 1})} style={{ display: 'none' }} />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 4: Benefit Scorecard */}
                  {useCaseStep === 4 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Benefit Scorecard</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Select the option that best describes the expected benefit</p>
                        </div>
                        <div style={{ padding: '8px 16px', background: '#dcfce7', borderRadius: '8px', fontWeight: 700, color: '#166534' }}>
                          Score: {(useCaseForm.benefit_availability || 1) + (useCaseForm.benefit_time_saving || 1) + (useCaseForm.benefit_cost_reduction || 1) + (useCaseForm.benefit_legacy_consolidation || 1) + (useCaseForm.benefit_automation || 1) + (useCaseForm.benefit_data_quality || 1) + (useCaseForm.benefit_compliance || 1)} / 28
                        </div>
                      </div>
                      {[
                        { key: 'benefit_availability', label: 'Availability & Resilience', options: ['No impact on system availability', 'Reduces planned downtime / maintenance windows', 'Eliminates single points of failure in one system', 'Improves availability company-wide / SLA-relevant'] },
                        { key: 'benefit_time_saving', label: 'Process Time Saving', options: ['No measurable time saving', '< 10% of process time saved', '10-30% of process time saved', '> 30% or entire process step eliminated'] },
                        { key: 'benefit_cost_reduction', label: 'Run Cost Reduction (p.a.)', options: ['< 50k € (licensing, infra, support)', '50-150k €', '150-500k €', '> 500k € or full cost category eliminated'] },
                        { key: 'benefit_legacy_consolidation', label: 'Legacy System Consolidation', options: ['No legacy system affected', 'Legacy system remains but workload reduced', '1 system fully decommissioned', '2+ systems decommissioned or full platform replaced'] },
                        { key: 'benefit_automation', label: 'Automation Depth', options: ['Digitisation of an analogue process only', 'Partial automation of individual steps', 'Full end-to-end automation of one process', 'AI / rule-based decision replaces manual judgement'] },
                        { key: 'benefit_data_quality', label: 'Data Quality & Decision Enablement', options: ['No improvement to data basis', 'Manual data consolidation reduced', 'Automated data availability in one system', 'Real-time data foundation enabling new decision logic'] },
                        { key: 'benefit_compliance', label: 'Compliance & Audit-Readiness', options: ['No compliance relevance', 'Reduces manual audit effort / documentation', 'Closes a known audit finding or regulatory gap', 'Fulfils a mandatory regulatory requirement (DSGVO, NIS2, SOX...)'] }
                      ].map(item => (
                        <div key={item.key} style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>{item.label}</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {item.options.map((opt, idx) => (
                              <label key={idx} style={{
                                padding: '10px 8px', borderRadius: '6px', cursor: 'pointer', textAlign: 'center',
                                background: useCaseForm[item.key] === idx + 1 ? '#10b981' : 'white',
                                color: useCaseForm[item.key] === idx + 1 ? 'white' : 'var(--text-secondary)',
                                border: `1px solid ${useCaseForm[item.key] === idx + 1 ? '#10b981' : 'var(--border-light)'}`,
                                fontSize: '0.7rem', transition: 'all 0.15s', lineHeight: 1.3
                              }}>
                                <input type="radio" name={item.key} checked={useCaseForm[item.key] === idx + 1}
                                  onChange={() => setUseCaseForm({...useCaseForm, [item.key]: idx + 1})} style={{ display: 'none' }} />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Results Preview */}
                      {(() => {
                        const scores = calculateUseCaseScores(useCaseForm);
                        return (
                          <div style={{ marginTop: '16px', padding: '16px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '2px solid #0ea5e9', borderRadius: '10px' }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>Calculated Results</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                              <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: scores.priorityIndex >= 70 ? '#166534' : scores.priorityIndex >= 50 ? '#92400e' : '#991b1b' }}>{scores.priorityIndex}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Priority Index</div>
                              </div>
                              <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{scores.priorityCluster}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cluster</div>
                              </div>
                              <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3730a3' }}>{scores.tshirtSize}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>T-Shirt</div>
                              </div>
                              <div style={{ textAlign: 'center', padding: '10px', background: 'white', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>{scores.recommendedAction}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Action</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="modal-actions" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    {useCaseStep > 1 && (
                      <button type="button" className="btn btn-outline" onClick={(e) => { e.preventDefault(); setUseCaseStep(useCaseStep - 1); }}>← Previous</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setShowUseCaseModal(false)} disabled={saving}>Cancel</button>
                    {useCaseStep < 4 ? (
                      <button type="button" className="btn btn-primary" onClick={(e) => {
                        e.preventDefault();
                        if (useCaseStep === 1) {
                          if (!useCaseForm.idea_name?.trim()) {
                            showAlert('Please fill in Idea Name', 'error');
                            return;
                          }
                          if (!useCaseForm.usecase_type) {
                            showAlert('Please select Use Case Type', 'error');
                            return;
                          }
                          if (!useCaseForm.submission_date) {
                            showAlert('Please fill in Submission Date', 'error');
                            return;
                          }
                        }
                        setUseCaseStep(useCaseStep + 1);
                      }}>Next →</button>
                    ) : (
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : (editingUseCase ? 'Update' : 'Submit') + ' Use Case'}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Use Case View Modal */}
        {viewingUseCase && (
          <div className="modal-overlay" onClick={() => setViewingUseCase(null)}>
            <div className="modal modal-large" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header" style={{ flexShrink: 0 }}>
                <h2>{viewingUseCase.idea_name}</h2>
                <button className="modal-close" onClick={() => setViewingUseCase(null)}>&times;</button>
              </div>
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                {/* Score Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ textAlign: 'center', padding: '14px 10px', background: viewingUseCase.priority_index >= 70 ? '#dcfce7' : viewingUseCase.priority_index >= 50 ? '#fef3c7' : '#fee2e2', borderRadius: '10px', border: '1px solid', borderColor: viewingUseCase.priority_index >= 70 ? '#86efac' : viewingUseCase.priority_index >= 50 ? '#fde68a' : '#fecaca' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: viewingUseCase.priority_index >= 70 ? '#166534' : viewingUseCase.priority_index >= 50 ? '#854d0e' : '#991b1b' }}>{viewingUseCase.priority_index}</div>
                    <div style={{ fontSize: '0.7rem', color: viewingUseCase.priority_index >= 70 ? '#166534' : viewingUseCase.priority_index >= 50 ? '#854d0e' : '#991b1b', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7 }}>Priority Index</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '14px 10px', background: viewingUseCase.priority_cluster === 'High Priority / Quick Win' ? '#dcfce7' : viewingUseCase.priority_cluster === 'Medium Priority' ? '#dbeafe' : viewingUseCase.priority_cluster === 'Low Priority' ? '#fef3c7' : '#fee2e2', borderRadius: '10px', border: '1px solid', borderColor: viewingUseCase.priority_cluster === 'High Priority / Quick Win' ? '#86efac' : viewingUseCase.priority_cluster === 'Medium Priority' ? '#93c5fd' : viewingUseCase.priority_cluster === 'Low Priority' ? '#fde68a' : '#fecaca' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: viewingUseCase.priority_cluster === 'High Priority / Quick Win' ? '#166534' : viewingUseCase.priority_cluster === 'Medium Priority' ? '#1e40af' : viewingUseCase.priority_cluster === 'Low Priority' ? '#854d0e' : '#991b1b' }}>{viewingUseCase.priority_cluster}</div>
                    <div style={{ fontSize: '0.7rem', color: viewingUseCase.priority_cluster === 'High Priority / Quick Win' ? '#166534' : viewingUseCase.priority_cluster === 'Medium Priority' ? '#1e40af' : viewingUseCase.priority_cluster === 'Low Priority' ? '#854d0e' : '#991b1b', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7 }}>Priority Cluster</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '14px 10px', background: 'var(--bg-muted)', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{viewingUseCase.tshirt_size}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>T-Shirt Size</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '14px 10px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: '10px', border: '1px solid #7dd3fc' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', lineHeight: 1.3 }}>{viewingUseCase.recommended_action}</div>
                    <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7 }}>Action</div>
                  </div>
                </div>

                {/* Basic Info */}
                <div style={{ marginBottom: '20px', background: 'var(--bg-muted)', borderRadius: '10px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Information</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Use Case Type:</span> <span style={{ padding: '2px 8px', borderRadius: '4px', background: viewingUseCase.usecase_type === 'AI Usecase' ? '#dbeafe' : '#f3e8ff', color: viewingUseCase.usecase_type === 'AI Usecase' ? '#1e40af' : '#7c3aed', fontSize: '0.85rem' }}>{viewingUseCase.usecase_type || '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Submission Date:</span> <span>{viewingUseCase.submission_date ? new Date(viewingUseCase.submission_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Idea Owner:</span> <span>{viewingUseCase.idea_owner || '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Division:</span> <span>{viewingUseCase.division || '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Sponsor:</span> <span>{viewingUseCase.sponsor || '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Product Owner:</span> <span>{viewingUseCase.product_owner || '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Line of Business:</span> <span>{viewingUseCase.line_of_business || '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Capacity:</span> <span>{viewingUseCase.capacity_confirmed || '-'}</span></div>
                    <div style={{ display: 'flex', gap: '8px', gridColumn: 'span 2' }}><span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>Status:</span> <span className={`status-badge ${viewingUseCase.status === 'Submitted' || viewingUseCase.status === 'Resubmitted' ? 'active' : viewingUseCase.status === 'Approved' || viewingUseCase.status === 'In Progress' ? 'completed' : viewingUseCase.status === 'Declined' ? 'cancelled' : 'on-hold'}`}>{viewingUseCase.status}</span></div>
                  </div>
                </div>

                {/* Description */}
                {(viewingUseCase.motivation || viewingUseCase.description_target || viewingUseCase.value_add) && (
                  <div style={{ marginBottom: '20px', background: 'var(--bg-muted)', borderRadius: '10px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description & Details</h4>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {viewingUseCase.motivation && <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Motivation</span><div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{viewingUseCase.motivation}</div></div>}
                      {viewingUseCase.description_target && <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Description & Target</span><div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{viewingUseCase.description_target}</div></div>}
                      {viewingUseCase.value_add && <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Value Add</span><div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{viewingUseCase.value_add}</div></div>}
                      {viewingUseCase.problem_evidence && <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Problem Evidence</span><div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{viewingUseCase.problem_evidence}</div></div>}
                      {viewingUseCase.dependencies_risks && <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dependencies & Risks</span><div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{viewingUseCase.dependencies_risks}</div></div>}
                    </div>
                  </div>
                )}

                {/* Scores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {/* Complexity Score */}
                  <div style={{ background: 'rgba(254, 243, 199, 0.1)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(253, 230, 138, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Complexity</h4>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#92400e' }}>{viewingUseCase.complexity_score}/28</span>
                    </div>
                    <div style={{ display: 'grid', gap: '8px', fontSize: '0.8rem' }}>
                      {[
                        { label: 'Integration', value: viewingUseCase.complexity_integration, options: ['1 system / standalone', '2-3 systems', '4-5 systems', '6+ or unclear'] },
                        { label: 'Data Security', value: viewingUseCase.complexity_data_security, options: ['Non-critical, 1 source', 'Multiple sources, non-critical', 'Unstructured / distributed', 'Sensitive / personal / IP-critical'] },
                        { label: 'Solution Type', value: viewingUseCase.complexity_solution_type, options: ['Configuration of standard solution', 'Standard solution + customization', 'In-house development / custom component', 'Architecture / platform intervention'] },
                        { label: 'Users / Reach', value: viewingUseCase.complexity_users, options: ['< 20 (pilot/team)', '20-200 (department)', '200-2,000 (division)', '2,000+ (company-wide)'] },
                        { label: 'Process Change', value: viewingUseCase.complexity_process_change, options: ['Only a tool, same process', 'Minor process adjustments', 'New workflow, roles shift', 'Cross-functional redesign'] },
                        { label: 'Stakeholder', value: viewingUseCase.complexity_stakeholder, options: ['Single team, no change mgmt', 'Multiple teams, informal', 'Formal change mgmt, training', 'Works council / legal approval'] },
                        { label: 'Effort & Cost', value: viewingUseCase.complexity_effort_cost, options: ['10-50 k€', '50-250 k€', '250-750 k€', '> 750 k€'] }
                      ].map((item, idx) => (
                        <div key={idx} style={{ padding: '6px 0', borderBottom: idx < 6 ? '1px solid var(--border-light)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                            <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.75rem' }}>{item.value}/4</span>
                          </div>
                          <div style={{ marginTop: '2px', color: 'var(--text-primary)', fontWeight: 500 }}>{item.options[(item.value || 1) - 1]}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefit Score */}
                  <div style={{ background: 'rgba(220, 252, 231, 0.1)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(187, 247, 208, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Benefit</h4>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#166534' }}>{viewingUseCase.benefit_score}/28</span>
                    </div>
                    <div style={{ display: 'grid', gap: '8px', fontSize: '0.8rem' }}>
                      {[
                        { label: 'Availability', value: viewingUseCase.benefit_availability, options: ['No impact on availability', 'Reduces planned downtime', 'Eliminates single points of failure', 'Improves availability company-wide'] },
                        { label: 'Time Saving', value: viewingUseCase.benefit_time_saving, options: ['No measurable time saving', '< 10% of process time saved', '10-30% of process time saved', '> 30% or step eliminated'] },
                        { label: 'Cost Reduction', value: viewingUseCase.benefit_cost_reduction, options: ['< 50k € p.a.', '50-150k € p.a.', '150-500k € p.a.', '> 500k € or cost eliminated'] },
                        { label: 'Legacy Consolidation', value: viewingUseCase.benefit_legacy_consolidation, options: ['No legacy system affected', 'Legacy workload reduced', '1 system decommissioned', '2+ systems decommissioned'] },
                        { label: 'Automation', value: viewingUseCase.benefit_automation, options: ['Digitisation only', 'Partial automation', 'Full end-to-end automation', 'AI replaces manual judgement'] },
                        { label: 'Data Quality', value: viewingUseCase.benefit_data_quality, options: ['No improvement', 'Manual consolidation reduced', 'Automated data availability', 'Real-time data foundation'] },
                        { label: 'Compliance', value: viewingUseCase.benefit_compliance, options: ['No compliance relevance', 'Reduces audit effort', 'Closes audit finding', 'Fulfils regulatory requirement'] }
                      ].map((item, idx) => (
                        <div key={idx} style={{ padding: '6px 0', borderBottom: idx < 6 ? '1px solid var(--border-light)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                            <span style={{ fontWeight: 700, color: '#166534', fontSize: '0.75rem' }}>{item.value}/4</span>
                          </div>
                          <div style={{ marginTop: '2px', color: 'var(--text-primary)', fontWeight: 500 }}>{item.options[(item.value || 1) - 1]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Admin Notes */}
                {viewingUseCase.admin_notes && (
                  <div style={{ marginTop: '16px', background: 'rgba(237, 233, 254, 0.1)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(221, 214, 254, 0.2)' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Admin Notes</h4>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {viewingUseCase.admin_notes}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: 'var(--bg-primary)' }}>
                <button className="btn btn-outline" onClick={() => setViewingUseCase(null)}>Close</button>
                {!['Approved', 'Declined', 'In Progress'].includes(viewingUseCase.status) && (
                  <button className="btn btn-primary" onClick={() => { handleEditUseCase(viewingUseCase); setViewingUseCase(null); }}>Edit</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Use Case Action Modal */}
        {actionModal.show && (
          <div className="modal-overlay" onClick={() => setActionModal({ show: false, useCase: null, action: '', comment: '' })}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>{getActionDetails(actionModal.action).title}</h2>
                <button className="modal-close" onClick={() => setActionModal({ show: false, useCase: null, action: '', comment: '' })}>&times;</button>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                  <strong>{actionModal.useCase?.idea_name}</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {actionModal.useCase?.idea_owner} • {actionModal.useCase?.division}
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    Comment {getActionDetails(actionModal.action).required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder={getActionDetails(actionModal.action).placeholder}
                    value={actionModal.comment}
                    onChange={e => setActionModal({ ...actionModal, comment: e.target.value })}
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-outline" onClick={() => setActionModal({ show: false, useCase: null, action: '', comment: '' })}>Cancel</button>
                <button
                  className={`btn ${actionModal.action === 'decline' ? 'btn-danger' : actionModal.action === 'rework' ? 'btn-warning' : 'btn-success'}`}
                  onClick={handleActionConfirm}
                >
                  {getActionDetails(actionModal.action).title}
                </button>
              </div>
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
                    <label>Use Case Type *</label>
                    <select
                      className="form-control"
                      value={projectForm.usecase_type}
                      onChange={e => setProjectForm({...projectForm, usecase_type: e.target.value})}
                      disabled={editingProject && editingProject.usecase_identifier}
                      required
                    >
                      <option value="" disabled>Select...</option>
                      {USECASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {editingProject && editingProject.usecase_identifier && (
                      <small style={{ color: 'var(--text-muted)' }}>ID: {editingProject.usecase_identifier}</small>
                    )}
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
                    <label>Requester Name(s)</label>
                    <div className="tag-input-container">
                      {getRequesters().map((name, idx) => (
                        <span key={idx} className="tag-item">
                          {name}
                          <button type="button" className="tag-remove" onClick={() => removeRequester(name)}>&times;</button>
                        </span>
                      ))}
                      <input
                        type="text"
                        className="tag-input"
                        value={requesterInput}
                        onChange={e => setRequesterInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            addRequester(requesterInput);
                          } else if (e.key === 'Backspace' && !requesterInput && getRequesters().length > 0) {
                            removeRequester(getRequesters()[getRequesters().length - 1]);
                          }
                        }}
                        onBlur={() => addRequester(requesterInput)}
                        placeholder={getRequesters().length === 0 ? "Type name and press Enter" : "Add another..."}
                      />
                    </div>
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
                    <label>
                      DOI Stage
                      {editingProject && (() => {
                        const currentStageHistory = projectDoiHistory.find(h => h.to_stage === projectForm.doi_stage);
                        if (currentStageHistory?.changed_at) {
                          const date = new Date(currentStageHistory.changed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                          return <span className="doi-stage-date">Set on {date}</span>;
                        }
                        return null;
                      })()}
                    </label>
                    {editingProject ? (
                      <select className="form-control" value={projectForm.doi_stage} onChange={e => setProjectForm({...projectForm, doi_stage: parseInt(e.target.value), doi_changed_at: ''})}>
                        {doiStages.map(d => <option key={d.id} value={d.id}>DOI {d.id} - {d.label}</option>)}
                      </select>
                    ) : (
                      <>
                        <input type="text" className="form-control" value={`DOI 0 - ${doiStages.find(d => d.id === 0)?.label || 'Ideation'}`} disabled style={{ backgroundColor: 'var(--bg-muted)', cursor: 'not-allowed' }} />
                        <small style={{ color: 'var(--text-muted)' }}>New projects always start at DOI 0</small>
                      </>
                    )}
                  </div>
                  <div className="form-group">
                    <label>{editingProject ? 'DOI Stage Date' : 'Project Start Date'} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={projectForm.doi_changed_at}
                      onChange={e => {
                        const newDate = e.target.value;
                        const updates = { doi_changed_at: newDate };
                        // Auto-fill start_date when DOI stage is 0 (for new projects)
                        if (projectForm.doi_stage === 0 && !editingProject) {
                          updates.start_date = newDate;
                        }
                        setProjectForm({...projectForm, ...updates});
                      }}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <small style={{ color: 'var(--text-muted)' }}>{editingProject ? 'Update the date for the current DOI stage' : 'Set the project creation date'}</small>
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

      {/* Alert Dialog */}
      {alertDialog.show && (
        <div className="confirm-overlay" onClick={() => setAlertDialog({ ...alertDialog, show: false })}>
          <div className="alert-dialog" onClick={e => e.stopPropagation()}>
            <div className={`alert-header ${alertDialog.type}`}>
              <div className={`alert-icon-wrapper ${alertDialog.type}`}>
                {alertDialog.type === 'error' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                ) : alertDialog.type === 'warning' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ) : alertDialog.type === 'success' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                )}
              </div>
              <div className="alert-header-text">
                <h3 className="alert-title">{alertDialog.title}</h3>
                <p className="alert-subtitle">
                  {alertDialog.type === 'error' ? 'Action could not be completed' :
                   alertDialog.type === 'warning' ? 'Please review before continuing' :
                   alertDialog.type === 'success' ? 'Operation successful' : 'Information'}
                </p>
              </div>
            </div>
            <div className="alert-body">
              <p className="alert-message">{alertDialog.message}</p>
            </div>
            <div className="alert-footer">
              <button className="alert-btn alert-btn-primary" onClick={() => setAlertDialog({ ...alertDialog, show: false })}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Preview Modal */}
      {showProjectPreview && (
        <div className="modal-overlay" onClick={() => setShowProjectPreview(false)}>
          <div className="modal modal-preview" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Project Details</h2>
              <button className="modal-close" onClick={() => setShowProjectPreview(false)}>&times;</button>
            </div>
            <div className="preview-content">
              <div className="preview-section">
                <h4>Basic Information</h4>
                <div className="preview-grid">
                  <div className="preview-item">
                    <span className="preview-label">Project Name</span>
                    <span className="preview-value">{projectForm.name || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Use Case Type</span>
                    <span className="preview-value">{projectForm.usecase_type || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Project ID</span>
                    <span className="preview-value">{projectForm.project_id || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">DOI Stage</span>
                    <span className="preview-value">DOI 0 - {doiStages.find(d => d.id === 0)?.label || 'Ideation'}</span>
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <h4>Organization</h4>
                <div className="preview-grid">
                  <div className="preview-item">
                    <span className="preview-label">Business Division</span>
                    <span className="preview-value">{projectForm.business_division || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Business Function</span>
                    <span className="preview-value">{projectForm.business_function || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Requester(s)</span>
                    <span className="preview-value">
                      {getRequesters().length > 0 ? (
                        <span className="preview-tags">
                          {getRequesters().map((r, i) => <span key={i} className="preview-tag">{r}</span>)}
                        </span>
                      ) : '-'}
                    </span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">AI SPOC</span>
                    <span className="preview-value">{projectForm.ai_spoc || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <h4>Project Details</h4>
                <div className="preview-grid">
                  <div className="preview-item">
                    <span className="preview-label">Priority</span>
                    <span className="preview-value">{projectForm.priority || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Status</span>
                    <span className="preview-value">{projectForm.current_status || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Platform</span>
                    <span className="preview-value">{projectForm.platform || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Demand Type</span>
                    <span className="preview-value">{projectForm.demand_type || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Estimated Costs</span>
                    <span className="preview-value">{projectForm.estimated_costs || '-'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Timeline</span>
                    <span className="preview-value">{projectForm.start_date || projectForm.doi_changed_at || new Date().toISOString().split('T')[0]} → {projectForm.end_date || 'Ongoing'}</span>
                  </div>
                </div>
              </div>

              {projectForm.description && (
                <div className="preview-section">
                  <h4>Description</h4>
                  <p className="preview-text">{projectForm.description}</p>
                </div>
              )}

              {projectForm.ai_skills && (
                <div className="preview-section">
                  <h4>AI Skills</h4>
                  <p className="preview-text">{projectForm.ai_skills}</p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowProjectPreview(false)}>Go Back & Edit</button>
              <button className="btn btn-primary" onClick={confirmCreateProject} disabled={saving}>
                {saving ? 'Creating...' : 'Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Tooltip id="admin-tooltip" />
    </div>
  );
}

export default Admin;
