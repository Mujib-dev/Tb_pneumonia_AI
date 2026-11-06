import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { REGEX_PATTERNS } from '../utils/validation';

/**
 * FieldFormatHint
 * 
 * Simple, modern, and human-friendly format guidance.
 * Converts complex regex syntax into simple terms (e.g. "03 + 9 digits", "13 digits", "Letters only").
 * Displays a clean, single-line micro-meta row with live validation status.
 * 
 * Props:
 *  - type: 'phone' | 'cnic' | 'name' | 'email' | 'phoneLoose' | 'accessCode' | 'password' | 'patientPassword' | 'url' | 'identifier'
 *  - patternStr: custom regex string override (e.g. '^03\\d{9}$')
 *  - format: custom format hint string override (e.g. '03001234567')
 *  - simplePattern: simple human term override (e.g. '03 + 9 digits')
 *  - example: custom example override
 *  - description: custom description
 *  - custom: custom object containing { label, hint, example, patternStr, simplePattern }
 *  - value: current field value for live matching indicator
 *  - error: field error message (if any)
 *  - showPattern: whether to display the pattern pill (default true)
 *  - className: extra wrapper classes
 */
const FieldFormatHint = ({
  type,
  patternStr: propPatternStr,
  simplePattern: propSimplePattern,
  format: propFormat,
  example: propExample,
  description: propDescription,
  custom,
  value,
  error,
  showPattern = true,
  className = ''
}) => {
  const config = (type && REGEX_PATTERNS[type]) ? REGEX_PATTERNS[type] : custom || null;

  const patternStr = propPatternStr || config?.patternStr || '';
  const format = propFormat || config?.format || config?.hint || '';
  const example = propExample || config?.example || '';
  const description = propDescription || config?.description || '';

  // Simple human-friendly term for the pattern
  let simpleTerm = propSimplePattern || config?.simplePattern || '';
  if (!simpleTerm) {
    if (type === 'phone') simpleTerm = '03 + 9 digits';
    else if (type === 'cnic') simpleTerm = '13 digits';
    else if (type === 'name') simpleTerm = 'Letters & spaces';
    else if (type === 'email') simpleTerm = 'name@domain.com';
    else if (type === 'password') simpleTerm = '8+ mixed chars';
    else if (type === 'patientPassword') simpleTerm = '6+ characters';
    else if (type === 'accessCode') simpleTerm = 'Letters & numbers';
    else if (type === 'url') simpleTerm = 'https://...';
    else if (type === 'phoneLoose') simpleTerm = '10–15 digits';
    else if (type === 'identifier') simpleTerm = 'Phone or CNIC';
    else if (custom?.label?.toLowerCase().includes('age')) simpleTerm = '1 to 120 years';
    else simpleTerm = format || 'Standard format';
  }

  // Concise guidance label: pick the most helpful readable text
  let hintLabel = format;
  if (!hintLabel && description) hintLabel = description;
  if (!hintLabel && example) hintLabel = `e.g. ${example}`;

  // Clean, standard default hints
  if (type === 'name' && !propFormat) {
    hintLabel = 'Letters, spaces and dots (3–50 chars)';
  } else if (type === 'phone' && !propFormat) {
    hintLabel = '11 digits starting with 03';
  } else if (type === 'cnic' && !propFormat) {
    hintLabel = '13 digits without dashes';
  } else if (type === 'password' && !propFormat) {
    hintLabel = 'Min 8 chars: upper, lower, number & symbol';
  }

  // Determine live matching state if value is provided
  let matchStatus = 'empty'; // 'empty' | 'valid' | 'invalid'
  const strVal = value !== undefined && value !== null ? String(value) : '';

  if (strVal.length > 0) {
    if (config?.validate) {
      matchStatus = config.validate(strVal) ? 'valid' : 'invalid';
    } else if (config?.regex) {
      matchStatus = config.regex.test(strVal) ? 'valid' : 'invalid';
    } else if (patternStr) {
      try {
        const rx = new RegExp(patternStr);
        matchStatus = rx.test(strVal) ? 'valid' : 'invalid';
      } catch {
        matchStatus = 'empty';
      }
    }
  }

  // If there's an error passed to FieldFormatHint, display it cleanly
  if (error) {
    return (
      <div className={`flex items-center gap-1.5 text-rose-500 dark:text-rose-400 text-[11px] font-medium mt-1 select-text ${className}`}>
        <AlertCircle size={12} className="shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-2 text-[11px] mt-1 px-0.5 select-text transition-all ${className}`}>
      {/* Human format guidance on the left */}
      <span className={`truncate text-slate-400 dark:text-slate-500 font-normal ${matchStatus === 'valid' ? 'text-slate-500 dark:text-slate-400' : ''
        }`}>
        {hintLabel}
      </span>

      {/* Simple term badge on the right */}
      {showPattern && simpleTerm && (
        <span
          className={`shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all ${matchStatus === 'valid'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/60'
              : matchStatus === 'invalid' && strVal
                ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-medium'
                : 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 font-medium'
            }`}
          title={patternStr ? `Validation Pattern: /${patternStr}/` : simpleTerm}
        >
          {matchStatus === 'valid' ? (
            <>
              <Check size={11} className="stroke-[3]" />
              <span>Valid</span>
            </>
          ) : (
            <>
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">Pattern:</span>
              <span className="font-semibold">{simpleTerm}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
};

export default FieldFormatHint;
