import { useState, useRef } from 'react'
import { Upload, X, FileImage, Camera, CheckCircle2, RefreshCw, ShieldCheck, FileType2 } from 'lucide-react'
import { getProtectedImageUrl } from '../services/api'

// Browsers report no MIME type for DICOM studies, so they are matched by
// extension rather than by file.type.
const DICOM_PATTERN = /\.(dcm|dicom|di|dic|ima)$/i
const ACCEPTED_TYPES = 'image/png,image/jpeg,.dcm,.dicom,.di,.dic,.ima'

const isDicomFile = (file) => DICOM_PATTERN.test(file?.name || '')

const UploadBox = ({ onUpload, file: currentFile, result }) => {
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState(null)
  const [fileDetails, setFileDetails] = useState(null)
  const [isDicom, setIsDicom] = useState(false)
  const [viewMode, setViewMode] = useState('heatmap') // 'heatmap' | 'original'
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFile = (file) => {
    if (!file) return
    const dicom = isDicomFile(file)
    if (!dicom && !file.type.startsWith('image/')) return

    setFileDetails({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: dicom ? 'DICOM' : file.type
    })

    if (dicom) {
      // A DICOM study is decoded server-side, so there is no raster to preview here.
      setIsDicom(true)
      setPreview(null)
    } else {
      setIsDicom(false)
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result)
      reader.readAsDataURL(file)
    }

    onUpload(file)
  }

  const clearFile = (e) => {
    if (e) e.stopPropagation()
    setPreview(null)
    setFileDetails(null)
    setIsDicom(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    onUpload(null)
  }

  const heatmapUrl = result?.heatmap_url ? getProtectedImageUrl(result.heatmap_url) : null
  const showingHeatmap = viewMode === 'heatmap' && heatmapUrl
  const displayImage = showingHeatmap ? heatmapUrl : preview

  // A DICOM study has no browser-renderable raster, so the source view falls
  // back to a placeholder instead of a broken <img> pointing at raw DICOM bytes.
  const showDicomPlaceholder = isDicom && !showingHeatmap

  return (
    <div className="w-full">
      {preview || isDicom ? (
        /* Image Preview State */
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900/90 group shadow-md">
          {/* Medical Lightbox Image Container */}
          <div className="h-64 sm:h-72 w-full flex items-center justify-center p-3 bg-black/50 relative">
            {showDicomPlaceholder ? (
              <div className="flex flex-col items-center justify-center text-center px-4">
                <FileType2 size={44} className="text-blue-300/80 mb-2.5" />
                <span className="text-xs font-bold text-white">DICOM Radiograph Loaded</span>
                <span className="text-[10px] text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                  DICOM pixel data is decoded and windowed on the server, then analysed with the
                  same 224&times;224 pipeline used for PNG and JPEG.
                </span>
              </div>
            ) : (
              <img 
                src={displayImage} 
                alt={showingHeatmap ? "Infected Area Color Heatmap" : "CXR Radiograph Preview"} 
                className="max-h-full max-w-full object-contain rounded-xl shadow-lg transition-all duration-300" 
              />
            )}

            {/* Heatmap Legend Badge if showing colored infected areas */}
            {showingHeatmap && (
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] text-white">
                <span className="font-bold flex items-center gap-1.5 text-amber-300">
                  <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                  Infected Area (Color Heatmap)
                </span>
                <div className="flex items-center gap-2 text-[9px] text-slate-300">
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-rose-500" /> High</span>
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-400" /> Mod</span>
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-blue-500" /> Clear</span>
                </div>
              </div>
            )}
          </div>

          {/* Top Overlay Badge & Toggle & Remove Button */}
          <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2">
            {heatmapUrl ? (
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/15 text-[11px] font-bold shadow-md">
                <button
                  type="button"
                  onClick={() => setViewMode('original')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'original'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Raw CXR
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('heatmap')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    viewMode === 'heatmap'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-300 hover:text-white'
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-amber-300" />
                  Infected Area (Color)
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/10 text-white text-xs font-bold shadow-md">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Radiograph Loaded</span>
              </div>
            )}

            <button 
              type="button"
              onClick={clearFile}
              className="size-8 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white backdrop-blur-md flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer shrink-0"
              title="Remove this image"
            >
              <X size={16} />
            </button>
          </div>

          {/* Bottom Info Bar */}
          <div className="p-3 bg-slate-900 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <div className="truncate max-w-[200px] sm:max-w-xs font-medium">
              <span className="text-white font-bold block truncate">{fileDetails?.name}</span>
              <span className="text-[11px] text-slate-400">{fileDetails?.size}</span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Change Image</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty Dropzone State */
        <div 
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center p-6 sm:p-8 cursor-pointer ${
            dragActive 
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]' 
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-500/80 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50/20 dark:hover:bg-slate-800/70'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {/* Center Upload Icon */}
          <div className="size-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/60 mb-3 group-hover:scale-105 transition-transform shadow-xs">
            <Upload size={24} />
          </div>

          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white text-center">
            Upload Chest Radiograph (CXR)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 mb-4 max-w-xs">
            Drag & drop an AP or PA radiograph, or browse your files.
          </p>

          {/* Action Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <FileImage size={13} />
              <span>Browse File</span>
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Camera size={13} />
              <span>Camera</span>
            </button>
          </div>

          <span className="text-[10px] text-slate-400 mt-3 font-medium">
            Supported: PNG, JPG, JPEG, DICOM (.dcm) (Max 15MB)
          </span>
        </div>
      )}

      {/* CXR Verification Notice */}
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 rounded-xl px-3 py-1.5 text-center">
        <ShieldCheck size={14} className="shrink-0" />
        <span>Chest X-rays (CXR) only. Selfies, face photos, and non-radiographic pictures are rejected.</span>
      </div>

      {/* Hidden native inputs */}
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef}
        onChange={(e) => handleFile(e.target.files[0])}
        accept={ACCEPTED_TYPES}
      />
      <input 
        type="file" 
        className="hidden" 
        ref={cameraInputRef}
        onChange={(e) => handleFile(e.target.files[0])}
        accept="image/*"
        capture="environment"
      />
    </div>
  )
}

export default UploadBox
