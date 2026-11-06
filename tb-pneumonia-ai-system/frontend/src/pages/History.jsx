import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { 
  Search, Filter, Clock, Download, 
  ChevronRight, ChevronLeft, Activity, FileText, 
  User, Calendar, Shield, Printer, X, Mail,
  Link as LinkIcon, Eye, Edit2, Trash2, Stethoscope, Building2,
  CheckCircle2, AlertCircle, RefreshCw, Sparkles, ArrowRight,
  ShieldCheck, ImageOff, MessageSquare
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api, { getHistory, getAssetUrl, getProtectedImageUrl, getPatientInquiries } from '../services/api'
import { toast } from 'react-toastify'
import { clinicalSwal } from '../utils/alert'
import { useAuth } from '../services/AuthContext'
const loadHtml2Pdf = async () => {
  if (typeof window !== 'undefined' && window.html2pdf) {
    return window.html2pdf
  }
  return new Promise((resolve) => {
    const existing = document.getElementById('html2pdf-cdn')
    if (existing) {
      if (window.html2pdf) return resolve(window.html2pdf)
      existing.addEventListener('load', () => resolve(window.html2pdf))
      existing.addEventListener('error', () => resolve(null))
      return
    }
    const script = document.createElement('script')
    script.id = 'html2pdf-cdn'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    script.onload = () => resolve(window.html2pdf)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

const getClinicalFindings = (result, confidence) => {
  const confPct = ((confidence || 0) * 100).toFixed(1);
  if (result === 'Normal') {
    return {
      statusColor: 'emerald',
      statusText: 'Negative / Normal Findings',
      lungs: 'Bilateral lung fields demonstrate normal aeration, symmetric volume, and clear parenchymal texture without evidence of focal airspace consolidation, cavitary lesion, or pleural effusion.',
      cardio: 'Cardiothoracic ratio (CTR) is within normal clinical limits (< 0.50). Mediastinal, aortic, and hilar contours unremarkable. Costophrenic and cardiophrenic sulci are sharp.',
      bones: 'Bony thorax, bilateral clavicles, ribs, and visualized cervical-dorsal spine structures appear intact without fracture or destructive lesions.',
      impression: 'No acute cardiopulmonary disease. Negative for active pulmonary tuberculosis or infectious consolidation.',
      recommendation: 'Routine medical wellness follow-up. Repeat diagnostic imaging indicated only if respiratory symptoms develop.'
    };
  } else if (result === 'TB') {
    return {
      statusColor: 'rose',
      statusText: 'Positive / Active TB Findings',
      lungs: 'Apical / upper-lobe fibronodular parenchymal opacification and reticulonodular infiltrates characteristic of Mycobacterium tuberculosis infection. Focal radiolucencies suggestive of cavitary necrosis.',
      cardio: 'Cardiac silhouette within normal parameters. Reactive hilar prominence and localized apical pleural thickening identified.',
      bones: 'Thoracic osseous framework intact without destructive bony alterations.',
      impression: `POSITIVE: Radiographic features strongly suggestive of active Pulmonary Tuberculosis (CAD Confidence: ${confPct}%).`,
      recommendation: 'Immediate sputum Acid-Fast Bacillus (AFB) microscopy, GeneXpert MTB/RIF molecular assay, and clinical evaluation for initiating standard DOTS anti-tuberculosis therapy.'
    };
  } else {
    return {
      statusColor: 'purple',
      statusText: 'Positive / Acute Pneumonia Findings',
      lungs: 'Focal or lobar airspace consolidation, localized alveolar opacification, and air bronchograms consistent with acute inflammatory exudative process.',
      cardio: 'Cardiac contours intact. Localized reactive peribronchial cuffing and vascular prominence adjacent to consolidation.',
      bones: 'Thoracic skeletal structures within normal morphological limits.',
      impression: `POSITIVE: Radiographic findings consistent with Acute Pulmonary Pneumonia / Consolidation (CAD Confidence: ${confPct}%).`,
      recommendation: 'Urgent clinical correlation with patient auscultation (rales/crackles), SpO2 monitoring, complete blood count (CBC/CRP), and targeted antimicrobial therapy.'
    };
  }
};

const History = () => {
  const { user } = useAuth()
  const location = useLocation()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [reportViewMode, setReportViewMode] = useState('original') // 'original' | 'heatmap'
  const [reportImageFailed, setReportImageFailed] = useState(false)
  const [selectedPatientGroup, setSelectedPatientGroup] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [resultFilter, setResultFilter] = useState('all') // 'all' | 'Normal' | 'TB' | 'Pneumonia'
  const [patientHistory, setPatientHistory] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 10

  useEffect(() => {
    setReportViewMode('original')
    setReportImageFailed(false)
  }, [selectedRecord])

  const fetchHistoryData = async () => {
    try {
      const data = await getHistory()
      setHistory(data)
      
      // Auto-open highlighted report if navigated with deep link record ID
      if (location.state?.highlightRecordId) {
        const rec = data.find(item => item.id === location.state.highlightRecordId)
        if (rec) {
          setSelectedRecord(rec)
        }
      }
    } catch (err) {
      console.error("Failed to fetch screening records history:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistoryData()
    if (location.state?.searchQuery) {
      setSearchQuery(location.state.searchQuery)
    }
  }, [location.state])

  useEffect(() => {
    if (selectedRecord && selectedRecord.patient_name !== "Guest/Self") {
      const related = history.filter(h => 
        h.id !== selectedRecord.id && 
        h.patient_name === selectedRecord.patient_name
      ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setPatientHistory(related)
    } else {
      setPatientHistory([])
    }
  }, [selectedRecord, history])

  // PDF Export
  const downloadPDF = async () => {
    if (!selectedRecord) return
    
    clinicalSwal.fire({
      title: 'Generating Report...',
      text: 'Preparing high-resolution clinical PDF document...',
      allowOutsideClick: false,
      didOpen: () => {
        clinicalSwal.showLoading()
      }
    })

    const element = document.getElementById('report-modal-content')
    if (!element) return

    const originalHeight = element.style.height
    const originalMaxHeight = element.style.maxHeight
    const originalOverflow = element.style.overflow
    const originalWidth = element.style.width
    const originalPadding = element.style.padding

    const images = Array.from(element.querySelectorAll('img'))
    const originalSrcMap = new Map()

    // Pre-convert images to base64 Data URLs so html2canvas renders them with 100% reliability
    await Promise.all(
      images.map(async (img) => {
        originalSrcMap.set(img, img.src)
        try {
          if (img.complete && img.naturalWidth > 0) {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
            if (dataUrl && dataUrl.startsWith('data:image/')) {
              img.src = dataUrl
              return
            }
          }
        } catch {
          // If canvas tainted, fallback to fetch blob
        }

        try {
          const resp = await fetch(img.src, { mode: 'cors' })
          const blob = await resp.blob()
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
          })
          if (dataUrl) {
            img.src = dataUrl
          }
        } catch (fetchErr) {
          console.warn('Could not convert image to data URL for PDF:', fetchErr)
        }
      })
    )

    const runPDF = async () => {
      element.classList.add('pdf-clean-sheet')
      element.style.height = 'auto'
      element.style.maxHeight = 'none'
      element.style.overflow = 'visible'
      element.style.width = '794px'
      element.style.padding = '32px'
      element.style.backgroundColor = '#ffffff'
      element.style.color = '#0f172a'

      const opt = {
        margin: [6, 6, 6, 6],
        filename: `PulmoAI-Report-${(selectedRecord.patient_name || 'Patient').replace(/\s+/g, '_')}-${selectedRecord.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2.2, 
          useCORS: true, 
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 794,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      const restoreStyles = () => {
        element.classList.remove('pdf-clean-sheet')
        element.style.height = originalHeight
        element.style.maxHeight = originalMaxHeight
        element.style.overflow = originalOverflow
        element.style.width = originalWidth
        element.style.padding = originalPadding
        element.style.backgroundColor = ''
        element.style.color = ''
        images.forEach(img => {
          const orig = originalSrcMap.get(img)
          if (orig) img.src = orig
        })
      }

      const generator = await loadHtml2Pdf()

      if (!generator) {
        restoreStyles()
        clinicalSwal.fire({
          icon: 'error',
          title: 'PDF Library Unavailable',
          text: 'PDF generator could not be initialized.',
          confirmButtonText: 'OK'
        })
        return
      }

      generator().from(element).set(opt).save().then(() => {
        restoreStyles()
        clinicalSwal.fire({
          icon: 'success',
          title: 'Report Downloaded!',
          text: 'The diagnostic PDF report has been downloaded successfully.',
          confirmButtonText: 'OK'
        })
      }).catch(err => {
        console.error("PDF generation failed:", err)
        restoreStyles()
        clinicalSwal.fire({
          icon: 'error',
          title: 'Download Notice',
          text: 'Could not generate the PDF. You can also use Print Report to save as PDF.',
          confirmButtonText: 'OK'
        })
      })
    }

    setTimeout(runPDF, 150)
  }

  // CSV Export
  const exportCSV = () => {
    if (!filteredHistory || filteredHistory.length === 0) {
      clinicalSwal.fire({
        icon: 'warning',
        title: 'No Records',
        text: 'There are no screening records matching your filters to export.',
        confirmButtonText: 'OK'
      })
      return
    }
    
    const headers = [
      "Screening ID", "Patient Name", "CNIC", "Phone", 
      "Gender", "Age", "Address", "AI Result", 
      "Confidence %", "Doctor Name", "Screening Date"
    ]
    
    const rows = filteredHistory.map(item => [
      `REF-${item.id}`,
      `"${item.patient_name || 'Guest/Self'}"`,
      `"${item.patient_cnic || 'N/A'}"`,
      `"${item.patient_phone || 'N/A'}"`,
      `"${item.patient_gender || 'N/A'}"`,
      `"${item.patient_age || 'N/A'}"`,
      `"${(item.patient_address || '').replace(/"/g, '""')}"`,
      `"${item.result}"`,
      `"${(item.confidence * 100).toFixed(1)}%"`,
      `"${item.doctor_name || 'N/A'}"`,
      `"${new Date(item.created_at).toLocaleDateString()}"`
    ])
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n")
      
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `pulmoai_clinical_records_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    clinicalSwal.fire({
      icon: 'success',
      title: 'Records Exported!',
      text: `Exported ${rows.length} diagnostic records to CSV.`,
      confirmButtonText: 'OK'
    })
  }

  // Filtered list
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = (item.patient_name || '').toLowerCase().includes(q)
        const matchResult = (item.result || '').toLowerCase().includes(q)
        const matchRef = `#ref-${item.id}`.toLowerCase().includes(q)
        const matchDoctor = (item.doctor_name || '').toLowerCase().includes(q)
        const matchPhone = (item.patient_phone || '').toLowerCase().includes(q)
        const matchCnic = (item.patient_cnic || '').toLowerCase().includes(q)

        if (!matchName && !matchResult && !matchRef && !matchDoctor && !matchPhone && !matchCnic) {
          return false
        }
      }

      // 2. Result Filter
      if (resultFilter !== 'all') {
        if (resultFilter === 'TB' && item.result !== 'TB') return false
        if (resultFilter === 'Normal' && item.result !== 'Normal') return false
        if (resultFilter === 'Pneumonia' && item.result !== 'Pneumonia') return false
      }

      // 3. Date Filter
      if (selectedDate) {
        const dateObj = new Date(item.created_at)
        const recordDate = dateObj.getUTCFullYear() + '-' + 
                          String(dateObj.getUTCMonth() + 1).padStart(2, '0') + '-' + 
                          String(dateObj.getUTCDate()).padStart(2, '0')
        if (recordDate !== selectedDate) return false
      }

      return true
    })
  }, [history, searchQuery, resultFilter, selectedDate])

  // Group by patient phone/cnic for registered patients
  const groupedHistory = useMemo(() => {
    const groups = {}
    const guestRecords = []
    
    filteredHistory.forEach(item => {
      const isRegistered = item.patient_name !== "Guest/Self" && item.patient_phone && item.patient_phone !== "N/A"
      
      if (isRegistered) {
        const key = item.patient_phone
        if (!groups[key]) {
          groups[key] = {
            id: item.id,
            isGroup: true,
            user_id: item.user_id,
            patient_name: item.patient_name,
            patient_profile_pic: item.patient_profile_pic,
            patient_address: item.patient_address,
            patient_gender: item.patient_gender,
            patient_age: item.patient_age,
            patient_cnic: item.patient_cnic,
            patient_phone: item.patient_phone,
            result: item.result,
            confidence: item.confidence,
            created_at: item.created_at,
            all_scores: item.all_scores,
            image_path: item.image_path,
            doctor_name: item.doctor_name,
            doctor_clinic_name: item.doctor_clinic_name,
            doctor_profile_pic: item.doctor_profile_pic,
            doctor_specialization: item.doctor_specialization,
            scans: [item]
          }
        } else {
          groups[key].scans.push(item)
          if (new Date(item.created_at) > new Date(groups[key].created_at)) {
            groups[key].id = item.id
            groups[key].result = item.result
            groups[key].confidence = item.confidence
            groups[key].created_at = item.created_at
            groups[key].image_path = item.image_path
            groups[key].all_scores = item.all_scores
          }
        }
      } else {
        guestRecords.push({
          ...item,
          isGroup: false,
          scans: [item]
        })
      }
    })
    
    const sortedGroups = Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const sortedGuests = guestRecords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
    return [...sortedGroups, ...sortedGuests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [filteredHistory])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedDate, resultFilter])

  // Print state to print entire matching archive instead of single page
  const [isPrinting, setIsPrinting] = useState(false)

  // Watch for a doctor replying while the patient sits on their dashboard.
  // Null until the first poll lands, so opening the page stays quiet.
  const seenReplyIdsRef = useRef(null)

  useEffect(() => {
    if (user?.role !== 'patient') return undefined

    let cancelled = false
    const checkForNewReplies = async () => {
      try {
        const res = await getPatientInquiries()
        if (cancelled) return
        const replies = (res.data || []).flatMap(m => m.replies || [])

        if (seenReplyIdsRef.current) {
          const fresh = replies.filter(r => !seenReplyIdsRef.current.has(r.id))
          if (fresh.length === 1) {
            toast.info(`New reply from Dr. ${fresh[0].sender_name || 'your doctor'}`, { autoClose: 3000 })
          } else if (fresh.length > 1) {
            toast.info(`${fresh.length} new replies received`, { autoClose: 3000 })
          }
        }
        seenReplyIdsRef.current = new Set(replies.map(r => r.id))
      } catch {
        // A failed poll is not worth surfacing on a records page.
      }
    }

    checkForNewReplies()
    const poll = setInterval(checkForNewReplies, 15000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [user?.role])

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true)
    const handleAfterPrint = () => setIsPrinting(false)

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  const handlePrintArchive = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
    }, 120)
  }

  // Pagination
  const indexOfLastRecord = currentPage * recordsPerPage
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage
  const currentRecords = groupedHistory.slice(indexOfFirstRecord, indexOfLastRecord)
  const totalPages = Math.ceil(groupedHistory.length / recordsPerPage) || 1

  // Overall statistics
  const currentStats = useMemo(() => {
    return {
      total: history.length,
      normal: history.filter(h => h.result === 'Normal').length,
      tb: history.filter(h => h.result === 'TB').length,
      pneumonia: history.filter(h => h.result === 'Pneumonia').length
    }
  }, [history])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="size-12 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 animate-spin">
          <RefreshCw size={24} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Loading Diagnostic Records...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12 print:max-w-none print:px-0 print:pt-0 print:pb-0">
      
      {/* Background Archive Content: Hidden during print if a specific patient report modal is open */}
      <div className={selectedRecord ? 'print:hidden' : ''}>
        {/* ─────────────────────────────────────────────────────────────
            Official Clinical Archive Print Header (Visible ONLY on Print)
        ───────────────────────────────────────────────────────────── */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900 text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo-mark-128.png" alt="PulmoAI" className="size-6 object-contain" />
              <span className="font-extrabold text-xl tracking-tight text-slate-900">PulmoAI</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border border-slate-900 rounded">
                Clinical CAD System
              </span>
            </div>
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
              Patient Radiograph Screening Archive &amp; Registry
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Differential diagnostic classifications for Tuberculosis, Pneumonia, and Normal CXR findings.
            </p>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p className="font-bold text-slate-900 text-sm">
              {user?.role === 'doctor' ? `Supervising: Dr. ${user.name}` : `Patient: ${user?.name || 'Diagnostic Archive'}`}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Printed on: {new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
              Scope: {resultFilter === 'all' ? 'All Screenings' : `${resultFilter} Only`} • {filteredHistory.length} Records
            </p>
          </div>
        </div>

        {/* Print Summary Metrics Bar */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-300 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Scans</span>
            <strong className="text-slate-900 text-sm">{currentStats.total}</strong>
          </div>
          <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Normal (Clear)</span>
            <strong className="text-slate-900 text-sm">{currentStats.normal}</strong>
          </div>
          <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Tuberculosis</span>
            <strong className="text-slate-900 text-sm">{currentStats.tb}</strong>
          </div>
          <div className="p-1.5 border border-slate-300 rounded bg-slate-50">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Pneumonia</span>
            <strong className="text-slate-900 text-sm">{currentStats.pneumonia}</strong>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Page Header & Quick Action Buttons (Screen Only)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5 sm:mb-6 print:hidden">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1.5">
            <FileText size={13} />
            <span>Clinical Diagnostic Archive</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Patient Diagnostic Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Access radiograph classifications, differential scores, and verifiable clinical reports.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {user?.role === 'patient' && (
            <Link
              to="/my-inquiries"
              className="whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <MessageSquare size={14} />
              <span>My Inquiries</span>
            </Link>
          )}

          {user?.role === 'doctor' && (
            <button
              onClick={exportCSV}
              className="whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={handlePrintArchive}
            className="whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Printer size={14} />
            <span>Print Archive</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Interactive Stat Cards (Filter by diagnosis on click) — Screen Only
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 print:hidden">
        
        {/* All Records */}
        <div 
          onClick={() => setResultFilter('all')}
          className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            resultFilter === 'all'
              ? 'bg-blue-500/10 border-blue-500/40 dark:bg-blue-950/40 dark:border-blue-500/40 ring-1 ring-blue-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Scans</span>
            <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60">
              <FileText size={15} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {currentStats.total}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">All diagnostic screenings</p>
        </div>

        {/* Normal */}
        <div 
          onClick={() => setResultFilter('Normal')}
          className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            resultFilter === 'Normal'
              ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/40 dark:border-emerald-500/40 ring-1 ring-emerald-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Normal (Clear)</span>
            <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/60">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {currentStats.normal}
          </div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium">Clear of acute disease</p>
        </div>

        {/* Tuberculosis */}
        <div 
          onClick={() => setResultFilter('TB')}
          className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            resultFilter === 'TB'
              ? 'bg-rose-500/10 border-rose-500/40 dark:bg-rose-950/40 dark:border-rose-500/40 ring-1 ring-rose-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tuberculosis</span>
            <div className="size-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-900/60">
              <AlertCircle size={15} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
            {currentStats.tb}
          </div>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">TB patterns flagged</p>
        </div>

        {/* Pneumonia */}
        <div 
          onClick={() => setResultFilter('Pneumonia')}
          className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            resultFilter === 'Pneumonia'
              ? 'bg-purple-500/10 border-purple-500/40 dark:bg-purple-950/40 dark:border-purple-500/40 ring-1 ring-purple-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pneumonia</span>
            <div className="size-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-900/60">
              <Activity size={15} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">
            {currentStats.pneumonia}
          </div>
          <p className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-0.5 font-medium">Infiltrate opacities</p>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          Control & Filter Toolbar — Screen Only
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 mb-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-xs print:hidden">
        
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input 
            type="text" 
            placeholder="Search patient name, CNIC, screening #REF ID, or doctor..."
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

        {/* Date Filter & Clear Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Quick Date Trigger */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white text-xs outline-none cursor-pointer"
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')}
                className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                title="Clear date"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Today Button */}
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              selectedDate === new Date().toISOString().split('T')[0]
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Today
          </button>

          {(searchQuery || selectedDate || resultFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedDate('')
                setResultFilter('all')
              }}
              className="text-xs font-bold text-rose-500 hover:underline px-2 py-1 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          Records Presentation: Desktop Table & Mobile Cards
      ───────────────────────────────────────────────────────────── */}
      {groupedHistory.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="size-14 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Diagnostic Records Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
            {searchQuery || selectedDate || resultFilter !== 'all'
              ? 'No screening records match your active search and filter criteria.'
              : 'There are no screening records archived in the clinical system yet.'}
          </p>
          {(searchQuery || selectedDate || resultFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedDate('')
                setResultFilter('all')
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Desktop & Print Clinical Records Table ── */}
          <div className="hidden md:block print:block bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs print:border print:border-slate-300 print:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 print:text-slate-900">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 print:bg-slate-100 print:text-black print:border-slate-400">
                  <tr>
                    <th className="py-3.5 px-4 print:py-2 print:px-3">Ref ID &amp; Date</th>
                    <th className="py-3.5 px-4 print:py-2 print:px-3">Patient Demographics</th>
                    <th className="py-3.5 px-4 print:py-2 print:px-3">Screening Radiologist</th>
                    <th className="py-3.5 px-4 print:py-2 print:px-3">Diagnostic Verdict</th>
                    <th className="py-3.5 px-4 text-right print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium print:divide-slate-200">
                  {(isPrinting ? groupedHistory : currentRecords).map((item) => {
                    const isNormal = item.result === 'Normal'
                    const isTB = item.result === 'TB'
                    const isPneumonia = item.result === 'Pneumonia'

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        
                        {/* Ref ID & Date */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 block">
                              #REF-{item.id}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              {new Date(item.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            {item.isGroup && item.scans.length > 1 && (
                              <button
                                onClick={() => setSelectedPatientGroup(item)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 text-[10px] font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                <Clock size={10} />
                                <span>{item.scans.length} Scans History</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Patient Demographics */}
                        <td className="py-3.5 px-4 print:py-2 print:px-3">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-xs print:hidden">
                              {item.patient_profile_pic ? (
                                <img 
                                  src={getAssetUrl(item.patient_profile_pic, new Date(item.created_at).getTime())} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                  onError={(e) => {
                                    e.target.onerror = null
                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.patient_name || 'Patient')}&background=2563eb&color=fff`
                                  }}
                                />
                              ) : (
                                <span>{(item.patient_name || 'P')[0].toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                {item.patient_name || 'Guest / Self'}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {item.patient_phone || item.patient_cnic || 'Unlinked Profile'}
                              </p>
                              {item.patient_address && (
                                <span className="text-[10px] text-slate-400 truncate block max-w-[180px]">
                                  {item.patient_address}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Doctor Attribution */}
                        <td className="py-3.5 px-4 print:py-2 print:px-3">
                          {item.scans[0]?.doctor_name ? (
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-900/60 shrink-0 print:hidden">
                                <Stethoscope size={14} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                  Dr. {item.scans[0].doctor_name}
                                </p>
                                {item.scans[0].doctor_clinic_name && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {item.scans[0].doctor_clinic_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Self / Unreferred</span>
                          )}
                        </td>

                        {/* Diagnostic Verdict */}
                        <td className="py-3.5 px-4 print:py-2 print:px-3">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold print:border print:border-slate-700 print:text-black print:bg-transparent ${
                              isNormal ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                              isTB ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                              'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            }`}>
                              <span className={`size-1.5 rounded-full print:hidden ${
                                isNormal ? 'bg-emerald-500' : isTB ? 'bg-rose-500' : 'bg-purple-500'
                              }`}></span>
                              <span>{item.result === 'TB' ? 'Tuberculosis' : item.result}</span>
                            </span>
                            <span className="text-[11px] text-slate-400 print:text-slate-600 font-semibold block ml-1">
                              {(item.confidence * 100).toFixed(1)}% Confidence
                            </span>
                          </div>
                        </td>

                        {/* Actions (Screen Only) */}
                        <td className="py-3.5 px-4 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                if (item.isGroup && item.scans.length > 1) {
                                  setSelectedPatientGroup(item)
                                } else {
                                  setSelectedRecord(item.scans[0])
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye size={13} />
                              <span>{item.isGroup && item.scans.length > 1 ? "History" : "View Report"}</span>
                            </button>

                            {user?.role === 'doctor' && (
                              <>
                                <button
                                  onClick={() => {
                                    clinicalSwal.fire({
                                      title: 'Link to Patient',
                                      text: 'Enter the patient CNIC or Phone number to link this screening record:',
                                      input: 'text',
                                      inputPlaceholder: 'CNIC or Phone (03XXXXXXXXX)...',
                                      showCancelButton: true,
                                      confirmButtonText: 'Link Record',
                                      cancelButtonText: 'Cancel'
                                    }).then(async (result) => {
                                      if (result.isConfirmed && result.value) {
                                        try {
                                          const res = await api.post('/doctor/link-prediction-to-patient', {
                                            prediction_id: item.id,
                                            patient_identifier: result.value
                                          })
                                          clinicalSwal.fire({
                                            icon: 'success',
                                            title: 'Linked!',
                                            text: res.data.message || 'Record successfully linked.',
                                            confirmButtonText: 'OK'
                                          })
                                          fetchHistoryData()
                                        } catch (err) {
                                          clinicalSwal.fire({
                                            icon: 'error',
                                            title: 'Linking Failed',
                                            text: err.response?.data?.detail || 'Could not link record.',
                                            confirmButtonText: 'OK'
                                          })
                                        }
                                      }
                                    })
                                  }}
                                  className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Link to Patient Profile"
                                >
                                  <Edit2 size={14} />
                                </button>

                                <button
                                  onClick={() => {
                                    clinicalSwal.fire({
                                      title: 'Delete Screening Record?',
                                      text: `Are you sure you want to permanently delete record #REF-${item.id}? This cannot be undone.`,
                                      icon: 'warning',
                                      showCancelButton: true,
                                      confirmButtonText: 'Yes, Delete',
                                      cancelButtonText: 'Cancel'
                                    }).then(async (result) => {
                                      if (result.isConfirmed) {
                                        try {
                                          await api.delete(`/doctor/delete-prediction/${item.id}`)
                                          clinicalSwal.fire({
                                            icon: 'success',
                                            title: 'Deleted!',
                                            text: 'Screening record permanently deleted.',
                                            confirmButtonText: 'OK'
                                          })
                                          fetchHistoryData()
                                        } catch (err) {
                                          clinicalSwal.fire({
                                            icon: 'error',
                                            title: 'Delete Failed',
                                            text: 'Failed to delete record.',
                                            confirmButtonText: 'OK'
                                          })
                                        }
                                      }
                                    })
                                  }}
                                  className="p-2 rounded-xl text-slate-400 hover:bg-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Record Cards (Screen Only) ── */}
          <div className="md:hidden print:hidden space-y-3">
            {currentRecords.map((item) => {
              const isNormal = item.result === 'Normal'
              const isTB = item.result === 'TB'

              return (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (item.isGroup && item.scans.length > 1) {
                      setSelectedPatientGroup(item)
                    } else {
                      setSelectedRecord(item.scans[0])
                    }
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-xs flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {item.patient_profile_pic ? (
                        <img 
                          src={getAssetUrl(item.patient_profile_pic, new Date(item.created_at).getTime())} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <span>{(item.patient_name || 'P')[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          #REF-{item.id}
                        </span>
                        {item.isGroup && item.scans.length > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[9px] font-bold">
                            {item.scans.length} Scans
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate mt-0.5">
                        {item.patient_name || 'Guest / Self'}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                        {item.scans[0]?.doctor_name ? ` • Dr. ${item.scans[0].doctor_name}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                    isNormal ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                    isTB ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                    'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  }`}>
                    {item.result}
                  </span>
                </motion.div>
              )
            })}
          </div>

          {/* ── Modern Pagination Controls (Screen Only) ── */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs print:hidden">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing <strong className="text-slate-900 dark:text-white">{indexOfFirstRecord + 1}</strong> to <strong className="text-slate-900 dark:text-white">{Math.min(indexOfLastRecord, groupedHistory.length)}</strong> of <strong className="text-slate-900 dark:text-white">{groupedHistory.length}</strong> patient records
              </p>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(prev => Math.max(1, prev - 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {currentPage} / {totalPages}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages, prev + 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: Patient Multi-Scan Timeline Modal (z-[200])
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedPatientGroup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 print:hidden">
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setSelectedPatientGroup(null)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="h-0.5 bg-blue-600 shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedPatientGroup.patient_name?.[0] || 'P'}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {selectedPatientGroup.patient_name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedPatientGroup.scans.length} Diagnostic Screenings on Record
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedPatientGroup(null)}
                  className="size-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scans Timeline list */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1">
                {selectedPatientGroup.scans
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((scan) => {
                    const isNormal = scan.result === 'Normal'
                    const isTB = scan.result === 'TB'

                    return (
                      <div 
                        key={scan.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-blue-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="size-12 rounded-xl bg-black overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                            <img 
                              src={getProtectedImageUrl(scan.image_path, new Date(scan.created_at).getTime())} 
                              alt="Scan" 
                              className="w-full h-full object-cover" 
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                isNormal ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                                isTB ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                                'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              }`}>
                                {scan.result}
                              </span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {(scan.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              {new Date(scan.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {scan.doctor_name && (
                              <span className="text-[10px] text-indigo-500 font-semibold block mt-0.5">
                                Dr. {scan.doctor_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedRecord(scan)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye size={13} />
                          <span>View Report</span>
                        </button>
                      </div>
                    )
                  })}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: Clinical Report Viewer & PDF Exporter (z-[250])
          Renders on top of timeline modal when triggered
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 print:static print:inset-auto print:z-auto print:block print:w-full print:p-0 print:m-0 print:bg-white">
            <div 
              className="absolute inset-0 bg-black/75 backdrop-blur-md print:hidden"
              onClick={() => setSelectedRecord(null)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col print:static print:transform-none print:w-full print:max-w-none print:max-h-none print:rounded-none print:border-none print:shadow-none print:overflow-visible print:bg-white print:p-0"
            >
              <div className="h-0.5 bg-blue-600 shrink-0 print:hidden" />

              {/* Modal Top Header (Screen Only) */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                      Clinical Diagnostic Report
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Reference ID: #REF-{selectedRecord.id}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="size-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Printable Body */}
              <div id="report-modal-content" className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 print:p-0 print:overflow-visible print:space-y-4 print:block print:w-full">
                {(() => {
                  const findings = getClinicalFindings(selectedRecord.result, selectedRecord.confidence);
                  const recordDate = new Date(selectedRecord.created_at);
                  const accessionNo = `CAD-${String(selectedRecord.id).padStart(6, '0')}`;
                  const securityHash = `SHA-CAD-${selectedRecord.id}-${recordDate.getTime().toString(36).toUpperCase()}`;

                  return (
                    <>
                      {/* Hospital Header Banner */}
                      <div className="flex justify-between items-start border-b-2 border-slate-200 dark:border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest">
                              OFFICIAL DIAGNOSTIC REPORT
                            </span>
                            <span className="text-[11px] font-mono font-bold text-slate-500">
                              Acc. #{accessionNo}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <img src="/logo-mark-128.png" alt="PulmoAI" className="size-7 object-contain" />
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                              PulmoAI Clinical Health System
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Department of Diagnostic Pulmonology &amp; Thoracic Radiography CAD
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                            <span><strong>Engine:</strong> DenseNet-121 Deep Neural Network</span>
                            <span>•</span>
                            <span><strong>Modality:</strong> Chest Radiograph (CXR PA/AP)</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              ✓ CXR Biometric &amp; Radiographic Integrity Authenticated
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            {recordDate.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="text-[11px] text-slate-400 block font-mono">
                            {recordDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Validated Radiograph
                          </span>
                        </div>
                      </div>

                      {/* Patient Information Grid */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Patient Name</span>
                          <span className="font-bold text-slate-900 dark:text-white truncate block text-sm">
                            {selectedRecord.patient_name || 'Guest / Unassigned'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Age &amp; Gender</span>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {selectedRecord.patient_age ? `${selectedRecord.patient_age} yrs` : 'N/A'} • {selectedRecord.patient_gender || 'Unspecified'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">CNIC / Identity</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">
                            {selectedRecord.patient_cnic || 'N/A'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Contact Phone</span>
                          <span className="font-bold text-slate-900 dark:text-white truncate block">
                            {selectedRecord.patient_phone || 'N/A'}
                          </span>
                        </div>

                        {selectedRecord.patient_address && (
                          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Address</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium block">
                              {selectedRecord.patient_address}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Doctor Attribution Card (if present) */}
                      {selectedRecord.doctor_name && (
                        <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 flex items-center gap-3.5">
                          <div className="size-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            <Stethoscope size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">Referring Radiologist / Physician</span>
                            <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                              Dr. {selectedRecord.doctor_name}
                            </p>
                            {selectedRecord.doctor_clinic_name && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {selectedRecord.doctor_clinic_name} {selectedRecord.doctor_specialization ? `• ${selectedRecord.doctor_specialization}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Radiograph & Verdict Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                        
                        {/* Radiograph Lightbox */}
                        <div className="rounded-xl overflow-hidden bg-black border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-2 min-h-[220px]">
                          {selectedRecord.heatmap_url && (
                            <div className="flex items-center gap-1.5 mb-2 print:hidden bg-slate-900/90 p-1 rounded-lg border border-slate-700">
                              <button
                                type="button"
                                onClick={() => setReportViewMode('original')}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                  reportViewMode === 'original'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Original CXR
                              </button>
                              <button
                                type="button"
                                onClick={() => setReportViewMode('heatmap')}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                                  reportViewMode === 'heatmap'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                <span>Grad-CAM Heatmap</span>
                                <span className="px-1 py-0.2 rounded text-[8px] bg-white/20 font-black">XAI</span>
                              </button>
                            </div>
                          )}
                          {reportImageFailed ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 text-center px-4 py-6 print:hidden">
                              <ImageOff size={22} className="text-slate-600" />
                              <p className="text-[11px] font-bold text-slate-300">
                                {reportViewMode === 'heatmap' ? 'Heatmap' : 'Radiograph'} unavailable
                              </p>
                              <p className="text-[10px] text-slate-500 max-w-[220px]">
                                The file could not be loaded from the media service. The rest of the report is unaffected.
                              </p>
                            </div>
                          ) : (
                            <img
                              src={getProtectedImageUrl(
                                reportViewMode === 'heatmap' && selectedRecord.heatmap_url
                                  ? selectedRecord.heatmap_url
                                  : selectedRecord.image_path,
                                recordDate.getTime()
                              )}
                              alt={reportViewMode === 'heatmap' ? "Grad-CAM Saliency Map" : "Chest Radiograph"}
                              onError={() => setReportImageFailed(true)}
                              className="max-h-[260px] w-auto object-contain rounded-lg transition-all duration-300"
                            />
                          )}
                          {reportViewMode === 'heatmap' && (
                            <p className="text-[10px] text-slate-400 mt-1 font-mono text-center print:hidden">
                              DenseNet-121 layer-4 gradient activation localization
                            </p>
                          )}
                        </div>

                        {/* Verdict & Probability */}
                        <div className="flex flex-col justify-between space-y-3">
                          <div className={`p-4 rounded-xl border ${
                            selectedRecord.result === 'Normal' ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800' :
                            selectedRecord.result === 'TB' ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800' :
                            'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                Primary Diagnosis
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                selectedRecord.result === 'Normal' ? 'bg-emerald-200 text-emerald-900' :
                                selectedRecord.result === 'TB' ? 'bg-rose-200 text-rose-900' :
                                'bg-purple-200 text-purple-900'
                              }`}>
                                {findings.statusText}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between mt-2">
                              <span className={`text-2xl font-black ${
                                selectedRecord.result === 'Normal' ? 'text-emerald-700 dark:text-emerald-300' :
                                selectedRecord.result === 'TB' ? 'text-rose-700 dark:text-rose-300' :
                                'text-purple-700 dark:text-purple-300'
                              }`}>
                                {selectedRecord.result === 'TB' ? 'Tuberculosis' : selectedRecord.result}
                              </span>
                              <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                                {(selectedRecord.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              Diagnostic Differential Probability
                            </span>
                          </div>

                          {/* Multiclass Breakdown */}
                          {selectedRecord.all_scores && typeof selectedRecord.all_scores === 'object' && (
                            <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                Complete Differential Distribution
                              </span>
                              {Object.entries(selectedRecord.all_scores).map(([label, score]) => (
                                <div key={label} className="text-xs">
                                  <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                    <span>{label === 'TB' ? 'Tuberculosis' : label}</span>
                                    <span className="font-mono font-bold">{(score * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        label === 'Normal' ? 'bg-emerald-500' : label === 'TB' ? 'bg-rose-500' : 'bg-purple-600'
                                      }`} 
                                      style={{ width: `${score * 100}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Clinical Radiological Observations & Findings (New Comprehensive Section) */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                          <FileText size={15} className="text-blue-600 dark:text-blue-400" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                            Clinical Radiological Observations &amp; Findings
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Lungs &amp; Pleural Cavity
                            </span>
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                              {findings.lungs}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Cardiomediastinal &amp; Hila
                            </span>
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                              {findings.cardio}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Thoracic Skeleton
                            </span>
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                              {findings.bones}
                            </p>
                          </div>
                        </div>

                        {/* Impression Callout */}
                        <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                          selectedRecord.result === 'Normal' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200' :
                          selectedRecord.result === 'TB' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-200' :
                          'bg-purple-50 dark:bg-purple-950/40 border-purple-200 text-purple-900 dark:text-purple-200'
                        }`}>
                          <p className="font-extrabold text-[12px] mb-0.5">
                            DIAGNOSTIC IMPRESSION:
                          </p>
                          <p className="font-medium text-[11px]">
                            {findings.impression}
                          </p>
                          <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 text-[10.5px]">
                            <strong>Recommended Clinical Action:</strong> {findings.recommendation}
                          </div>
                        </div>
                      </div>

                      {/* Physician Sign-Off & Verification Block (New Official Sign-Off Section) */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Attending Radiologist / Reviewing Physician
                            </span>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                              {selectedRecord.doctor_name ? `Dr. ${selectedRecord.doctor_name}` : 'Staff Pulmonary Radiologist'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {selectedRecord.doctor_clinic_name || 'PulmoAI Diagnostic CAD Center'}
                            </p>
                            <div className="mt-4 pt-1 border-t border-slate-300 dark:border-slate-600">
                              <span className="text-[9px] text-slate-400 block uppercase tracking-wider">
                                Authorized Signature &amp; Stamp
                              </span>
                            </div>
                          </div>

                          <div className="sm:text-right">
                            <div className="inline-block p-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-center text-[10px] text-slate-500">
                              <span className="font-bold block text-slate-700 dark:text-slate-300">CLINICAL CAD VERIFICATION</span>
                              <span className="font-mono text-[9px] text-slate-400">{securityHash}</span>
                              <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                Digitally Verified &amp; Archived
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Medical Disclaimer */}
                      <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[10px] text-slate-500 leading-relaxed">
                        <strong>Regulatory Notice:</strong> This report is generated by PulmoAI Computer-Aided Detection (CAD) system utilizing deep learning convolutional neural networks. It is designed to assist licensed physicians and radiologists. Definitive clinical decisions, medication regimens, and invasive procedures must be corroborated with full clinical examinations.
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer Controls */}
              <div className="p-2.5 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 sm:gap-3 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="whitespace-nowrap w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 transition-colors shadow-sm min-w-0"
                >
                  <ChevronLeft size={13} className="shrink-0" />
                  <span className="sm:hidden">{selectedPatientGroup ? 'Back' : 'Close'}</span>
                  <span className="hidden sm:inline">{selectedPatientGroup ? 'Back to Scans' : 'Close'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="whitespace-nowrap w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 transition-colors shadow-sm min-w-0"
                >
                  <Printer size={13} className="shrink-0" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={downloadPDF}
                  className="whitespace-nowrap w-full px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] sm:text-xs font-bold shadow-md shadow-blue-500/25 cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 transition-all min-w-0"
                >
                  <Download size={13} className="shrink-0" />
                  <span className="sm:hidden">PDF</span>
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default History
