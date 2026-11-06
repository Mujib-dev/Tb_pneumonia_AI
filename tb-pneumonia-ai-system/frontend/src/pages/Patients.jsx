import { useState, useEffect, useMemo } from 'react'
import { 
  Users, Search, UserPlus, Phone, CreditCard, 
  MapPin, Calendar, Clock, Activity, ChevronRight, 
  Filter, X, Link as LinkIcon, Edit, Trash2, Shield, 
  LayoutGrid, List, CheckCircle2, AlertCircle, ArrowRight,
  Eye, Stethoscope, Sparkles, RefreshCw, ChevronDown, Check, FileText,
  Flame, Layers, TrendingUp, AlertTriangle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import api, { getDoctorDashboard, getAssetUrl, getProtectedImageUrl } from '../services/api'
import { clinicalSwal } from '../utils/alert'
import { getErrorMessage } from '../services/api'
import FieldFormatHint from '../components/FieldFormatHint'

// Normalises any API timestamp to a "YYYY-MM-DD" key using its UTC calendar day,
// so filters, counters and the date picker always agree with the stored value.
const toDateKey = (iso) => {
  if (!iso) return ''
  const parsed = typeof iso === 'string' ? new Date(iso) : iso
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const Patients = () => {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'screened' | 'pending' | 'today'
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  // Modals
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [editPatient, setEditPatient] = useState(null)
  const [showLinkForm, setShowLinkForm] = useState(false)

  // Which scan id is currently showing its Grad-CAM overlay (null = original radiograph)
  const [heatmapScanId, setHeatmapScanId] = useState(null)

  // Edit form state
  const [editForm, setEditForm] = useState({ name: '', phone: '', gender: '', age: '', address: '', profile_pic: null })
  const [editLoading, setEditLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)

  // New patient state
  const [newPatient, setNewPatient] = useState({
    name: '', cnic: '', phone: '', address: '', gender: '', age: '', password: '', profile_pic: null
  })
  const [formErrors, setFormErrors] = useState({})
  const [formTouched, setFormTouched] = useState({})

  // Linking State
  const [linkQuery, setLinkQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [linkSearching, setLinkSearching] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  // Distinguishes "searched, genuinely no match" from "search failed / not permitted"
  const [linkSearched, setLinkSearched] = useState(false)
  const [linkError, setLinkError] = useState(null)

  // Date Filtering State
  // The API returns naive UTC timestamps (e.g. "2026-09-26T17:11:02.682162").
  // Every date comparison must therefore read the UTC fields directly. Parsing the
  // string as local time (the old `+ 'Z'` trick) shifted evening registrations onto
  // the following day, so the calendar filter silently returned the wrong rows.
  const todayDateString = useMemo(() => toDateKey(new Date().toISOString()), [])
  const [selectedDate, setSelectedDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getDoctorDashboard()
      setData(res.data)
    } catch (err) {
      console.error("Failed to load doctor dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }

  // Set of patient IDs that have at least one radiograph record
  const screenedPatientIds = useMemo(() => {
    const set = new Set()
    if (data?.records && Array.isArray(data.records)) {
      data.records.forEach(r => {
        if (r.user_id) set.add(r.user_id)
      })
    }
    return set
  }, [data?.records])

  // Scans belonging to the patient whose profile modal is open, newest first
  const patientScans = useMemo(() => {
    if (!selectedPatient?.id) return []
    return (data?.records || [])
      .filter(r => r.user_id === selectedPatient.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [data?.records, selectedPatient])

  // Clinical summary derived from that patient's own scan history
  const patientSummary = useMemo(() => {
    const scans = patientScans
    const abnormal = scans.filter(s => s.result && s.result !== 'Normal')
    const dates = scans
      .map(s => new Date(s.created_at))
      .filter(d => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b)
    return {
      total: scans.length,
      abnormalCount: abnormal.length,
      normalCount: scans.length - abnormal.length,
      latest: scans[0] || null,
      firstDate: dates.length ? dates[0] : null,
      lastDate: dates.length ? dates[dates.length - 1] : null,
      hasHeatmap: scans.some(s => Boolean(s.heatmap_url)),
    }
  }, [patientScans])

  // Count metrics
  const totalPatientsCount = data?.patients?.length || 0
  const screenedCount = useMemo(() => {
    if (!data?.patients) return 0
    return data.patients.filter(p => screenedPatientIds.has(p.id)).length
  }, [data?.patients, screenedPatientIds])
  const pendingCount = Math.max(0, totalPatientsCount - screenedCount)

  const todayRegistrationsCount = useMemo(() => {
    if (!data?.patients) return 0
    return data.patients.filter(p => toDateKey(p.created_at) === todayDateString).length
  }, [data?.patients, todayDateString])

  // Formatted patients list according to active filters
  const filteredPatients = useMemo(() => {
    return (data?.patients || []).filter((p) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const name = (p.name || '').toLowerCase()
        const cnic = (p.cnic || '').toLowerCase()
        const phone = (p.phone || '').toLowerCase()
        const address = (p.address || '').toLowerCase()
        if (!name.includes(q) && !cnic.includes(q) && !phone.includes(q) && !address.includes(q)) {
          return false
        }
      }

      // 2. Status Filter
      const isScreened = screenedPatientIds.has(p.id)
      if (statusFilter === 'screened' && !isScreened) return false
      if (statusFilter === 'pending' && isScreened) return false
      if (statusFilter === 'today') {
        if (toDateKey(p.created_at) !== todayDateString) return false
      }

      // 3. Selected Date Filter (if manually set)
      if (selectedDate) {
        if (toDateKey(p.created_at) !== selectedDate) return false
      }

      return true
    })
  }, [data?.patients, searchQuery, statusFilter, selectedDate, screenedPatientIds, todayDateString])

  // Field-level Validation Helpers for Registration
  const validatePatientField = (fieldName, value, currentValues = newPatient) => {
    switch (fieldName) {
      case 'name': {
        const val = (value || '').trim()
        if (!val) return 'Patient full name is required.'
        if (val.length < 3) return 'Full name must be at least 3 characters.'
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return "Name should only contain letters, spaces, and punctuation (. - ')."
        return ''
      }
      case 'cnic': {
        const clean = (value || '').replace(/\D/g, '')
        if (!clean) return 'CNIC / National ID is required.'
        if (clean.length !== 13) return `CNIC must be exactly 13 digits (${clean.length}/13 entered).`
        return ''
      }
      case 'phone': {
        const clean = (value || '').replace(/\D/g, '')
        if (!clean) return 'Phone number is required.'
        if (!clean.startsWith('03')) return "Phone number must start with '03' (e.g. 03XXXXXXXXX)."
        if (clean.length !== 11) return `Phone number must be exactly 11 digits (${clean.length}/11 entered).`
        return ''
      }
      case 'gender': {
        if (!value) return 'Please select patient gender.'
        return ''
      }
      case 'age': {
        if (value === '' || value === null || value === undefined) return 'Patient age is required.'
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 1 || num > 120) return 'Age must be between 1 and 120 years.'
        return ''
      }
      case 'password': {
        if (value && value.length < 6) return 'Password must be at least 6 characters long.'
        return ''
      }
      case 'profile_pic': {
        if (value) {
          if (value.size > 5 * 1024 * 1024) return 'Photo size must be less than 5MB.'
          if (!value.type.startsWith('image/')) return 'File must be an image (PNG, JPG, WEBP).'
        }
        return ''
      }
      default:
        return ''
    }
  }

  const validateAllPatientFields = (values = newPatient) => {
    const errors = {}
    const fieldsToValidate = ['name', 'cnic', 'phone', 'gender', 'age', 'password', 'profile_pic']
    fieldsToValidate.forEach(field => {
      const err = validatePatientField(field, values[field], values)
      if (err) errors[field] = err
    })
    return errors
  }

  const resetRegisterForm = () => {
    setNewPatient({ name: '', cnic: '', phone: '', address: '', gender: '', age: '', password: '', profile_pic: null })
    setFormErrors({})
    setFormTouched({})
    setShowRegisterForm(false)
  }

  // Handlers for Registration
  const handleRegister = async (e) => {
    e.preventDefault()
    
    const errors = validateAllPatientFields(newPatient)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      setFormTouched({
        name: true,
        cnic: true,
        phone: true,
        gender: true,
        age: true,
        password: true,
        profile_pic: true
      })
      clinicalSwal.fire({
        icon: 'warning',
        title: 'Validation Errors',
        text: 'Please review and fix the highlighted fields in the form before saving.',
        confirmButtonText: 'Review Form'
      })
      return
    }

    const cleanName = (newPatient.name || '').trim()
    const cleanCnic = newPatient.cnic.replace(/\D/g, '').trim()
    const cleanPhone = newPatient.phone.replace(/\D/g, '').trim()

    setRegisterLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', cleanName)
      formData.append('cnic', cleanCnic)
      formData.append('phone', cleanPhone)
      formData.append('address', newPatient.address || '')
      if (newPatient.gender) formData.append('gender', newPatient.gender)
      if (newPatient.age) formData.append('age', newPatient.age)
      if (newPatient.password) formData.append('password', newPatient.password)
      if (newPatient.profile_pic) formData.append('profile_pic', newPatient.profile_pic)

      const res = await api.post('/doctor/register-patient', formData)
      
      resetRegisterForm()
      await fetchData()
      
      clinicalSwal.fire({
        icon: 'success',
        title: 'Registered Successfully!',
        text: 'Patient profile has been added to your clinical registry. Would you like to book an appointment token now?',
        showCancelButton: true,
        confirmButtonText: 'Book Token Now',
        cancelButtonText: 'Return to Registry'
      }).then((result) => {
        if (result.isConfirmed && res.data?.patient) {
          navigate('/book', { state: { patientForBooking: res.data.patient } })
        }
      })
    } catch (err) {
      console.error("Registration Error:", err)
      let errorMsg = "Registration failed"
      
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n')
        } else {
          errorMsg = err.response.data.detail
        }
      }
      
      clinicalSwal.fire({
        icon: 'error',
        title: 'Registration Notice',
        text: errorMsg,
        confirmButtonText: 'OK'
      })
      
      // Auto-switch to linking mode if this identity already exists in the directory.
      // The backend words this as "already registered"; older wording was "already exists".
      const alreadyOnFile = /already\s+(exists|registered|exist)/i.test(errorMsg)
      if (alreadyOnFile) {
        const existingCnic = cleanCnic || newPatient.cnic
        setShowRegisterForm(false)
        setLinkQuery(existingCnic)
        setShowLinkForm(true)
        setSearchResult(null)
        setLinkError(null)
        setLinkSearched(false)
        setTimeout(() => {
          handleSearchToLink(existingCnic)
        }, 150)
      }
    } finally {
      setRegisterLoading(false)
    }
  }

  // Handlers for Linking
  const handleSearchToLink = async (overrideQuery = null) => {
    const query = (overrideQuery || linkQuery).trim()
    if (!query) return
    setLinkSearching(true)
    setLinkError(null)
    try {
      const res = await api.get(`/doctor/search-patient?identifier=${encodeURIComponent(query)}`)
      if (res.data && res.data.exists) {
        setSearchResult(res.data)
      } else {
        setSearchResult(null)
      }
      setLinkSearched(true)
    } catch (err) {
      // A failed request must never be reported as "no such patient" - that sends the
      // doctor down the wrong path and risks creating a duplicate identity.
      setSearchResult(null)
      setLinkSearched(false)
      const status = err.response?.status
      let reason
      if (status === 403) {
        reason = 'Your account does not have permission to search the patient directory. Only doctor accounts can link existing patients.'
      } else if (status === 401) {
        reason = 'Your session has expired. Please sign in again and retry the search.'
      } else {
        reason = err.response?.data?.detail
          || getErrorMessage(err, 'The patient directory could not be reached. Check that the backend server is running, then retry.')
      }
      setLinkError(reason)
      clinicalSwal.fire({
        icon: 'error',
        title: 'Search Failed',
        text: reason,
        confirmButtonText: 'OK'
      })
    } finally {
      setLinkSearching(false)
    }
  }

  const handleLink = async (patientId) => {
    setLinkLoading(true)
    try {
      await api.post('/doctor/link-patient', { patient_id: patientId })
      setShowLinkForm(false)
      setLinkQuery('')
      setSearchResult(null)
      setLinkSearched(false)
      setLinkError(null)
      await fetchData()
      clinicalSwal.fire({
        icon: 'success',
        title: 'Profile Linked!',
        text: 'Patient successfully linked to your clinical registry.',
        confirmButtonText: 'OK'
      })
    } catch (err) {
      clinicalSwal.fire({
        icon: 'error',
        title: 'Linking Failed',
        text: err.response?.data?.detail || "Could not link patient.",
        confirmButtonText: 'OK'
      })
    } finally {
      setLinkLoading(false)
    }
  }

  // Delete / Unlink
  const handleDeletePatient = async (patientId, patientName) => {
    clinicalSwal.fire({
      title: 'Remove Patient?',
      text: `Are you sure you want to remove ${patientName} from your active registry? This will not erase historical scans.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Remove',
      cancelButtonText: 'Keep in Registry'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/doctor/unlink-patient/${patientId}`)
          if (selectedPatient?.id === patientId) setSelectedPatient(null)
          await fetchData()
          clinicalSwal.fire({
            icon: 'success',
            title: 'Removed',
            text: 'Patient removed from your registry successfully.',
            confirmButtonText: 'OK'
          })
        } catch (err) {
          clinicalSwal.fire({
            icon: 'error',
            title: 'Removal Failed',
            text: 'Could not remove patient at this time.',
            confirmButtonText: 'OK'
          })
        }
      }
    })
  }

  // Edit Patient
  const openEditModal = (patient) => {
    setEditPatient(patient)
    setEditForm({
      name: patient.name || '',
      phone: patient.phone || '',
      gender: patient.gender || '',
      age: patient.age || '',
      address: patient.address || '',
      profile_pic: null
    })
  }

  const handleEditPatient = async (e) => {
    e.preventDefault()
    const cleanName = (editForm.name || '').trim()
    if (!cleanName || cleanName.length < 3) {
      clinicalSwal.fire({ icon: 'error', title: 'Invalid Name', text: 'Full Name must be at least 3 characters long.', confirmButtonText: 'OK' })
      return
    }

    const cleanPhone = (editForm.phone || '').trim()
    if (!/^03\d{9}$/.test(cleanPhone)) {
      clinicalSwal.fire({ icon: 'error', title: 'Invalid Phone', text: "Phone number must be an 11-digit number starting with '03'.", confirmButtonText: 'OK' })
      return
    }

    if (editForm.age) {
      const a = parseInt(editForm.age, 10)
      if (isNaN(a) || a <= 0 || a > 120) {
        clinicalSwal.fire({ icon: 'error', title: 'Invalid Age', text: 'Please enter a valid age between 1 and 120 years.', confirmButtonText: 'OK' })
        return
      }
    }

    setEditLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', cleanName)
      formData.append('phone', cleanPhone)
      if (editForm.gender) formData.append('gender', editForm.gender)
      if (editForm.age) formData.append('age', editForm.age)
      formData.append('address', editForm.address || '')
      if (editForm.profile_pic) formData.append('profile_pic', editForm.profile_pic)

      const res = await api.put(`/doctor/update-patient/${editPatient.id}`, formData)

      // If this patient is open in profile modal, update its local copy
      if (selectedPatient?.id === editPatient.id) {
        setSelectedPatient(prev => ({ ...prev, ...editForm, profile_pic: res.data?.patient?.profile_pic || prev.profile_pic }))
      }

      setEditPatient(null)
      await fetchData()
      clinicalSwal.fire({ icon: 'success', title: 'Updated!', text: 'Patient details updated successfully.', confirmButtonText: 'OK' })
    } catch (err) {
      clinicalSwal.fire({ icon: 'error', title: 'Update Failed', text: err.response?.data?.detail || 'Could not update patient.', confirmButtonText: 'OK' })
    } finally {
      setEditLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="size-12 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 animate-spin">
          <RefreshCw size={24} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Loading Clinical Registry...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      
      {/* ─────────────────────────────────────────────────────────────
          Top Header: Title & Primary Actions
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5 sm:mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1.5">
            <Stethoscope size={13} />
            <span>Clinical Directory</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Patient Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage EHR profiles, radiograph archives, and schedule clinic appointments.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => {
              setLinkError(null)
              setLinkSearched(false)
              setSearchResult(null)
              setShowLinkForm(true)
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <LinkIcon size={14} />
            <span>Link Profile</span>
          </button>

          <button
            onClick={() => setShowRegisterForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer active:scale-98"
          >
            <UserPlus size={14} />
            <span>New Patient</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Clinical KPI Cards (4 metrics) — Compact Human Proportions
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {/* Total Patients */}
        <div 
          onClick={() => { setStatusFilter('all'); setSelectedDate(''); }}
          className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'all' && !selectedDate
              ? 'bg-blue-500/10 border-blue-500/40 dark:bg-blue-950/40 dark:border-blue-500/40 ring-1 ring-blue-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Patients</span>
            <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60">
              <Users size={15} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {totalPatientsCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">In clinic directory</p>
        </div>

        {/* Screened Patients */}
        <div 
          onClick={() => { setStatusFilter('screened'); }}
          className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'screened'
              ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/40 dark:border-emerald-500/40 ring-1 ring-emerald-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed Scans</span>
            <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/60">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {screenedCount}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Radiographs analyzed</p>
        </div>

        {/* Pending Screening */}
        <div 
          onClick={() => { setStatusFilter('pending'); }}
          className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-500/40 dark:bg-amber-950/40 dark:border-amber-500/40 ring-1 ring-amber-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Scan</span>
            <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/60">
              <AlertCircle size={15} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {pendingCount}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Awaiting radiograph</p>
        </div>

        {/* Date Filter Card */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {selectedDate ? (selectedDate === todayDateString ? "Today's Load" : "Filtered Date") : "All-Time"}
            </span>
            <div className="relative shrink-0">
              <label
                className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-900/60 cursor-pointer hover:scale-105 transition-transform"
                title="Pick Date"
              >
                <Calendar size={15} className="pointer-events-none" />
              </label>
              <input
                type="date"
                aria-label="Filter patients by registration date"
                value={selectedDate}
                max={todayDateString}
                onChange={(e) => setSelectedDate(e.target.value)}
                // Laid over the icon instead of `sr-only`: a clipped input still opens
                // the native picker on some browsers but not reliably, and a 1px target
                // made the calendar appear broken.
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {selectedDate ? filteredPatients.length : totalPatientsCount}
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {selectedDate ? 'Records' : 'Patients'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            {selectedDate ? (
              <button
                onClick={() => setSelectedDate('')}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Clear Filter ({selectedDate})
              </button>
            ) : (
              <button
                onClick={() => setSelectedDate(todayDateString)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Filter Today Only
              </button>
            )}
            {!selectedDate && (
              <span className="text-[11px] font-semibold text-slate-400 ml-auto whitespace-nowrap">
                {todayRegistrationsCount} today
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Control & Search Toolbar
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 mb-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-xs">
        
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input 
            type="text" 
            placeholder="Search patient name, CNIC, phone, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Pills & View Toggles */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
          
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({totalPatientsCount})
            </button>
            <button
              onClick={() => setStatusFilter('screened')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'screened' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Screened ({screenedCount})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'pending' 
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'table' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Table View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Patient Records List: Empty State or Grid / Table
      ───────────────────────────────────────────────────────────── */}
      {filteredPatients.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="size-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
            <Users size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Patient Records Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
            {searchQuery 
              ? `No patients match "${searchQuery}". Check the spelling or reset filters.`
              : 'There are no patient records currently matching your active filter criteria.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Clear Search
              </button>
            )}
            <button
              onClick={() => setShowRegisterForm(true)}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              Register New Patient
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        
        /* ── Modern Clinical Card Grid - Grid 2 on Small Screen ── */
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
          {filteredPatients.map((p) => {
            const isScreened = screenedPatientIds.has(p.id)
            const scanCount = (data?.records || []).filter(r => r.user_id === p.id).length

            return (
              <motion.div
                key={p.id}
                layoutId={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-2.5 sm:p-4 flex flex-col justify-between hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/30 transition-all group"
              >
                <div>
                  {/* Card Header: Avatar, Name, Status & Action Menu */}
                  <div className="flex items-start justify-between gap-1.5 sm:gap-2.5 mb-2 sm:mb-2.5">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div className="size-8 sm:size-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm overflow-hidden shrink-0 shadow-xs">
                        {p.profile_pic ? (
                          <img 
                            src={getAssetUrl(p.profile_pic)} 
                            alt={p.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=2563eb&color=fff`
                            }}
                          />
                        ) : (
                          <span>{p.name?.[0] || 'P'}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 
                          onClick={() => setSelectedPatient(p)}
                          className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer"
                          title={p.name}
                        >
                          {p.name}
                        </h3>
                        <div className="flex items-center gap-1 text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          <span>{p.age ? `${p.age}Y` : 'N/A'}</span>
                          <span>•</span>
                          <span className="capitalize">{p.gender || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Edit/Delete buttons */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Patient"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePatient(p.id, p.name); }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Remove from Registry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Status & Scan Count Pill */}
                  <div className="mb-2.5">
                    {isScreened ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 text-[10px] font-bold">
                        <span className="size-1.5 rounded-full bg-emerald-500"></span>
                        <span>Screened • {scanCount} {scanCount === 1 ? 'Scan' : 'Scans'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 text-[10px] font-bold">
                        <span className="size-1.5 rounded-full bg-amber-500"></span>
                        <span>Pending Screening</span>
                      </span>
                    )}
                  </div>

                  {/* Meta details list */}
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <CreditCard size={12} className="text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                        {p.cnic || 'CNIC not provided'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-slate-400 shrink-0" />
                      <a href={`tel:${p.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate text-[11px]">
                        {p.phone || 'Phone not provided'}
                      </a>
                    </div>
                    {p.address && (
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate text-slate-500 dark:text-slate-400 text-[11px]">
                          {p.address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => setSelectedPatient(p)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={12} />
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={() => navigate('/book', { state: { patientForBooking: p } })}
                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-200/60 dark:border-emerald-800 transition-all cursor-pointer"
                    title="Book Token"
                  >
                    <Calendar size={14} />
                  </button>

                  <button
                    onClick={() => navigate('/predict', { state: { patient: p } })}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs cursor-pointer"
                    title="Run Radiograph Screening"
                  >
                    <Activity size={14} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        
        /* ── Modern Clinical EHR Table ── */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Patient Profile</th>
                  <th className="py-3.5 px-4">National ID (CNIC)</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Diagnostic Status</th>
                  <th className="py-3.5 px-4">Registered</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {filteredPatients.map((p) => {
                  const isScreened = screenedPatientIds.has(p.id)
                  const scanCount = (data?.records || []).filter(r => r.user_id === p.id).length
                  const regDate = p.created_at 
                    ? new Date(p.created_at.includes('Z') ? p.created_at : `${p.created_at}Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'N/A'

                  return (
                    <tr 
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-xs">
                            {p.profile_pic ? (
                              <img 
                                src={getAssetUrl(p.profile_pic)} 
                                alt={p.name} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.target.onerror = null
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=2563eb&color=fff`
                                }}
                              />
                            ) : (
                              <span>{p.name?.[0] || 'P'}</span>
                            )}
                          </div>
                          <div>
                            <button
                              onClick={() => setSelectedPatient(p)}
                              className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-sm"
                            >
                              {p.name}
                            </button>
                            <p className="text-[11px] text-slate-400 capitalize">
                              {p.age ? `${p.age} Yrs` : 'N/A'} • {p.gender || 'Unknown'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {p.cnic || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <a href={`tel:${p.phone}`} className="text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-semibold block">
                          {p.phone || '—'}
                        </a>
                        <span className="text-[11px] text-slate-400 truncate max-w-[160px] block">
                          {p.address || 'No address'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isScreened ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                            <span className="size-1.5 rounded-full bg-emerald-500"></span>
                            <span>Screened ({scanCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
                            <span className="size-1.5 rounded-full bg-amber-500"></span>
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                        {regDate}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedPatient(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Profile
                          </button>
                          <button
                            onClick={() => navigate('/predict', { state: { patient: p } })}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                            title="Run Screening"
                          >
                            <Activity size={15} />
                          </button>
                          <button
                            onClick={() => navigate('/book', { state: { patientForBooking: p } })}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                            title="Book Token"
                          >
                            <Calendar size={15} />
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDeletePatient(p.id, p.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: Register New Patient
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRegisterForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => resetRegisterForm()} 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="h-0.5 bg-blue-600 shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">New Patient Registration</h2>
                    <p className="text-xs text-slate-400">Add an electronic health profile to your registry</p>
                  </div>
                </div>

                <button 
                  onClick={() => resetRegisterForm()}
                  className="size-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleRegister} className="p-6 overflow-y-auto space-y-4">
                
                {/* Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    {formTouched.name && !formErrors.name && newPatient.name.trim() && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Valid
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Ahmad Khan" 
                    value={newPatient.name} 
                    onChange={e => {
                      const val = e.target.value
                      setNewPatient(prev => ({ ...prev, name: val }))
                      if (formTouched.name) {
                        setFormErrors(prev => ({ ...prev, name: validatePatientField('name', val) }))
                      }
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, name: true }))
                      setFormErrors(prev => ({ ...prev, name: validatePatientField('name', newPatient.name) }))
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800/70 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 ${
                      formTouched.name && formErrors.name 
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20' 
                        : formTouched.name && !formErrors.name && newPatient.name.trim()
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
                    }`}
                  />
                  {formTouched.name && formErrors.name && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle size={11} className="shrink-0" />
                      <span>{formErrors.name}</span>
                    </p>
                  )}
                  <FieldFormatHint type="name" value={newPatient.name} />
                </div>

                {/* CNIC and Phone Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        CNIC / National ID <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-mono font-bold ${
                        newPatient.cnic.length === 13 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                      }`}>
                        {newPatient.cnic.length}/13 digits
                      </span>
                    </div>
                    <input 
                      type="text" 
                      required
                      placeholder="13 numeric digits" 
                      maxLength={13}
                      value={newPatient.cnic} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 13)
                        setNewPatient(prev => ({ ...prev, cnic: val }))
                        if (formTouched.cnic) {
                          setFormErrors(prev => ({ ...prev, cnic: validatePatientField('cnic', val) }))
                        }
                      }}
                      onBlur={() => {
                        setFormTouched(prev => ({ ...prev, cnic: true }))
                        setFormErrors(prev => ({ ...prev, cnic: validatePatientField('cnic', newPatient.cnic) }))
                      }}
                      className={`w-full bg-slate-50 dark:bg-slate-800/70 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 font-mono ${
                        formTouched.cnic && formErrors.cnic 
                          ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20' 
                          : formTouched.cnic && !formErrors.cnic && newPatient.cnic.length === 13
                            ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
                      }`}
                    />
                    {formTouched.cnic && formErrors.cnic && (
                      <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={11} className="shrink-0" />
                        <span>{formErrors.cnic}</span>
                      </p>
                    )}
                    <FieldFormatHint type="cnic" value={newPatient.cnic} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[10px] font-mono font-bold ${
                        newPatient.phone.length === 11 && newPatient.phone.startsWith('03') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                      }`}>
                        {newPatient.phone.length}/11 digits
                      </span>
                    </div>
                    <input 
                      type="text" 
                      required
                      placeholder="03XXXXXXXXX" 
                      maxLength={11}
                      value={newPatient.phone} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                        setNewPatient(prev => ({ ...prev, phone: val }))
                        if (formTouched.phone) {
                          setFormErrors(prev => ({ ...prev, phone: validatePatientField('phone', val) }))
                        }
                      }}
                      onBlur={() => {
                        setFormTouched(prev => ({ ...prev, phone: true }))
                        setFormErrors(prev => ({ ...prev, phone: validatePatientField('phone', newPatient.phone) }))
                      }}
                      className={`w-full bg-slate-50 dark:bg-slate-800/70 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 font-mono ${
                        formTouched.phone && formErrors.phone 
                          ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20' 
                          : formTouched.phone && !formErrors.phone && newPatient.phone.length === 11
                            ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
                      }`}
                    />
                    {formTouched.phone && formErrors.phone && (
                      <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={11} className="shrink-0" />
                        <span>{formErrors.phone}</span>
                      </p>
                    )}
                    <FieldFormatHint type="phone" value={newPatient.phone} />
                  </div>
                </div>

                {/* Gender and Age Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      {formTouched.gender && !formErrors.gender && newPatient.gender && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                          <CheckCircle2 size={11} /> Selected
                        </span>
                      )}
                    </div>
                    <select 
                      required
                      value={newPatient.gender} 
                      onChange={e => {
                        const val = e.target.value
                        setNewPatient(prev => ({ ...prev, gender: val }))
                        setFormTouched(prev => ({ ...prev, gender: true }))
                        setFormErrors(prev => ({ ...prev, gender: validatePatientField('gender', val) }))
                      }}
                      onBlur={() => {
                        setFormTouched(prev => ({ ...prev, gender: true }))
                        setFormErrors(prev => ({ ...prev, gender: validatePatientField('gender', newPatient.gender) }))
                      }}
                      className={`w-full bg-slate-50 dark:bg-slate-800/70 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all ${
                        formTouched.gender && formErrors.gender 
                          ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20' 
                          : formTouched.gender && !formErrors.gender && newPatient.gender
                            ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
                      }`}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {formTouched.gender && formErrors.gender && (
                      <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={11} className="shrink-0" />
                        <span>{formErrors.gender}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Age (Years) <span className="text-rose-500">*</span>
                      </label>
                      {formTouched.age && !formErrors.age && newPatient.age && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                          <CheckCircle2 size={11} /> Valid
                        </span>
                      )}
                    </div>
                    <input 
                      type="number" 
                      min="1" 
                      max="120" 
                      required
                      placeholder="Age in years (1-120)" 
                      value={newPatient.age} 
                      onChange={e => {
                        const val = e.target.value
                        setNewPatient(prev => ({ ...prev, age: val }))
                        if (formTouched.age) {
                          setFormErrors(prev => ({ ...prev, age: validatePatientField('age', val) }))
                        }
                      }}
                      onBlur={() => {
                        setFormTouched(prev => ({ ...prev, age: true }))
                        setFormErrors(prev => ({ ...prev, age: validatePatientField('age', newPatient.age) }))
                      }}
                      className={`w-full bg-slate-50 dark:bg-slate-800/70 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 ${
                        formTouched.age && formErrors.age 
                          ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20' 
                          : formTouched.age && !formErrors.age && newPatient.age
                            ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
                      }`}
                    />
                    {formTouched.age && formErrors.age && (
                      <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                        <AlertCircle size={11} className="shrink-0" />
                        <span>{formErrors.age}</span>
                      </p>
                    )}
                    <FieldFormatHint 
                      custom={{
                        label: 'Age',
                        hint: 'Valid integer between 1 and 120',
                        example: '32',
                        patternStr: '^[1-9][0-9]?$|^1[0-1][0-9]$|^120$'
                      }}
                      value={newPatient.age}
                    />
                  </div>
                </div>

                {/* Residential Address */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Residential Address
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="Street, City, Province..." 
                    value={newPatient.address} 
                    onChange={e => setNewPatient({...newPatient, address: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>

                {/* Portal Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Portal Password <span className="text-slate-400 font-normal">(Optional, defaults to CNIC)</span>
                    </label>
                    {newPatient.password && !formErrors.password && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Valid (min 6)
                      </span>
                    )}
                  </div>
                  <input 
                    type="password" 
                    placeholder="Leave empty to use CNIC or min 6 characters" 
                    value={newPatient.password} 
                    onChange={e => {
                      const val = e.target.value
                      setNewPatient(prev => ({ ...prev, password: val }))
                      if (formTouched.password) {
                        setFormErrors(prev => ({ ...prev, password: validatePatientField('password', val) }))
                      }
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, password: true }))
                      setFormErrors(prev => ({ ...prev, password: validatePatientField('password', newPatient.password) }))
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800/70 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 ${
                      formTouched.password && formErrors.password 
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20' 
                        : formTouched.password && !formErrors.password && newPatient.password
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
                    }`}
                  />
                  {formTouched.password && formErrors.password && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle size={11} className="shrink-0" />
                      <span>{formErrors.password}</span>
                    </p>
                  )}
                  <FieldFormatHint type="patientPassword" value={newPatient.password} />
                </div>

                {/* Profile Pic Upload */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Profile Photo <span className="text-slate-400 font-normal">(Optional, max 5MB)</span>
                    </label>
                    {newPatient.profile_pic && !formErrors.profile_pic && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Photo selected
                      </span>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={e => {
                      const file = e.target.files?.[0] || null
                      setNewPatient(prev => ({ ...prev, profile_pic: file }))
                      setFormTouched(prev => ({ ...prev, profile_pic: true }))
                      setFormErrors(prev => ({ ...prev, profile_pic: validatePatientField('profile_pic', file) }))
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 dark:file:bg-slate-800 dark:file:text-blue-400 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {formTouched.profile_pic && formErrors.profile_pic && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle size={11} className="shrink-0" />
                      <span>{formErrors.profile_pic}</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => resetRegisterForm()}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={registerLoading}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {registerLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Registering...</span>
                      </>
                    ) : (
                      <>
                        <Check size={15} />
                        <span>Save Patient Record</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: Edit Patient Details
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editPatient && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditPatient(null)} 
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="h-0.5 bg-blue-600 shrink-0" />

              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60">
                    <Edit size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Edit Patient Profile</h2>
                    <p className="text-xs text-slate-400">Update contact and clinical details</p>
                  </div>
                </div>

                <button 
                  onClick={() => setEditPatient(null)}
                  className="size-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEditPatient} className="p-6 overflow-y-auto space-y-3.5">
                
                {/* Photo Preview and upload */}
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="size-14 rounded-xl bg-blue-600/10 border border-blue-500/20 overflow-hidden flex items-center justify-center shrink-0">
                    {editForm.profile_pic ? (
                      <img src={URL.createObjectURL(editForm.profile_pic)} alt="Preview" className="w-full h-full object-cover" />
                    ) : editPatient.profile_pic ? (
                      <img 
                        src={getAssetUrl(editPatient.profile_pic)} 
                        alt={editPatient.name} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editPatient.name)}&background=2563eb&color=fff`
                        }}
                      />
                    ) : (
                      <span className="font-extrabold text-lg text-blue-500">{editForm.name?.[0] || 'P'}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer block">
                      {editForm.profile_pic ? editForm.profile_pic.name : 'Change Profile Photo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => setEditForm({...editForm, profile_pic: e.target.files[0]})} 
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG up to 5MB</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text" 
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                  <FieldFormatHint type="name" value={editForm.name} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Phone</label>
                    <input
                      type="text" 
                      required
                      value={editForm.phone}
                      onChange={e => setEditForm({...editForm, phone: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                    />
                    <FieldFormatHint type="phone" value={editForm.phone} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Age</label>
                    <input
                      type="number" 
                      min="1" 
                      max="120"
                      value={editForm.age}
                      onChange={e => setEditForm({...editForm, age: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                    />
                    <FieldFormatHint 
                      custom={{
                        label: 'Age',
                        hint: 'Valid integer 1-120',
                        example: '30',
                        patternStr: '^[1-9][0-9]?$|^1[0-1][0-9]$|^120$'
                      }} 
                      value={editForm.age} 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={e => setEditForm({...editForm, gender: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Address</label>
                  <textarea
                    rows={2}
                    value={editForm.address}
                    onChange={e => setEditForm({...editForm, address: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditPatient(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: Link Existing Patient
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLinkForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowLinkForm(false); setLinkSearched(false); setLinkError(null); setSearchResult(null) }} 
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="h-0.5 bg-purple-600 shrink-0" />

              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-900/60">
                    <LinkIcon size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Link Existing Profile</h2>
                    <p className="text-xs text-slate-400">Search hospital directory by CNIC or phone</p>
                  </div>
                </div>

                <button 
                  onClick={() => { setShowLinkForm(false); setLinkSearched(false); setLinkError(null); setSearchResult(null) }}
                  className="size-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter 13-digit CNIC or phone number..." 
                      value={linkQuery} 
                      onChange={e => setLinkQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSearchToLink() }}
                      className="flex-1 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all placeholder:text-slate-400"
                    />
                    <button 
                      onClick={() => handleSearchToLink()} 
                      disabled={linkSearching || !linkQuery.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-xl font-bold transition-all shadow-md shadow-purple-500/25 flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      {linkSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  </div>
                  <FieldFormatHint type="identifier" value={linkQuery} />
                </div>

                {searchResult && searchResult.patient ? (
                  <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {searchResult.patient.name?.[0] || 'P'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{searchResult.patient.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">CNIC: {searchResult.patient.cnic}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{searchResult.patient.phone}</p>
                      </div>
                    </div>

                    {searchResult.is_linked ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        Already Linked
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleLink(searchResult.patient.id)}
                        disabled={linkLoading}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-purple-500/25 transition-all cursor-pointer disabled:opacity-60"
                      >
                        {linkLoading ? 'Linking...' : 'Link to Me'}
                      </button>
                    )}
                  </div>
                ) : linkError ? (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-center">
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{linkError}</p>
                  </div>
                ) : linkSearched && linkQuery && !linkSearching ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">No patient found matching "{linkQuery}".</p>
                    <button 
                      onClick={() => {
                        setShowLinkForm(false)
                        setNewPatient({...newPatient, cnic: linkQuery})
                        setShowRegisterForm(true)
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Register as New Patient
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: Patient Profile & Record (Detailed View & Scans)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedPatient && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-2.5 sm:p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedPatient(null)} 
            />

            <motion.div 
              layoutId={selectedPatient.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="h-0.5 bg-blue-600 shrink-0" />

              {/* Close Button */}
              <button 
                onClick={() => setSelectedPatient(null)} 
                className="absolute top-3.5 right-3.5 z-30 size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              >
                <X size={15} />
              </button>

              {/* Scrollable Body */}
              <div className="overflow-y-auto flex-1 min-h-0">

                {/* Sticky Patient Header */}
                <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-5 pt-4 sm:pt-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4">
                    <div className="size-16 sm:size-18 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-2xl overflow-hidden shrink-0 shadow-xs">
                      {selectedPatient.profile_pic ? (
                        <img 
                          src={getAssetUrl(selectedPatient.profile_pic)} 
                          alt={selectedPatient.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPatient.name)}&background=2563eb&color=fff`
                          }}
                        />
                      ) : (
                        <span>{selectedPatient.name?.[0] || 'P'}</span>
                      )}
                    </div>

                    <div className="text-center sm:text-left flex-1 min-w-0">
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                        {selectedPatient.name}
                      </h2>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60 text-xs font-bold flex items-center gap-1.5">
                          <Shield size={12} />
                          <span>Registered Patient</span>
                        </span>

                        {selectedPatient.created_at && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5">
                            <Calendar size={12} />
                            <span>Joined {new Date(selectedPatient.created_at.includes('Z') ? selectedPatient.created_at : `${selectedPatient.created_at}Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </span>
                        )}

                        {screenedPatientIds.has(selectedPatient.id) ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 text-xs font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={12} />
                            <span>Radiographs on Record</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 text-xs font-bold flex items-center gap-1.5">
                            <AlertCircle size={12} />
                            <span>Pending First Scan</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">

                  {/* Clinical Screening Summary */}
                  {patientSummary.total > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Total Scans</span>
                        <span className="text-base font-extrabold text-slate-900 dark:text-white block leading-tight">{patientSummary.total}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Abnormal</span>
                        <span className={`text-base font-extrabold block leading-tight ${patientSummary.abnormalCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                          {patientSummary.abnormalCount}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Cleared Normal</span>
                        <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 block leading-tight">{patientSummary.normalCount}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Latest</span>
                        <span className={`text-xs font-extrabold block leading-tight truncate ${
                          !patientSummary.latest ? 'text-slate-400'
                          : patientSummary.latest.result === 'Normal' ? 'text-emerald-600 dark:text-emerald-400'
                          : patientSummary.latest.result === 'TB' ? 'text-rose-600 dark:text-rose-400'
                          : 'text-purple-600 dark:text-purple-400'
                        }`}>
                          {patientSummary.latest?.result || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Abnormal findings callout */}
                  {patientSummary.abnormalCount > 0 && (
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
                      <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-snug">
                          {patientSummary.abnormalCount} abnormal {patientSummary.abnormalCount === 1 ? 'finding' : 'findings'} on record
                        </p>
                        <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-0.5 leading-snug">
                          Model output is decision support only. Corroborate against the radiograph and clinical presentation before acting.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Patient Information Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">CNIC ID</span>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate block">
                        {selectedPatient.cnic || 'N/A'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Phone</span>
                      <a href={`tel:${selectedPatient.phone}`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline truncate block">
                        {selectedPatient.phone || 'N/A'}
                      </a>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Gender / Age</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {selectedPatient.gender || 'Unknown'} • {selectedPatient.age ? `${selectedPatient.age}y` : 'N/A'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Location</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate block" title={selectedPatient.address}>
                        {selectedPatient.address || 'Not specified'}
                      </span>
                    </div>
                  </div>

                  {/* Radiograph Diagnostic History */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-blue-600 dark:text-blue-400" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Radiograph Screening Archive
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400 font-semibold">
                        {patientSummary.total} {patientSummary.total === 1 ? 'Scan' : 'Scans'} Found
                      </span>
                    </div>

                    {patientSummary.total > 1 && patientSummary.firstDate && (
                      <div className="flex items-center gap-1.5 mb-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <TrendingUp size={12} className="shrink-0" />
                        <span>
                          Screening period {patientSummary.firstDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' \u2192 '}
                          {patientSummary.lastDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}

                    {patientSummary.total === 0 ? (
                      <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <Activity size={24} className="text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Screening History Yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Upload a chest radiograph to perform clinical screening.</p>
                        <button
                          onClick={() => {
                            setSelectedPatient(null)
                            navigate('/predict', { state: { patient: selectedPatient } })
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Run Diagnostic Scan Now
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                        {patientScans.map((scan) => {
                          const isNormal = scan.result === 'Normal'
                          const isTB = scan.result === 'TB'
                          const showHeatmap = heatmapScanId === scan.id && Boolean(scan.heatmap_url)
                          const confidencePct = Number.isFinite(scan.confidence) ? scan.confidence : 0
                          const scanDate = new Date(scan.created_at)

                          return (
                            <div 
                              key={scan.id} 
                              className={`p-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-colors ${
                                isNormal
                                  ? 'border-slate-200 dark:border-slate-800'
                                  : 'border-rose-200/80 dark:border-rose-900/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="relative size-14 rounded-xl bg-black overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                                  <img 
                                    src={getProtectedImageUrl(
                                      showHeatmap ? scan.heatmap_url : scan.image_path,
                                      Number.isNaN(scanDate.getTime()) ? undefined : scanDate.getTime()
                                    )} 
                                    alt={showHeatmap ? 'Grad-CAM saliency map' : 'CXR Scan'} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none'
                                    }}
                                  />
                                  {showHeatmap && (
                                    <span className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-rose-600 text-white text-[7px] font-black tracking-wider">
                                      XAI
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                      isNormal 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                        : isTB 
                                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                          : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                    }`}>
                                      {scan.result}
                                    </span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                      {(confidencePct * 100).toFixed(1)}% Confidence
                                    </span>
                                  </div>

                                  <div className="mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        isNormal ? 'bg-emerald-500' : isTB ? 'bg-rose-500' : 'bg-purple-500'
                                      }`}
                                      style={{ width: `${Math.min(100, Math.max(2, confidencePct * 100))}%` }}
                                    />
                                  </div>

                                  <span className="text-[11px] text-slate-400 mt-1.5 block">
                                    {Number.isNaN(scanDate.getTime())
                                      ? 'Date unavailable'
                                      : scanDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                <div className="flex flex-col gap-1.5 shrink-0">
                                  {scan.heatmap_url && (
                                    <button
                                      onClick={() => setHeatmapScanId(prev => (prev === scan.id ? null : scan.id))}
                                      title={showHeatmap ? 'Show original radiograph' : 'Show Grad-CAM attention overlay'}
                                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                        showHeatmap
                                          ? 'bg-rose-600 border-rose-600 text-white shadow-xs shadow-rose-500/25'
                                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-800 dark:hover:text-rose-400'
                                      }`}
                                    >
                                      <Flame size={12} className="shrink-0" />
                                      <span>{showHeatmap ? 'Hide Map' : 'Heatmap'}</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setSelectedPatient(null)
                                      navigate('/history', { state: { highlightRecordId: scan.id } })
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all cursor-pointer"
                                  >
                                    View Report
                                  </button>
                                </div>
                              </div>

                              {showHeatmap && (
                                <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/50 font-mono flex items-center gap-1.5">
                                  <Layers size={10} className="shrink-0" />
                                  DenseNet-121 layer-4 gradient activation localization
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Bottom Action Bar */}
              <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 sm:gap-2.5">
                  <button
                    onClick={() => {
                      const p = selectedPatient
                      setSelectedPatient(null)
                      openEditModal(p)
                    }}
                    className="whitespace-nowrap w-full sm:w-auto px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Edit size={13} className="shrink-0" />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      const p = selectedPatient
                      setSelectedPatient(null)
                      navigate('/book', { state: { patientForBooking: p } })
                    }}
                    className="whitespace-nowrap w-full sm:w-auto px-3 sm:px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Calendar size={13} className="shrink-0" />
                    <span>Book Token</span>
                  </button>

                  <button
                    onClick={() => {
                      const p = selectedPatient
                      setSelectedPatient(null)
                      navigate('/history', { state: { searchQuery: p.name || p.phone || p.cnic } })
                    }}
                    className="whitespace-nowrap w-full sm:w-auto px-3 sm:px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText size={13} className="shrink-0" />
                    <span className="sm:hidden">Reports</span>
                    <span className="hidden sm:inline">View Scans &amp; Reports</span>
                  </button>

                  <button
                    onClick={() => {
                      const p = selectedPatient
                      setSelectedPatient(null)
                      navigate('/predict', { state: { patient: p } })
                    }}
                    className="whitespace-nowrap w-full sm:w-auto px-3 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Activity size={13} className="shrink-0" />
                    <span className="sm:hidden">AI Screen</span>
                    <span className="hidden sm:inline">Start AI Screening</span>
                  </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default Patients
