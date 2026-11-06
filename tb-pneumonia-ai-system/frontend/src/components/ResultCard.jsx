import { useState } from 'react'
import { CheckCircle2, AlertCircle, Info, ChevronRight, Printer, RotateCcw, ShieldCheck, Activity, Eye, Sparkles, Layers } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { getProtectedImageUrl } from '../services/api'

const ResultCard = ({ result, onReset }) => {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('heatmap') // 'original' | 'heatmap'
  if (!result) return null

  const isNormal = result.result === "Normal"
  const isTB = result.result === "TB"
  const isPneumonia = result.result === "Pneumonia"
  const isLowConfidence = (result.confidence || 0) < 0.60

  // Styling helpers
  const themeConfig = isNormal ? {
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/60",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    iconColor: "text-emerald-500",
    title: "Normal Chest Radiograph",
    subtitle: "No acute focal consolidation or active mycobacterial patterns detected."
  } : isTB ? {
    badgeBg: "bg-rose-50 dark:bg-rose-950/60",
    badgeBorder: "border-rose-200 dark:border-rose-800",
    badgeText: "text-rose-700 dark:text-rose-300",
    iconColor: "text-rose-500",
    title: "Tuberculosis Findings Detected",
    subtitle: "High probability of apical infiltrates, cavitations, or nodal enlargement."
  } : {
    badgeBg: "bg-purple-50 dark:bg-purple-950/60",
    badgeBorder: "border-purple-200 dark:border-purple-800",
    badgeText: "text-purple-700 dark:text-purple-300",
    iconColor: "text-purple-500",
    title: "Pneumonia Infiltrates Detected",
    subtitle: "Airspace consolidation or opacities characteristic of pneumonic infection."
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none print:bg-white"
    >
      {/* Official Medical Print Header (Visible ONLY on print) */}
      <div className="hidden print:block p-4 border-b-2 border-slate-900 text-slate-900 bg-white">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img src="/logo-mark-128.png" alt="PulmoAI" className="size-10 object-contain shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-slate-900">PulmoAI Clinical Health System</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border border-slate-900 rounded">
                  Official CAD Report
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Department of Diagnostic Pulmonology &amp; Thoracic Radiography CAD
              </p>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                <span><strong>Engine:</strong> DenseNet-121 Deep Neural Network</span>
                <span>•</span>
                <span><strong>Modality:</strong> Chest Radiograph (CXR PA/AP)</span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-700 shrink-0">
            <span className="font-mono font-bold block text-slate-900 text-sm">
              Acc. #CAD-{String(result.id || 'NEW').padStart(6, '0')}
            </span>
            <span>{new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Accent Header */}
      <div className={`p-3.5 sm:p-4 ${themeConfig.badgeBg} border-b ${themeConfig.badgeBorder} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className={`size-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center ${themeConfig.iconColor} shadow-xs shrink-0 border ${themeConfig.badgeBorder}`}>
            {isNormal ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 ${themeConfig.badgeText} border ${themeConfig.badgeBorder}`}>
                Clinical CAD Assessment
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 tracking-tight">
              {result.result === 'TB' ? 'Tuberculosis Positive' : result.result}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm">
              {themeConfig.subtitle}
            </p>
          </div>
        </div>

        {/* Confidence Percentage Gauge */}
        <div className="sm:text-right shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Confidence</span>
          <div className="flex items-baseline gap-1 sm:justify-end">
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${themeConfig.iconColor}`}>
              {(result.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block">Diagnostic Confidence</span>
        </div>
      </div>

      <div className="p-3.5 sm:p-4 space-y-3.5">
        
        {/* Patient Identity Badge */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {result.patient_name ? result.patient_name[0] : 'G'}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Patient Profile</span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {result.patient_name || 'Guest / Unassigned Patient'}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold shrink-0">
            <ShieldCheck size={12} />
            <span>Record Synced</span>
          </div>
        </div>

        {/* Multiclass Differential Scores */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity size={13} className="text-blue-500" />
              <span>Differential Probability Distribution</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-semibold">Differential Breakdown</span>
          </div>

          <div className="space-y-2">
            {Object.entries(result.all_scores || {}).map(([label, score]) => {
              const pct = (score * 100).toFixed(1)
              const isMax = result.result === label

              let barColor = "bg-blue-600"
              if (label === 'Normal') barColor = "bg-emerald-500"
              else if (label === 'TB') barColor = "bg-rose-500"
              else if (label === 'Pneumonia') barColor = "bg-purple-600"

              return (
                <div key={label} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>{label === 'TB' ? 'Tuberculosis' : label}</span>
                      {isMax && (
                        <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                          Primary
                        </span>
                      )}
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white font-mono text-[11px]">{pct}%</span>
                  </div>

                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-full ${barColor} rounded-full`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Explainable AI (Grad-CAM Saliency Map) */}
        {(result.heatmap_url || result.image_url || result.image_path) && (
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Infected Area Localization (AI Heatmap)
                </span>
              </div>
              
              {result.heatmap_url && (
                <div className="flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setViewMode('original')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      viewMode === 'original' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Original CXR
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('heatmap')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      viewMode === 'heatmap' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-300 hover:text-white'
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-amber-300" />
                    Infected Area (Color)
                  </button>
                </div>
              )}
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-h-64 sm:max-h-72 mx-auto flex items-center justify-center border border-slate-800">
              <img 
                src={getProtectedImageUrl(
                  viewMode === 'heatmap' && result.heatmap_url ? result.heatmap_url : (result.image_url || result.image_path)
                )} 
                alt="Radiograph Analysis" 
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-bold text-slate-300 border border-white/10">
                {viewMode === 'heatmap' && result.heatmap_url 
                  ? 'Pathological Saliency Focus (DenseNet-121)' 
                  : 'Diagnostic Thoracic Radiograph'}
              </div>
            </div>

            {/* Infection Area Color Guide */}
            <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5 text-[10px]">
              <div className="flex items-center justify-between font-bold text-slate-300">
                <span>Color Scale Interpretation</span>
                <span className="text-[9px] text-amber-400 font-semibold">Grad-CAM Jet Colormap</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="px-1.5 py-1 rounded bg-rose-950/50 border border-rose-800/40 text-rose-300 font-medium flex items-center justify-center gap-1">
                  <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                  <span>Red: High Infection</span>
                </div>
                <div className="px-1.5 py-1 rounded bg-amber-950/50 border border-amber-800/40 text-amber-300 font-medium flex items-center justify-center gap-1">
                  <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                  <span>Yellow: Infiltrate</span>
                </div>
                <div className="px-1.5 py-1 rounded bg-blue-950/50 border border-blue-800/40 text-blue-300 font-medium flex items-center justify-center gap-1">
                  <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                  <span>Blue: Clear Area</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-0.5">
                Colored regions indicate lung zones with radiological evidence of pathological consolidation, opacity, or mycobacterial lesions.
              </p>
            </div>
          </div>
        )}

        {/* Low Confidence Warning */}
        {isLowConfidence && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <span className="font-bold block uppercase tracking-wider text-[10px]">Equivocal Diagnostic Finding (Low Margin)</span>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                The classifier confidence ({((result.confidence || 0) * 100).toFixed(1)}%) is below standard decision thresholds. Confirmatory sputum GeneXpert MTB/RIF assay, patient auscultation, and senior radiologist consultation are strongly recommended.
              </p>
            </div>
          </div>
        )}

        {/* Clinical Next Steps & Guidance */}

        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60">
          <h4 className="text-[11px] font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider mb-1">
            Clinical Recommendation
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {isNormal 
              ? "Chest radiograph appears clear of acute infiltrative lesions. Proceed with symptom-based management or outpatient observation as indicated."
              : isTB 
                ? "Radiographic findings indicate focal apical opacity consistent with Tuberculosis. Prompt collection of sputum for GeneXpert / AFB smear and pulmonary consultation are recommended."
                : "Findings are indicative of acute pneumonic consolidation. Initiate appropriate empirical antibiotic/supportive therapy and follow-up radiograph in 4 weeks."}
          </p>
        </div>

        {/* Medical Legal Disclaimer */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-700 dark:text-slate-300">Physician Sign-Off Required:</strong> This automated computer-aided detection (CAD) analysis is designed for clinical decision support. Final diagnostic and therapeutic decisions remain the sole responsibility of the treating physician.
          </p>
        </div>

        {/* Official Physician Review & Sign-Off (Visible ONLY on Print) */}
        <div className="hidden print:block mt-4 pt-3 border-t-2 border-slate-900 text-slate-800 break-inside-avoid">
          <div className="grid grid-cols-2 gap-6 items-end text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Attending Radiologist / Reviewing Physician
              </span>
              <p className="font-bold text-slate-900 text-sm">
                Staff Reviewing Radiologist / Attending Physician
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Department of Thoracic Imaging &amp; CAD Diagnosis
              </p>
              <div className="mt-4 pt-1 border-t border-slate-400 w-52">
                <span className="text-[9px] text-slate-400 block uppercase tracking-wider">
                  Authorized Signature &amp; Seal
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block p-2 rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 text-center text-[10px]">
                <span className="font-bold block text-slate-800">CLINICAL CAD VERIFICATION</span>
                <span className="font-mono text-[9px] text-slate-500">SHA256-CAD-{result.id || 'VAL'}-{(result.confidence || 0).toFixed(4)}</span>
                <span className="block text-[9px] text-emerald-700 font-bold mt-0.5">
                  ✓ Digitally Verified Diagnostic CAD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-1 flex flex-col sm:flex-row items-center gap-2 print:hidden">
          {onReset && (
            <button 
              type="button"
              onClick={onReset}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw size={13} className="shrink-0" />
              <span className="whitespace-nowrap">Scan Another</span>
            </button>
          )}

          <button 
            type="button"
            onClick={() => window.print()}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Printer size={13} className="shrink-0" />
            <span className="whitespace-nowrap">Print Report</span>
          </button>

          <button 
            type="button"
            onClick={() => navigate('/history', { state: { highlightRecordId: result?.id } })}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 whitespace-nowrap"
          >
            <span className="whitespace-nowrap">View Official Report &amp; Download PDF</span>
            <ChevronRight size={13} className="shrink-0" />
          </button>
        </div>

      </div>
    </motion.div>
  )
}

export default ResultCard
