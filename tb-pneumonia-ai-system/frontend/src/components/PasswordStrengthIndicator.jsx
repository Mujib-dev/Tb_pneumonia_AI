import React from 'react';
import { Check } from 'lucide-react';
import { getPasswordCriteria, LIMITS } from '../utils/validation';

export { getPasswordCriteria };

/**
 * PasswordStrengthIndicator
 * 
 * Clean, modern password strength and criteria checklist.
 * Only displays when the user has entered characters, keeping the form UI
 * simple, airy, and uncluttered.
 */
const PasswordStrengthIndicator = ({ 
  password = '', 
  minLength = LIMITS.PASSWORD_MIN, 
  maxLength = LIMITS.PASSWORD_MAX,
  showRequirements = true,
  alwaysShow = false
}) => {
  if (!password && !alwaysShow) return null;

  const criteria = getPasswordCriteria(password, minLength, maxLength);

  const getBarColor = (index) => {
    if (!password) return 'bg-slate-200 dark:bg-slate-700';
    if (criteria.score >= (index + 1) * 25) {
      if (criteria.strength === 'weak') return 'bg-rose-500';
      if (criteria.strength === 'fair') return 'bg-amber-500';
      if (criteria.strength === 'good') return 'bg-blue-500';
      if (criteria.strength === 'strong') return 'bg-emerald-500';
    }
    return 'bg-slate-200 dark:bg-slate-700';
  };

  const getBadgeStyle = () => {
    switch (criteria.strength) {
      case 'weak':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
      case 'fair':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      case 'good':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
      case 'strong':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <div className="mt-2 space-y-2 text-left transition-all">
      {/* Strength Bar & Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex gap-1.5 h-1.5">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-full flex-1 rounded-full transition-all duration-300 ${getBarColor(idx)}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBadgeStyle()}`}>
            {password ? criteria.label : `Min ${minLength} chars`}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {password.length}/{maxLength}
          </span>
        </div>
      </div>

      {/* Requirement Checklist */}
      {showRequirements && (
        <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            {criteria.hasMin && criteria.hasMax ? (
              <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            )}
            <span className={criteria.hasMin && criteria.hasMax ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
              {minLength}-{maxLength} characters
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {criteria.hasLower && criteria.hasUpper ? (
              <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            )}
            <span className={criteria.hasLower && criteria.hasUpper ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
              Upper &amp; lowercase
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {criteria.hasNumber ? (
              <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            )}
            <span className={criteria.hasNumber ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
              At least one number (0-9)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {criteria.hasSpecial ? (
              <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <span className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            )}
            <span className={criteria.hasSpecial ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
              Special symbol (!@#$%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
