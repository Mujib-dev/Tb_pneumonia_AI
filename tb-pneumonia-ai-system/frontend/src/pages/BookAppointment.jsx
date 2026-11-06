import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, User, Users, Stethoscope, 
  CheckCircle2, AlertCircle, ChevronRight, Activity, 
  MapPin, Phone, Building, BookmarkCheck, Trash2, 
  Edit2, X, Search, Coins, RefreshCw,
  Sparkles, Check, ArrowRight, ShieldCheck, Ticket, Printer
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { getAssetUrl } from '../services/api';
import { clinicalSwal } from '../utils/alert';
import FieldFormatHint from '../components/FieldFormatHint';

const BookAppointment = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const preSelectedDoctorId = location.state?.selectedDoctorId;
  const patientForBooking = location.state?.patientForBooking;
  
  // Data states
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection states
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  // Exact local date string YYYY-MM-DD
  const todayDateString = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [bookingDate, setBookingDate] = useState(todayDateString);
  const [bookedTokens, setBookedTokens] = useState([]);
  const [queueWindow, setQueueWindow] = useState(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [patientNameOverride, setPatientNameOverride] = useState("");
  const [bookingInProgress, setBookingInProgress] = useState(false);
  
  // User bookings list state
  const [patientBookings, setPatientBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Rescheduling states
  const [editingApp, setEditingApp] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editBookedTokens, setEditBookedTokens] = useState([]);
  const [editQueueWindow, setEditQueueWindow] = useState(null);
  const [loadingEditTokens, setLoadingEditTokens] = useState(false);
  const [selectedEditToken, setSelectedEditToken] = useState(null);

  // Live Selected Doctor Queue states for prominent board panel
  const [selectedDoctorQueue, setSelectedDoctorQueue] = useState([]);
  const [loadingDocQueue, setLoadingDocQueue] = useState(false);
  const [queueViewDate, setQueueViewDate] = useState(todayDateString);

  // Live search state for booked tokens section
  const [tokenSearch, setTokenSearch] = useState('');

  // Pass date filter scope: 'today' | 'all' (defaults to 'today' current date only)
  const [passDateScope, setPassDateScope] = useState('today');

  // Print Token Modal State (A4 vs Small Thermal Printer)
  const [printModalToken, setPrintModalToken] = useState(null);

  const todayBookingsCount = useMemo(() => {
    return patientBookings.filter(b => b.booking_date && (b.booking_date.split('T')[0] === todayDateString)).length;
  }, [patientBookings, todayDateString]);

  const displayedBookings = useMemo(() => {
    let list = patientBookings;
    if (passDateScope === 'today') {
      list = list.filter(b => b.booking_date && (b.booking_date.split('T')[0] === todayDateString));
    }
    if (tokenSearch.trim()) {
      const q = tokenSearch.toLowerCase();
      list = list.filter(b => 
        String(b.token_number).includes(q) ||
        (b.doctor_name && b.doctor_name.toLowerCase().includes(q)) ||
        (b.clinic_name && b.clinic_name.toLowerCase().includes(q)) ||
        (b.doctor_specialization && b.doctor_specialization.toLowerCase().includes(q)) ||
        (b.booking_date && b.booking_date.toLowerCase().includes(q)) ||
        (b.patient_name && b.patient_name.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date) || b.token_number - a.token_number);
  }, [patientBookings, passDateScope, todayDateString, tokenSearch]);

  const fetchSelectedDoctorQueue = async (dateOverride) => {
    if (!selectedDoctor) return;
    setLoadingDocQueue(true);
    try {
      const dateToUse = typeof dateOverride === 'string' ? dateOverride : queueViewDate;
      const response = await api.get('/appointments/doctor-queue-public', {
        params: { doctor_id: selectedDoctor.id, date: dateToUse, active_only: true }
      });
      const data = response.data;
      setSelectedDoctorQueue(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      console.error("Failed to fetch selected doctor queue:", err);
      if (err.response?.status === 401) logout();
      setSelectedDoctorQueue([]);
    } finally {
      setLoadingDocQueue(false);
    }
  };

  // Fetch doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await api.get('/doctors/list');
        let docs = response.data || [];
        
        if (user?.role === 'doctor') {
          docs = docs.filter(d => d.id === user.id);
        }
        
        setDoctors(docs);
        if (preSelectedDoctorId) {
          const matchedDoc = docs.find(d => d.id === preSelectedDoctorId);
          if (matchedDoc) {
            setSelectedDoctor(matchedDoc);
          }
        } else if (docs.length === 1) {
          setSelectedDoctor(docs[0]);
        }
      } catch (err) {
        console.error("Failed to load doctor directory:", err);
      } finally {
        setLoadingDoctors(false);
      }
    };
    
    fetchDoctors();
    fetchPatientBookings();

    // Auto-poll patient booked queue states every 10 seconds for real-time updates
    const queuePoll = setInterval(fetchPatientBookings, 10000);
    return () => clearInterval(queuePoll);
  }, []);

  // Fetch patient bookings
  const fetchPatientBookings = async () => {
    try {
      const response = await api.get('/appointments/patient-bookings');
      setPatientBookings(response.data || []);
    } catch (err) {
      console.error("Failed to fetch bookings list:", err);
      if (err.response?.status === 401) logout();
    } finally {
      setLoadingBookings(false);
    }
  };

  // Fetch booked tokens when selected doctor or booking date changes
  useEffect(() => {
    const fetchQueueWindow = async () => {
      if (!selectedDoctor) {
        setBookedTokens([]);
        setQueueWindow(null);
        return;
      }
      setLoadingTokens(true);
      setSelectedToken(null);
      try {
        const response = await api.get('/appointments/queue-window', {
          params: { doctor_id: selectedDoctor.id, date: bookingDate }
        });
        const data = response.data || {};
        setQueueWindow(data);
        setBookedTokens(Array.isArray(data.booked_tokens) ? data.booked_tokens : []);
      } catch (err) {
        console.error("Failed to load queue window:", err);
        setQueueWindow(null);
        setBookedTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchQueueWindow();
    setQueueViewDate(bookingDate);
    fetchSelectedDoctorQueue(bookingDate);
  }, [selectedDoctor, bookingDate]);

  // Background polling for selected doctor's live queue
  useEffect(() => {
    if (!selectedDoctor) return;
    const qInterval = setInterval(() => fetchSelectedDoctorQueue(), 10000);
    return () => clearInterval(qInterval);
  }, [selectedDoctor, queueViewDate]);

  // Handle Token Booking Action
  const handleBooking = async () => {
    if (!selectedDoctor || !bookingDate || !selectedToken) {
      clinicalSwal.fire({
        icon: 'error',
        title: 'Incomplete Selection',
        text: 'Please select a Specialist, a Consult Date, and an Available Token Slot.',
        confirmButtonText: 'OK'
      });
      return;
    }

    const displayOverride = patientForBooking ? patientForBooking.name : patientNameOverride;
    
    clinicalSwal.fire({
      title: 'Confirm Token Booking?',
      html: `You are booking <strong>Token #${selectedToken}</strong> with <strong>Dr. ${selectedDoctor.name}</strong> for <strong>${new Date(bookingDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>.${displayOverride ? `<br><br><span class="text-blue-500 font-bold">Patient: <strong>${displayOverride}</strong></span>` : ''}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirm & Book Token',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setBookingInProgress(true);
        try {
          const response = await api.post('/appointments/book', {
            doctor_id: selectedDoctor.id,
            booking_date: bookingDate,
            token_number: selectedToken,
            patient_name_override: patientForBooking ? patientForBooking.name : (patientNameOverride || null),
            patient_id: patientForBooking ? patientForBooking.id : undefined
          });

          const bookedPass = {
            id: response.data.appointment_id,
            token_number: response.data.token_number,
            booking_date: bookingDate,
            doctor_name: selectedDoctor.name,
            doctor_specialization: selectedDoctor.specialization,
            clinic_name: selectedDoctor.clinic_name,
            patient_name: patientForBooking ? patientForBooking.name : (patientNameOverride || user?.name || 'Self'),
            fee_charged: selectedDoctor.consultation_fee || 0,
            status: 'pending'
          };

          clinicalSwal.fire({
            icon: 'success',
            title: 'Booking Confirmed!',
            html: `Your clinic token pass <strong>#${response.data.token_number}</strong> is registered successfully with <strong>Dr. ${selectedDoctor.name}</strong> for <strong>${new Date(bookingDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</strong>.`,
            showCancelButton: true,
            confirmButtonText: 'Print Token Pass',
            cancelButtonText: 'Done'
          }).then((swalRes) => {
            if (swalRes.isConfirmed) {
              handlePrintToken(bookedPass);
            }
          });

          setSelectedToken(null);
          setPatientNameOverride("");
          if (response.data.queue_window) {
            setQueueWindow(response.data.queue_window);
            setBookedTokens(response.data.queue_window.booked_tokens || []);
          }
          await fetchPatientBookings();

          setQueueViewDate(bookingDate);
          fetchSelectedDoctorQueue(bookingDate);
        } catch (err) {
          clinicalSwal.fire({
            icon: 'error',
            title: 'Booking Notice',
            text: err.response?.data?.detail || 'An error occurred during booking. Please try another slot.',
            confirmButtonText: 'OK'
          });
        } finally {
          setBookingInProgress(false);
        }
      }
    });
  };

  // Fetch booked tokens for rescheduling date changes
  useEffect(() => {
    const fetchEditQueueWindow = async () => {
      if (!editingApp || !editDate) return;
      setLoadingEditTokens(true);
      try {
        const response = await api.get('/appointments/queue-window', {
          params: { doctor_id: editingApp.doctor_id, date: editDate }
        });
        const data = response.data || {};
        let booked = Array.isArray(data.booked_tokens) ? data.booked_tokens : [];
        if (editingApp.booking_date === editDate) {
          booked = booked.filter(token => token !== editingApp.token_number);
        }
        setEditQueueWindow(data);
        setEditBookedTokens(booked);
      } catch (err) {
        console.error("Failed to load reschedule queue:", err);
        setEditQueueWindow(null);
        setEditBookedTokens([]);
      } finally {
        setLoadingEditTokens(false);
      }
    };

    fetchEditQueueWindow();
  }, [editingApp, editDate]);

  // Cancel Booking
  const handleCancelBooking = async (appointmentId, tokenNum, docName, status, bookingDate) => {
    if (status?.toLowerCase() === 'completed') {
      clinicalSwal.fire({
        icon: 'info',
        title: 'Checkup Complete',
        text: 'This patient checkup has been completed. Completed tokens cannot be cancelled or deleted.',
        confirmButtonText: 'OK'
      });
      return;
    }
    if (bookingDate && bookingDate < todayDateString) {
      clinicalSwal.fire({
        icon: 'info',
        title: 'Scheduled Day Ended',
        text: 'The scheduled day for this appointment has already ended. Past date tokens cannot be cancelled or deleted.',
        confirmButtonText: 'OK'
      });
      return;
    }

    clinicalSwal.fire({
      title: 'Cancel Booking?',
      html: `Are you sure you want to cancel <strong>Token #${tokenNum}</strong>? This slot will be released back to the queue.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Cancel Slot',
      cancelButtonText: 'Keep Booking'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await api.delete(`/appointments/cancel/${appointmentId}`);
          
          clinicalSwal.fire({
            icon: 'success',
            title: 'Booking Cancelled',
            text: 'Your clinic token pass was cancelled successfully.',
            confirmButtonText: 'OK'
          });
          
          if (response.data?.queue_window) {
            setQueueWindow(response.data.queue_window);
            setBookedTokens(response.data.queue_window.booked_tokens || []);
          }
          await fetchPatientBookings();
        } catch (err) {
          clinicalSwal.fire({
            icon: 'error',
            title: 'Cancellation Failed',
            text: err.response?.data?.detail || 'Could not cancel booking.',
            confirmButtonText: 'OK'
          });
        }
      }
    });
  };

  // Reschedule Booking
  const handleUpdateBooking = async () => {
    if (!editingApp || !editDate || !selectedEditToken) return;
    if (editingApp?.status?.toLowerCase() === 'completed') {
      clinicalSwal.fire({
        icon: 'info',
        title: 'Checkup Complete',
        text: 'This patient checkup has been completed. Completed tokens cannot be edited or rescheduled.',
        confirmButtonText: 'OK'
      });
      setEditingApp(null);
      return;
    }
    if (editingApp?.booking_date && editingApp.booking_date < todayDateString) {
      clinicalSwal.fire({
        icon: 'info',
        title: 'Scheduled Day Ended',
        text: 'The scheduled day for this appointment has already ended. Past date tokens cannot be edited or rescheduled.',
        confirmButtonText: 'OK'
      });
      setEditingApp(null);
      return;
    }
    
    try {
      const response = await api.put(`/appointments/update/${editingApp.id}`, {
        booking_date: editDate,
        token_number: selectedEditToken
      });
      
      clinicalSwal.fire({
        icon: 'success',
        title: 'Token Rescheduled!',
        text: `Your token has been moved to Token #${selectedEditToken} on ${new Date(editDate + 'T12:00:00').toLocaleDateString()}.`,
        confirmButtonText: 'OK'
      });
      
      if (response.data?.queue_window) {
        setQueueWindow(response.data.queue_window);
        setBookedTokens(response.data.queue_window.booked_tokens || []);
      }
      setBookingDate(editDate);
      setSelectedToken(null);
      setEditingApp(null);
      await fetchPatientBookings();
    } catch (err) {
      clinicalSwal.fire({
        icon: 'error',
        title: 'Rescheduling Failed',
        text: err.response?.data?.detail || 'Failed to reschedule appointment slot.',
        confirmButtonText: 'OK'
      });
    }
  };

  // Check In
  const handleCheckIn = async (appointmentId) => {
    try {
      const response = await api.post(`/appointments/check-in/${appointmentId}`);

      clinicalSwal.fire({
        icon: 'success',
        title: 'Checked In Successfully!',
        text: response.data?.message || "Arrival recorded. Waiting for doctor's approval.",
        confirmButtonText: 'OK'
      });

      await fetchPatientBookings();
    } catch (err) {
      clinicalSwal.fire({
        icon: 'error',
        title: 'Check-in Failed',
        text: err.response?.data?.detail || 'An error occurred during check-in.',
        confirmButtonText: 'OK'
      });
    }
  };

  // Print Token Slip (A6 Format - 105mm x 148mm)
  const handlePrintA6 = (token) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const patientDisplayName = token.patient_name || user?.name || 'Self / Patient';
    const patientPhone = user?.phone || 'On Record';
    const bookingDateFormatted = new Date(token.booking_date + 'T12:00:00').toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const issueDate = new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const refCode = `PLM-TK-${token.id || token.token_number}-${(token.booking_date || '').replace(/-/g, '')}`;
    const statusText = token.status === 'completed' ? 'Checked Up / Completed' : 
                       token.status === 'serving' ? 'Now Calling in Consultation' : 
                       token.status === 'absent' ? 'Absent / Waiting Area' : 
                       token.status === 'arrived' ? 'Checked In at Reception' : 'Active in Queue';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Clinic Appointment Token Pass #${token.token_number} - PulmoAI (A6)</title>
          <style>
            @page {
              size: A6 portrait;
              margin: 5mm 6mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .a6-wrapper {
              width: 100%;
              max-width: 95mm;
              margin: 0 auto;
              border: 1px solid #cbd5e1;
              border-radius: 10px;
              overflow: hidden;
            }
            .header-banner {
              background: #0f172a;
              color: #ffffff;
              padding: 10px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2.5px solid #2563eb;
            }
            .logo-row {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .logo-icon {
              width: 28px;
              height: 28px;
              border-radius: 6px;
              background: #2563eb;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 15px;
              color: #ffffff;
            }
            .logo-title {
              font-size: 13px;
              font-weight: 900;
              letter-spacing: -0.3px;
              line-height: 1.1;
            }
            .logo-subtitle {
              font-size: 7.5px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #94a3b8;
            }
            .header-right {
              text-align: right;
            }
            .badge-pass {
              display: inline-block;
              padding: 2px 6px;
              background: rgba(37, 99, 235, 0.25);
              border: 1px solid #3b82f6;
              border-radius: 4px;
              color: #93c5fd;
              font-size: 7.5px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .header-issue {
              font-size: 7.5px;
              color: #cbd5e1;
              margin-top: 2px;
            }
            .main-content {
              padding: 10px 12px;
            }
            .token-card {
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
              border: 1.5px solid #93c5fd;
              border-radius: 8px;
              padding: 8px 10px;
              text-align: center;
              margin-bottom: 8px;
            }
            .token-caption {
              font-size: 8px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #1d4ed8;
            }
            .token-big {
              font-size: 38px;
              font-weight: 900;
              color: #1e3a8a;
              letter-spacing: -1px;
              line-height: 1;
              margin: 2px 0 3px 0;
            }
            .token-date-text {
              font-size: 9.5px;
              font-weight: 700;
              color: #1e40af;
            }
            .token-status-pill {
              display: inline-block;
              margin-top: 4px;
              padding: 2px 8px;
              background: #ffffff;
              border: 1px solid #60a5fa;
              border-radius: 12px;
              font-size: 7.5px;
              font-weight: 800;
              text-transform: uppercase;
              color: #2563eb;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 8px;
            }
            .info-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 6px 8px;
            }
            .info-box-title {
              font-size: 7.5px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #64748b;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 3px;
              margin-bottom: 4px;
            }
            .info-item {
              margin-bottom: 3px;
            }
            .info-item:last-child {
              margin-bottom: 0;
            }
            .info-label {
              font-size: 7px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
            }
            .info-value {
              font-size: 9px;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.1;
            }
            .instructions-card {
              border: 1px dashed #cbd5e1;
              border-radius: 6px;
              background: #ffffff;
              padding: 6px 8px;
              margin-bottom: 8px;
            }
            .instructions-head {
              font-size: 7.5px;
              font-weight: 800;
              text-transform: uppercase;
              color: #334155;
              margin-bottom: 3px;
            }
            .instructions-list {
              font-size: 7.5px;
              color: #475569;
              line-height: 1.4;
              padding-left: 12px;
            }
            .footer-row {
              border-top: 1px solid #e2e8f0;
              padding-top: 6px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .barcode-col {
              text-align: left;
            }
            .barcode-pattern {
              font-family: monospace;
              letter-spacing: 2px;
              font-size: 11px;
              font-weight: 800;
              color: #334155;
            }
            .ref-label {
              font-family: monospace;
              font-size: 7px;
              color: #64748b;
            }
            .stamp-col {
              width: 100px;
              text-align: center;
            }
            .stamp-line {
              border-top: 1px solid #94a3b8;
              height: 18px;
            }
            .stamp-label {
              font-size: 6.5px;
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
            }
            .disclaimer-note {
              font-size: 6.5px;
              color: #94a3b8;
              text-align: center;
              margin-top: 6px;
              padding-top: 4px;
              border-top: 1px solid #f1f5f9;
            }
          </style>
        </head>
        <body>
          <div class="a6-wrapper">
            <div class="header-banner">
              <div class="logo-row">
                <div class="logo-icon">🫁</div>
                <div>
                  <div class="logo-title">PULMOAI CLINIC</div>
                  <div class="logo-subtitle">Pulmonology & Respiratory Medicine</div>
                </div>
              </div>
              <div class="header-right">
                <span class="badge-pass">A6 Token Pass</span>
                <div class="header-issue">${issueDate}</div>
              </div>
            </div>

            <div class="main-content">
              <div class="token-card">
                <div class="token-caption">Consultation Pass</div>
                <div class="token-big">#${token.token_number}</div>
                <div class="token-date-text">${bookingDateFormatted}</div>
                <div>
                  <span class="token-status-pill">${statusText}</span>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <div class="info-box-title">Doctor Details</div>
                  <div class="info-item">
                    <div class="info-label">Doctor</div>
                    <div class="info-value">Dr. ${token.doctor_name}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Specialist</div>
                    <div class="info-value">${token.doctor_specialization || 'Pulmonary Specialist'}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Clinic</div>
                    <div class="info-value">${token.clinic_name || 'PulmoAI Diagnostic'}</div>
                  </div>
                </div>

                <div class="info-box">
                  <div class="info-box-title">Patient Details</div>
                  <div class="info-item">
                    <div class="info-label">Patient</div>
                    <div class="info-value">${patientDisplayName}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${patientPhone}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Fee</div>
                    <div class="info-value">${token.fee_charged ? `Rs. ${token.fee_charged}` : 'Clinic Rate'}</div>
                  </div>
                </div>
              </div>

              <div class="instructions-card">
                <div class="instructions-head">Visit Instructions:</div>
                <ol class="instructions-list">
                  <li>Arrive at clinic lounge 15 mins before your turn.</li>
                  <li>Present this token pass at the reception desk.</li>
                  <li>Bring previous chest X-rays & prescriptions.</li>
                </ol>
              </div>

              <div class="footer-row">
                <div class="barcode-col">
                  <div class="barcode-pattern">||| | |||| | ||||| |||</div>
                  <div class="ref-label">REF: ${refCode}</div>
                </div>
                <div class="stamp-col">
                  <div class="stamp-line"></div>
                  <div class="stamp-label">Reception Verification</div>
                </div>
              </div>

              <div class="disclaimer-note">
                PulmoAI Health Intelligence System • Official Consultation Pass
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print Token Slip (Small Thermal POS Format - 80mm)
  const handlePrintThermal = (token) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const patientDisplayName = token.patient_name || user?.name || 'Walk-In Patient';
    const bookingDateFormatted = new Date(token.booking_date + 'T12:00:00').toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const currentTime = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const refCode = `REF-${token.id || token.token_number}-${(token.booking_date || '').replace(/-/g, '')}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Token #${token.token_number} - Thermal Slip (80mm)</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 3mm 4mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace, -apple-system, BlinkMacSystemFont, sans-serif;
              color: #000000;
              background: #ffffff;
              width: 72mm;
              margin: 0 auto;
              padding: 6px 0;
              text-align: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .brand-name {
              font-size: 15px;
              font-weight: 900;
              letter-spacing: 1px;
            }
            .sub-title {
              font-size: 9px;
              text-transform: uppercase;
              margin-top: 1px;
            }
            .dashed {
              border-top: 1.5px dashed #000000;
              margin: 6px 0;
            }
            .solid {
              border-top: 1.5px solid #000000;
              margin: 6px 0;
            }
            .doc-name {
              font-size: 13px;
              font-weight: 900;
            }
            .doc-spec {
              font-size: 9.5px;
            }
            .token-label {
              font-size: 11px;
              font-weight: 900;
              letter-spacing: 2px;
              margin-top: 4px;
            }
            .token-number {
              font-size: 48px;
              font-weight: 900;
              line-height: 1;
              margin: 4px 0;
              letter-spacing: -1px;
            }
            .data-table {
              width: 100%;
              text-align: left;
              font-size: 10px;
              margin: 6px 0;
            }
            .data-table td {
              padding: 2px 0;
            }
            .data-table td.right {
              text-align: right;
              font-weight: bold;
            }
            .barcode-line {
              font-size: 15px;
              letter-spacing: 3px;
              font-weight: bold;
              margin: 6px 0 2px 0;
            }
            .note {
              font-size: 8.5px;
              margin-top: 4px;
              line-height: 1.3;
            }
          </style>
        </head>
        <body>
          <div class="brand-name">PULMOAI CLINIC</div>
          <div class="sub-title">CONSULTATION QUEUE PASS</div>
          <div class="dashed"></div>

          <div class="doc-name">Dr. ${token.doctor_name}</div>
          <div class="doc-spec">${token.doctor_specialization || 'Pulmonary Specialist'}</div>
          <div style="font-size: 9px;">${token.clinic_name || 'Consultation Pavilion'}</div>

          <div class="solid"></div>
          <div class="token-label">TOKEN PASS</div>
          <div class="token-number">#${token.token_number}</div>
          <div class="solid"></div>

          <table class="data-table">
            <tr>
              <td>Patient:</td>
              <td class="right">${patientDisplayName}</td>
            </tr>
            <tr>
              <td>Date:</td>
              <td class="right">${bookingDateFormatted}</td>
            </tr>
            <tr>
              <td>Issued:</td>
              <td class="right">${currentTime}</td>
            </tr>
            <tr>
              <td>Fee:</td>
              <td class="right">${token.fee_charged ? `Rs. ${token.fee_charged}` : 'Clinic Rate'}</td>
            </tr>
            <tr>
              <td>Status:</td>
              <td class="right">${token.status === 'completed' ? 'Completed' : token.status === 'serving' ? 'Calling Now' : 'In Queue'}</td>
            </tr>
          </table>

          <div class="dashed"></div>
          <div class="barcode-line">||| | |||| | ||||| |||</div>
          <div style="font-size: 8px;">${refCode}</div>
          <div class="dashed"></div>

          <div class="note">Please arrive 15 mins early. Watch lounge calling display for your turn.</div>
          <div class="note" style="font-weight: bold; margin-top: 5px;">Thank you for your visit!</div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Open Print Selection Modal (A4 vs Small Thermal Slip)
  const handlePrintToken = (token) => {
    setPrintModalToken(token);
  };

  const filteredDoctors = doctors.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (doc.specialization && doc.specialization.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (doc.clinic_name && doc.clinic_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      
      {/* ─────────────────────────────────────────────────────────────
          Doctor pre-selection alert / Patient linking banner
      ───────────────────────────────────────────────────────────── */}
      {patientForBooking && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              <User size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                Direct Appointment Booking
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Reserving Token For: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{patientForBooking.name}</span>
                {patientForBooking.cnic ? ` (CNIC: ${patientForBooking.cnic})` : ''}
              </h3>
            </div>
          </div>

          <button
            onClick={() => navigate('/patients')}
            className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
          >
            Back to Registry
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Page Header
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold mb-2">
            <Ticket size={14} />
            <span>Clinic Queue &amp; Appointment Pass</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Book Clinic Token
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Choose a specialist doctor, pick a consultation date, and reserve your live appointment queue number.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            Live Queue Sync
          </span>
          <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            Instant Token Pass
          </span>
          <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            Doctor Verified
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Main Two-Column Booking Hub (Directory + Queue Control)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column: Doctor Directory (7 Cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-left">
              <div className="size-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Stethoscope size={15} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Select Medical Specialist ({filteredDoctors.length})
              </h3>
            </div>
            
            {/* Live Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Search by doctor or clinic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-xs"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {loadingDoctors ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="size-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Syncing Specialist Directory...</p>
            </div>
          ) : filteredDoctors.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
              {filteredDoctors.map((doc) => {
                const isSelected = selectedDoctor?.id === doc.id;
                
                return (
                  <motion.div
                    key={doc.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDoctor(doc)}
                    className={`p-2.5 sm:p-3.5 rounded-xl border cursor-pointer transition-all text-left flex flex-col justify-between relative overflow-hidden group shadow-xs ${
                      isSelected 
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-md' 
                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                    }`}
                  >
                    {/* Select indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 text-blue-600 dark:text-blue-400">
                        <CheckCircle2 size={16} className="sm:size-[18px]" />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="size-10 sm:size-12 rounded-lg sm:rounded-xl overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shrink-0 border border-blue-500/20 shadow-xs">
                          {doc.profile_pic ? (
                            <img 
                              src={getAssetUrl(doc.profile_pic)} 
                              alt={doc.name} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name)}&background=2563eb&color=fff`;
                              }}
                            />
                          ) : (
                            <span>{doc.name?.[0] || 'D'}</span>
                          )}
                        </div>

                        <div className="min-w-0 pr-4 sm:pr-6">
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Dr. {doc.name.replace(/^Dr\.?\s+/i, '')}
                          </h4>
                          <span className="inline-block text-[10px] sm:text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 truncate max-w-full">
                            {doc.specialization || 'Pulmonologist'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 mt-2.5 pt-2.5 sm:mt-3 sm:pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <Building className="text-slate-400 shrink-0" size={12} />
                          <span className="truncate text-[10px] sm:text-xs">{doc.clinic_name || 'PulmoAI Medical Center'}</span>
                        </div>
                        {doc.address && (
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <MapPin className="text-slate-400 shrink-0" size={12} />
                            <span className="truncate text-[9.5px] sm:text-[11px]">{doc.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <Coins className="text-emerald-500 shrink-0" size={12} />
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-[10.5px] sm:text-xs truncate">
                            {doc.consultation_fee ? `Rs. ${doc.consultation_fee}` : 'Consultation'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 sm:mt-3 sm:pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] sm:text-xs">
                      <span className="font-bold text-slate-400 truncate">
                        {isSelected ? '✓ Selected' : 'Click to select'}
                      </span>
                      <ChevronRight size={13} className={isSelected ? 'text-blue-600 shrink-0' : 'text-slate-300 shrink-0'} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs font-medium">
              No doctors found matching "{searchQuery}".
            </div>
          )}
        </div>

        {/* ── Right Column: Booking Control Center (5 Cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="flex items-center gap-2 text-left">
            <div className="size-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock size={15} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Appointment Slot Selector
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 text-left relative overflow-hidden shadow-xs space-y-4">

            {selectedDoctor ? (() => {
              const fallbackLength = selectedDoctor?.max_tokens ? Number(selectedDoctor.max_tokens) : 20;
              const visibleTokens = queueWindow?.tokens?.length
                ? queueWindow.tokens
                : Array.from({ length: fallbackLength }, (_, index) => index + 1);
              const pendingTokens = queueWindow?.pending_tokens || [];

              return (
                <div className="space-y-3.5">
                  
                  {/* Selected Doctor Summary Card */}
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-2.5 rounded-xl">
                    <div className="size-11 rounded-xl overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {selectedDoctor.profile_pic ? (
                        <img 
                          src={getAssetUrl(selectedDoctor.profile_pic)} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <span>{selectedDoctor.name?.[0] || 'D'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                        Booking Appointment With
                      </span>
                      <p className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                        Dr. {selectedDoctor.name.replace(/^Dr\.?\s+/i, '')}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {selectedDoctor.specialization} • Fee: Rs. {selectedDoctor.consultation_fee || '0'}
                      </p>
                    </div>
                  </div>

                  {/* Date Picker Component */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Choose Consultation Date
                    </label>
                    <div className="flex bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 items-center gap-2.5 shadow-xs focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500 transition-all">
                      <Calendar className="text-slate-400 shrink-0" size={16} />
                      <input 
                        type="date" 
                        className="bg-transparent text-slate-900 dark:text-white text-xs sm:text-sm font-semibold outline-none w-full cursor-pointer"
                        value={bookingDate}
                        min={todayDateString}
                        onChange={(e) => setBookingDate(e.target.value)}
                      />
                    </div>
                    {bookingDate && (
                      <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 pl-1">
                        📅 {new Date(bookingDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {/* Interactive Token Queue */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span>Select Token Number</span>
                        {selectedToken && (
                          <button
                            type="button"
                            onClick={() => setSelectedToken(null)}
                            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X size={11} /> Clear #{selectedToken}
                          </button>
                        )}
                      </div>
                      
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/60">
                        {queueWindow
                          ? `Batch ${queueWindow.active_batch} • ${bookedTokens.length} Booked • ${queueWindow.available_count} Free`
                          : 'Loading slots...'}
                      </span>
                    </div>

                    {loadingTokens ? (
                      <div className="py-8 text-center">
                        <div className="size-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-slate-400 text-xs font-semibold">Updating Queue Slots...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 max-h-56 overflow-y-auto pr-1">
                        {visibleTokens.map((tokenNumber) => {
                          const isBooked = bookedTokens.includes(tokenNumber);
                          const isPending = pendingTokens.includes(tokenNumber);
                          const isUnavailable = isBooked || isPending;
                          const isSelected = selectedToken === tokenNumber;
                          const isNextAvailable = tokenNumber === (queueWindow?.available_tokens?.[0] ?? null);

                          return (
                            <button
                              key={tokenNumber}
                              type="button"
                              disabled={isUnavailable}
                              onClick={() => setSelectedToken(isSelected ? null : tokenNumber)}
                              className={`h-9 rounded-xl text-xs font-bold transition-all border shrink-0 flex flex-col items-center justify-center relative ${
                                isUnavailable
                                  ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 line-through cursor-not-allowed opacity-60'
                                  : isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30 font-extrabold scale-105 z-10'
                                  : isNextAvailable
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 cursor-pointer'
                                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 cursor-pointer'
                              }`}
                            >
                              <span>T-{tokenNumber}</span>
                              {isNextAvailable && !isSelected && (
                                <span className="absolute -top-1.5 -right-1 bg-blue-600 text-white text-[8px] font-bold px-1 rounded-full shadow-xs">
                                  NEXT
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Doctor Only: Patient Name Override for Family/Offline Slots */}
                  {user?.role === 'doctor' && !patientForBooking && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Reserve On Behalf Of (Optional)
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. Walk-in Patient, VIP, Family member..."
                        value={patientNameOverride}
                        onChange={(e) => setPatientNameOverride(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      />
                      <FieldFormatHint type="name" value={patientNameOverride} />
                    </div>
                  )}

                  {/* Action CTA Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!selectedToken || bookingInProgress}
                      onClick={handleBooking}
                      className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                        selectedToken && !bookingInProgress
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-98'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {bookingInProgress ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Confirming Booking...</span>
                        </>
                      ) : (
                        <>
                          <BookmarkCheck size={16} /> 
                          <span>{selectedToken ? `Confirm Token #${selectedToken}` : 'Select Available Token Above'}</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <div className="size-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 border border-blue-200/60 dark:border-blue-900/60">
                  <Stethoscope size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Select a Doctor to Begin</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Choose a specialist physician from the directory on the left to view their appointment calendar and live slot queue.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          Live Selected Doctor Queue Board
      ───────────────────────────────────────────────────────────── */}
      {selectedDoctor && (
        <div className="mt-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs text-left">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Live Clinic Queue Board: Dr. {selectedDoctor.name.replace(/^Dr\.?\s+/i, '')}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {queueViewDate === todayDateString ? "Today's Active Queue" : `Queue for ${queueViewDate}`} • {selectedDoctorQueue.length} Booked Slots
              </p>
            </div>

            {/* Status pills & date picker */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Doctor Date Filter */}
              {user?.role === 'doctor' && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">
                  <Calendar size={13} className="text-slate-400" />
                  <input
                    type="date"
                    value={queueViewDate}
                    onChange={(e) => {
                      setQueueViewDate(e.target.value);
                      fetchSelectedDoctorQueue(e.target.value);
                    }}
                    className="bg-transparent text-slate-900 dark:text-white text-xs outline-none cursor-pointer"
                  />
                  {queueViewDate !== todayDateString && (
                    <button
                      onClick={() => { setQueueViewDate(todayDateString); fetchSelectedDoctorQueue(todayDateString); }}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline border-l border-slate-200 dark:border-slate-700 pl-2"
                    >
                      Today
                    </button>
                  )}
                </div>
              )}

              {/* Now Serving Badge */}
              {(() => {
                const servingToken = selectedDoctorQueue.find(a => a.status === 'serving')?.token_number;
                const highestCompleted = selectedDoctorQueue.filter(a => a.status === 'completed')
                  .reduce((max, curr) => curr.token_number > max ? curr.token_number : max, 0);
                const servingNum = servingToken || highestCompleted || 0;
                
                return (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                    <span>Now Serving: {servingNum > 0 ? `Token #${servingNum}` : 'Waiting to Call'}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {loadingDocQueue ? (
            <div className="py-10 text-center">
              <div className="size-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-400 text-xs font-semibold">Updating Live Queue...</p>
            </div>
          ) : selectedDoctorQueue.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-4 max-h-[340px] overflow-y-auto pr-1">
              {selectedDoctorQueue
                .filter((app) => app.status !== 'completed' && app.status !== 'absent' && app.status !== 'arrived')
                .map((app) => {
                  const isServing = app.status === 'serving';
                  const isUserToken = patientBookings.some(
                    b => b.doctor_id === selectedDoctor.id && 
                         b.token_number === app.token_number && 
                         b.booking_date === queueViewDate
                  );

                  return (
                    <div 
                      key={app.id} 
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isServing 
                          ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20 shadow-md' 
                          : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs shrink-0 text-slate-700 dark:text-slate-200">
                            {app.patient_name?.[0] || 'P'}
                          </div>
                          <div className="min-w-0">
                            <h4
                              className={`font-bold text-xs truncate ${isUserToken ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}
                              title={app.patient_name}
                            >
                              {app.patient_name} {isUserToken && '(Your Token)'}
                            </h4>
                            <span className="text-[10px] text-slate-400">Queue Patient</span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-extrabold shrink-0 ${
                          isServing
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                        }`}>
                          T-{app.token_number}
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] font-semibold flex items-center justify-between gap-1.5">
                        {isServing ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse font-bold truncate">
                            <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="truncate">In Consultation Room</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                            <Clock size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">Pending in Waiting Area</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setPrintModalToken({
                            id: app.id,
                            token_number: app.token_number,
                            booking_date: queueViewDate,
                            doctor_name: selectedDoctor.name,
                            doctor_specialization: selectedDoctor.specialization,
                            clinic_name: selectedDoctor.clinic_name,
                            patient_name: app.patient_name,
                            fee_charged: selectedDoctor.consultation_fee,
                            status: app.status
                          })}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0"
                          title="Print Token Pass (A4 or Small Thermal Printer)"
                        >
                          <Printer size={12} />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-400 text-xs font-medium">
              No patients are currently active in this queue.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Patient Active Bookings & Token Passes
      ───────────────────────────────────────────────────────────── */}
      <div className="mt-8 text-left space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/60 shrink-0">
              <BookmarkCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Your Booked Token Passes ({displayedBookings.length})
                </h3>
                {passDateScope === 'today' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                    Today Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {passDateScope === 'today' 
                  ? `Showing tokens for current date (${new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })})`
                  : 'All clinical passes across all dates and turn tracking'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Scope Toggle: Today vs All Passes */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setPassDateScope('today')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  passDateScope === 'today'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Today ({todayBookingsCount})
              </button>
              <button
                type="button"
                onClick={() => setPassDateScope('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  passDateScope === 'all'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                All Passes ({patientBookings.length})
              </button>
            </div>

            {/* Token Search Bar */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Search token #, doctor..."
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-xs"
              />
              {tokenSearch && (
                <button
                  onClick={() => setTokenSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loadingBookings ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="size-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-xs font-semibold">Loading Token Passes...</p>
          </div>
        ) : displayedBookings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {displayedBookings.map((b) => {
              const hasTurnPassed = b.current_serving >= b.token_number;
              const patientsAhead = Math.max(0, b.token_number - b.current_serving);

              const isServing = b.status?.toLowerCase() === 'serving';
              const isCompleted = b.status?.toLowerCase() === 'completed';
              const isAbsent = b.status?.toLowerCase() === 'absent';
              const isArrived = b.status?.toLowerCase() === 'arrived';
              const isDayEnded = b.booking_date < todayDateString;
              const isLocked = isCompleted || isDayEnded;

              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-3 sm:p-3.5 relative overflow-hidden flex flex-col justify-between shadow-xs transition-all ${
                    isServing 
                      ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-md' 
                      : isCompleted
                      ? 'border-emerald-200 dark:border-emerald-900/60 opacity-80'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Ticket Header: Status and Big Token Pill */}
                    <div className="flex items-start justify-between gap-2.5 mb-2.5">
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold max-w-full truncate ${
                          isCompleted ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                          isServing ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse' :
                          isAbsent ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                          isArrived ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' :
                          'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                          <span className="size-1.5 rounded-full bg-current shrink-0" />
                          <span className="truncate">
                            {isCompleted ? 'Completed' :
                             isServing ? 'Now Calling!' :
                             isAbsent ? 'Absent / Skipped' :
                             isArrived ? 'Checked In' :
                             'In Queue'}
                          </span>
                        </span>

                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm mt-1.5 truncate">
                          Dr. {b.doctor_name}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {b.doctor_specialization} • {b.clinic_name}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Token Badge */}
                        <div className="size-10 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center shadow-xs shrink-0">
                          <span className="text-[8px] font-bold uppercase tracking-wider opacity-80">Token</span>
                          <span className="text-sm font-black leading-none mt-0.5">#{b.token_number}</span>
                        </div>

                        {/* Prominent Header Print Button */}
                        {(!isCompleted || user?.role === 'doctor' || user?.role === 'admin') && (
                          <button
                            type="button"
                            onClick={() => setPrintModalToken(b)}
                            className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Print Token Pass (A4 or Small Thermal Printer)"
                          >
                            <Printer size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Consultation Metadata */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-slate-400 shrink-0" />
                        <span className="font-semibold truncate">
                          {new Date(b.booking_date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {b.patient_name && (
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">Patient: {b.patient_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Turn Progress & Action Buttons */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 min-w-0 truncate">
                      {isCompleted ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate block">✓ Closed</span>
                      ) : isServing ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse truncate block">📢 Your turn!</span>
                      ) : isAbsent ? (
                        <button
                          onClick={() => handleCheckIn(b.id)}
                          className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          Check-in
                        </button>
                      ) : (
                        <span className="truncate block">
                          {patientsAhead > 0 ? `${patientsAhead} ahead` : 'Ready in waiting'}
                        </span>
                      )}
                    </div>

                    {/* Ticket Action Icons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Print Token Pass (A4 / Thermal) */}
                      {(!isCompleted || user?.role === 'doctor' || user?.role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => setPrintModalToken(b)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Print Token Pass (A4 or Small Thermal Printer)"
                        >
                          <Printer size={14} />
                        </button>
                      )}

                      {isLocked ? (
                        <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {isCompleted ? 'Locked (Completed)' : 'Locked (Day Ended)'}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              if (isLocked) return;
                              setEditingApp(b);
                              setEditDate(b.booking_date);
                              setSelectedEditToken(b.token_number);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Reschedule Slot"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => handleCancelBooking(b.id, b.token_number, b.doctor_name, b.status, b.booking_date)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Cancel Token"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="size-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-200/60 dark:border-blue-900/60">
              <Calendar size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {passDateScope === 'today'
                  ? `No tokens booked for today (${new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })})`
                  : 'No token passes found'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {passDateScope === 'today' && patientBookings.length > 0
                  ? `You have ${patientBookings.length} pass(es) booked on other dates. Click below to view all passes.`
                  : tokenSearch
                  ? `No token passes match "${tokenSearch}". Try clearing your search filter.`
                  : 'You do not have any active appointments or tokens booked at the moment.'}
              </p>
            </div>
            {passDateScope === 'today' && patientBookings.length > 0 && (
              <button
                type="button"
                onClick={() => setPassDateScope('all')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 cursor-pointer transition-all"
              >
                <span>View All ({patientBookings.length}) Passes</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Reschedule Slot Modal (z-[200])
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingApp && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setEditingApp(null)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col text-left"
            >

              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                      Reschedule Token Pass
                    </h2>
                    <p className="text-xs text-slate-400">
                      Dr. {editingApp.doctor_name}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setEditingApp(null)}
                  className="size-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                
                {/* Reschedule Date Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Choose New Date
                  </label>
                  <div className="flex bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 items-center gap-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input 
                      type="date" 
                      className="bg-transparent text-slate-900 dark:text-white text-xs sm:text-sm font-semibold outline-none w-full cursor-pointer"
                      value={editDate}
                      min={todayDateString} 
                      onChange={(e) => {
                        setEditDate(e.target.value);
                        setSelectedEditToken(null);
                      }}
                    />
                  </div>
                </div>

                {/* Slots Grid */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Available Slot Tokens</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900">
                      {editQueueWindow
                        ? `${editBookedTokens.length} Booked • ${editQueueWindow.available_count} Free`
                        : 'Loading...'}
                    </span>
                  </div>

                  {loadingEditTokens ? (
                    <div className="py-8 text-center">
                      <div className="size-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-slate-400 text-xs font-semibold">Loading Slots...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {(editQueueWindow?.tokens?.length ? editQueueWindow.tokens : Array.from({ length: 20 }, (_, index) => index + 1)).map((tokenNumber) => {
                        const isBooked = editBookedTokens.includes(tokenNumber);
                        const isPending = (editQueueWindow?.pending_tokens || []).includes(tokenNumber);
                        const isUnavailable = isBooked || isPending;
                        const isSelected = selectedEditToken === tokenNumber;

                        return (
                          <button
                            key={tokenNumber}
                            disabled={isUnavailable}
                            onClick={() => setSelectedEditToken(tokenNumber)}
                            className={`h-9 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center justify-center ${
                              isUnavailable
                                ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 line-through cursor-not-allowed opacity-50'
                                : isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30 font-extrabold scale-105'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                            }`}
                          >
                            <span>T-{tokenNumber}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2.5">
                  <button
                    onClick={() => setEditingApp(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!selectedEditToken || (editingApp.booking_date === editDate && editingApp.token_number === selectedEditToken)}
                    onClick={handleUpdateBooking}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    Save Reschedule
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          Print Token Format Modal (A4 Standard vs Small Thermal POS)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {printModalToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative text-left"
            >
              <button
                type="button"
                onClick={() => setPrintModalToken(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="size-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60 shrink-0">
                  <Printer size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Print Consultation Token #{printModalToken.token_number}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dr. {printModalToken.doctor_name} • {printModalToken.booking_date}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mb-3">
                Choose your printer output layout:
              </p>

              <div className="space-y-3">
                {/* Option 1: A6 Prescription Slip */}
                <button
                  type="button"
                  onClick={() => {
                    const t = printModalToken;
                    setPrintModalToken(null);
                    handlePrintA6(t);
                  }}
                  className="w-full p-3.5 sm:p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-all text-left flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        A6 Medical Slip
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
                        A6 (105×148 mm)
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Standard clinic prescription slip size. Official header, attending specialist, patient info, arrival rules, barcode & stamp.
                    </p>
                  </div>
                </button>

                {/* Option 2: Small Thermal Printer (POS 80mm) */}
                <button
                  type="button"
                  onClick={() => {
                    const t = printModalToken;
                    setPrintModalToken(null);
                    handlePrintThermal(t);
                  }}
                  className="w-full p-3.5 sm:p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all text-left flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                    🧾
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        Small Thermal Slip (80mm)
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        Thermal POS
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Compact queue receipt for thermal slip printers. Large token number, patient name, doctor, clinic, date, time & tear lines.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex justify-end pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPrintModalToken(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default BookAppointment;
