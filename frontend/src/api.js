import axios from 'axios';

const API_BASE = '/api';

export const api = {
  getApps: () => axios.get(`${API_BASE}/apps`),
  getAnnouncements: () => axios.get(`${API_BASE}/announcements`),
  getWidgets: () => axios.get(`${API_BASE}/widgets`),
  getDoiStages: () => axios.get(`${API_BASE}/doi-stages`),
  submitFeedback: (data) => axios.post(`${API_BASE}/feedback`, data),

  admin: {
    getApps: () => axios.get(`${API_BASE}/admin/apps`),
    createApp: (data) => axios.post(`${API_BASE}/admin/apps`, data),
    updateApp: (id, data) => axios.put(`${API_BASE}/admin/apps/${id}`, data),
    deleteApp: (id) => axios.delete(`${API_BASE}/admin/apps/${id}`),

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

    getDoiStages: () => axios.get(`${API_BASE}/admin/doi-stages`),
    updateDoiStage: (id, data) => axios.put(`${API_BASE}/admin/doi-stages/${id}`, data),
  },
};
