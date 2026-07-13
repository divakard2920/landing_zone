import axios from 'axios';

const API_BASE = '/api';

// Add auth token to requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname.startsWith('/admin')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  auth: {
    login: (email, password) => axios.post(`${API_BASE}/auth/login`, { email, password }),
    logout: () => axios.post(`${API_BASE}/auth/logout`),
    me: () => axios.get(`${API_BASE}/auth/me`),
  },

  getApps: () => axios.get(`${API_BASE}/apps`),
  getAnnouncements: () => axios.get(`${API_BASE}/announcements`),
  getWidgets: () => axios.get(`${API_BASE}/widgets`),
  getDoiStages: () => axios.get(`${API_BASE}/doi-stages`),
  getDoiHistory: (appId) => axios.get(`${API_BASE}/apps/${appId}/doi-history`),
  getAllDoiHistory: () => axios.get(`${API_BASE}/all-doi-history`),
  submitFeedback: (data) => axios.post(`${API_BASE}/feedback`, data),
  submitAppRequest: (data) => axios.post(`${API_BASE}/app-requests`, data),

  admin: {
    getApps: () => axios.get(`${API_BASE}/admin/apps`),
    getDeletedApps: () => axios.get(`${API_BASE}/admin/apps/deleted`),
    createApp: (data) => axios.post(`${API_BASE}/admin/apps`, data),
    updateApp: (id, data) => axios.put(`${API_BASE}/admin/apps/${id}`, data),
    deleteApp: (id) => axios.delete(`${API_BASE}/admin/apps/${id}`),
    restoreApp: (id) => axios.post(`${API_BASE}/admin/apps/${id}/restore`),
    permanentDeleteApp: (id) => axios.delete(`${API_BASE}/admin/apps/${id}/permanent`),

    getAnnouncements: () => axios.get(`${API_BASE}/admin/announcements`),
    createAnnouncement: (data) => axios.post(`${API_BASE}/admin/announcements`, data),
    updateAnnouncement: (id, data) => axios.put(`${API_BASE}/admin/announcements/${id}`, data),
    deleteAnnouncement: (id) => axios.delete(`${API_BASE}/admin/announcements/${id}`),

    getFeedback: () => axios.get(`${API_BASE}/admin/feedback`),
    updateFeedbackStatus: (id, status) => axios.put(`${API_BASE}/admin/feedback/${id}/status`, { status }),
    deleteFeedback: (id) => axios.delete(`${API_BASE}/admin/feedback/${id}`),

    getTeam: (appId) => axios.get(`${API_BASE}/admin/apps/${appId}/team`),
    getAllTeamMembers: () => axios.get(`${API_BASE}/admin/team/all`),
    addTeamMember: (appId, data) => axios.post(`${API_BASE}/admin/apps/${appId}/team`, data),
    updateTeamMember: (id, data) => axios.put(`${API_BASE}/admin/team/${id}`, data),
    deleteTeamMember: (id) => axios.delete(`${API_BASE}/admin/team/${id}`),

    getWidgets: () => axios.get(`${API_BASE}/admin/widgets`),
    createWidget: (data) => axios.post(`${API_BASE}/admin/widgets`, data),
    updateWidget: (id, data) => axios.put(`${API_BASE}/admin/widgets/${id}`, data),
    deleteWidget: (id) => axios.delete(`${API_BASE}/admin/widgets/${id}`),

    uploadIcon: (file) => {
      const formData = new FormData();
      formData.append('icon', file);
      return axios.post(`${API_BASE}/admin/upload-icon`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },

    uploadFile: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return axios.post(`${API_BASE}/admin/upload-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },

    getDoiStages: () => axios.get(`${API_BASE}/admin/doi-stages`),
    updateDoiStage: (id, data) => axios.put(`${API_BASE}/admin/doi-stages/${id}`, data),

    getAppRequests: () => axios.get(`${API_BASE}/admin/app-requests`),
    approveAppRequest: (id, notes) => axios.put(`${API_BASE}/admin/app-requests/${id}/approve`, { admin_notes: notes }),
    rejectAppRequest: (id, notes) => axios.put(`${API_BASE}/admin/app-requests/${id}/reject`, { admin_notes: notes }),
    deleteAppRequest: (id) => axios.delete(`${API_BASE}/admin/app-requests/${id}`),

    // Admin users management
    getAdminUsers: () => axios.get(`${API_BASE}/admin/users`),
    createAdminUser: (data) => axios.post(`${API_BASE}/admin/users`, data),
    updateAdminUser: (id, data) => axios.put(`${API_BASE}/admin/users/${id}`, data),
    deleteAdminUser: (id) => axios.delete(`${API_BASE}/admin/users/${id}`),

    // Activity logs
    getActivityLogs: (limit = 50) => axios.get(`${API_BASE}/admin/activity-logs?limit=${limit}`),
    logActivity: (data) => axios.post(`${API_BASE}/admin/activity-logs`, data),

    // Use Case Intake
    getUseCaseIntakes: () => axios.get(`${API_BASE}/admin/use-case-intake`),
    getUseCaseIntake: (id) => axios.get(`${API_BASE}/admin/use-case-intake/${id}`),
    createUseCaseIntake: (data) => axios.post(`${API_BASE}/admin/use-case-intake`, data),
    updateUseCaseIntake: (id, data) => axios.put(`${API_BASE}/admin/use-case-intake/${id}`, data),
    deleteUseCaseIntake: (id) => axios.delete(`${API_BASE}/admin/use-case-intake/${id}`),
  },
};
