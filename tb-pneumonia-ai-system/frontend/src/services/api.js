import axios from 'axios'

const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').trim().replace(/\/+$/, '')
const serverBaseUrl = configuredApiUrl.replace(/\/api$/, '')
const TOKEN_STORAGE_KEY = 'token'
const USER_STORAGE_KEY = 'user'
const sensitiveUserKeys = new Set(['access_token', 'token_type', 'token', 'authorization', 'password'])

export const API_BASE_URL = `${serverBaseUrl}/api`
export const MEDIA_BASE_URL = serverBaseUrl
export const AUTH_SESSION_EXPIRED_EVENT = 'pulmo-ai:session-expired'

const sanitizeUser = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeUser)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveUserKeys.has(key.toLowerCase()))
      .map(([key, child]) => [key, sanitizeUser(child)])
  )
}

export const getStoredToken = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export const getStoredUser = () => {
  if (typeof window === 'undefined') return null
  const storedUser = window.localStorage.getItem(USER_STORAGE_KEY)
  if (!storedUser || storedUser === 'undefined') return null
  try {
    const parsedUser = JSON.parse(storedUser)
    if (!parsedUser || typeof parsedUser !== 'object' || Array.isArray(parsedUser)) return null
    return sanitizeUser(parsedUser)
  } catch {
    return null
  }
}

export const saveAuthUser = (userData) => {
  const sanitizedUser = sanitizeUser(userData || {})
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(sanitizedUser))
  }
  return sanitizedUser
}

export const saveAuthSession = (accessToken, userData) => {
  if (typeof window !== 'undefined') {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Authentication response did not include an access token.')
    }
    window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
  }
  return saveAuthUser(userData)
}

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(USER_STORAGE_KEY)
}

const notifySessionExpired = () => {
  clearAuthSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT))
  }
}

const isPublicAuthRequest = (url = '') =>
  ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/forgot-password'].some((path) => url.includes(path))

export const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use(
  (config) => {
    if (!isPublicAuthRequest(config.url || '')) {
      const token = getStoredToken()
      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicAuthRequest(error.config?.url || '')) {
      notifySessionExpired()
    }
    return Promise.reject(error)
  }
)

export const getErrorMessage = (error, fallback = 'An unexpected error occurred.') => {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    const message = detail.map((item) => item?.msg || item?.message).filter(Boolean).join(' ')
    if (message) return message
  }
  return fallback
}

export const getAssetUrl = (path, version) => {
  if (!path) return ''
  const value = String(path)
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return value
  const normalizedPath = value.replace(/\\/g, '/').replace(/^\/+/, '')
  const assetUrl = `${MEDIA_BASE_URL}/${normalizedPath}`
  if (version === undefined || version === null || version === '') return assetUrl
  return `${assetUrl}${assetUrl.includes('?') ? '&' : '?'}t=${encodeURIComponent(version)}`
}

export const getProtectedImageUrl = (path, version) => {
  if (!path) return ''
  let normalized = String(path).replace(/\\/g, '/').replace(/^\/+/, '')
  if (normalized.startsWith('uploads/radiology/')) {
    const filename = normalized.split('/').pop()
    normalized = `api/media/radiology/${filename}`
  } else if (!normalized.startsWith('api/media/radiology/') && !/^[a-z][a-z\d+.-]*:/i.test(normalized) && !normalized.includes('profiles/')) {
    const filename = normalized.split('/').pop()
    if (filename && filename.match(/\.(jpg|jpeg|png)$/i)) {
      normalized = `api/media/radiology/${filename}`
    }
  }
  const url = getAssetUrl(normalized, version)
  if (!url) return ''
  const token = getStoredToken()
  if (!token) return ''
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

export const getModelStatus = async () => {
  const response = await api.get('/model-status')
  return response.data
}

export const predictImage = async (file, patientIdentifier) => {
  const formData = new FormData()
  formData.append('file', file)
  if (patientIdentifier) formData.append('patient_identifier', patientIdentifier)
  const response = await api.post('/predict', formData)
  return response.data
}

export const getHistory = async () => {
  const response = await api.get('/patient/history')
  return response.data
}

export const getDoctorDashboard = () => api.get('/doctor/dashboard')

export const getAdminStats = () => api.get('/admin/stats')
export const getAdminUsers = () => api.get('/admin/users')
export const updateAdminUserRole = (userId, role) => api.post(`/admin/users/${userId}/role`, { role })
export const updateAdminUserDetails = (userId, details) => api.put(`/admin/users/${userId}/details`, details)
export const createAdminUser = (adminData) => api.post('/admin/create-admin', adminData)
export const deleteAdminUser = (userId) => api.delete(`/admin/users/${userId}`)

export const getAdminSettings = () => api.get('/admin/settings/contact')
export const updateAdminSettings = (settings) => api.put('/admin/settings/contact', settings)
export const getAdminMessages = () => api.get('/admin/messages')
export const markMessageRead = (msgId) => api.put(`/admin/messages/${msgId}/read`)
export const deleteAdminMessage = (msgId) => api.delete(`/admin/messages/${msgId}`)

export const getAdminPredictions = (params) => api.get('/admin/predictions', { params })
export const deleteAdminPrediction = (predictionId) => api.delete(`/admin/predictions/${predictionId}`)
export const getAdminAppointments = (params) => api.get('/admin/appointments', { params })
export const deleteAdminAppointment = (appointmentId) => api.delete(`/admin/appointments/${appointmentId}`)

export const submitContactMessage = (data) => api.post('/contact/submit', data)
export const getDoctorMessages = () => api.get('/doctor/messages')
export const markDoctorMessageRead = (msgId) => api.put(`/doctor/messages/${msgId}/read`)
export const deleteDoctorMessage = (msgId) => api.delete(`/doctor/messages/${msgId}`)
// Only allowed for inquiries sent from a patient account; guests are WhatsApp-only.
export const replyToDoctorMessage = (msgId, body) => api.post(`/doctor/messages/${msgId}/reply`, { body })
export const getPatientInquiries = () => api.get('/patient/inquiries')
// The backend only accepts this inside the 1 minute window after sending.
export const updatePatientInquiry = (msgId, data) => api.put(`/patient/inquiries/${msgId}`, data)
export const deletePatientInquiry = (msgId) => api.delete(`/patient/inquiries/${msgId}`)

// --- DICOM gateway (studies pushed by the hospital X-ray machine) ---
// Studies arrive unattributed and sit in this inbox until a doctor attaches
// them to a patient. Access is restricted to doctors and admins.
export const getDicomGatewayStatus = () => api.get('/dicom/gateway-status')
export const getDicomPendingStudies = (params) => api.get('/dicom/pending-studies', { params })
export const attachDicomStudy = (studyId, patientIdentifier) =>
  api.post(`/dicom/pending-studies/${studyId}/attach`, { patient_identifier: patientIdentifier })
export const discardDicomStudy = (studyId) => api.delete(`/dicom/pending-studies/${studyId}`)

export default api
