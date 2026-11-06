/**
 * Shared validation rules, regex patterns and field validators.
 *
 * Every form in the app must source its patterns from here so the frontend
 * stays consistent with itself and with the FastAPI backend
 * (backend/app/api/routes.py -> /auth/register).
 *
 * Every `validate*` helper follows the same contract:
 *   returns ''  -> valid
 *   returns text -> human readable error for the field
 */

/* ------------------------------------------------------------------ *
 * Regex patterns
 * ------------------------------------------------------------------ */

/** Pakistani mobile number: 11 digits, `03` prefix, e.g. 03001234567 */
export const PHONE_REGEX = /^03\d{9}$/;

/** National CNIC / B-Form: exactly 13 digits, e.g. 3520212345678 */
export const CNIC_REGEX = /^\d{13}$/;

/** Phone as accepted by the public contact form / admin settings: 10-15 digits, optional `+` */
export const PHONE_LOOSE_REGEX = /^\+?\d{10,15}$/;

/** Email address, e.g. name@domain.com */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Person name: letters, spaces and the punctuation . ' - */
export const NAME_REGEX = /^[a-zA-Z\s.'-]+$/;

/** Absolute http(s) URL, used for the social links in the admin content form */
export const URL_REGEX = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/;

/** Password complexity components, kept in sync with getPasswordCriteria below */
export const PASSWORD_LOWER_REGEX = /[a-z]/;
export const PASSWORD_UPPER_REGEX = /[A-Z]/;
export const PASSWORD_DIGIT_REGEX = /[0-9]/;
export const PASSWORD_SYMBOL_REGEX = /[^A-Za-z0-9]/;

/** Strips every character that is not 0-9 */
export const NON_DIGIT_REGEX = /\D/g;

/** Strips every character that is not 0-9 or `+` (phone sanitiser) */
export const NON_PHONE_CHAR_REGEX = /[^0-9+]/g;

/** Medical authorization access code: alphanumeric, hyphens and underscores (4-64 chars) */
export const ACCESS_CODE_REGEX = /^[A-Za-z0-9_-]{4,64}$/;

/** Leading "Dr" honourific, e.g. `Dr. Sarah` -> `Sarah` */
export const DOCTOR_PREFIX_REGEX = /^Dr\.?\s*/i;

/** Backend wording for an identity that is already on file */
export const ALREADY_REGISTERED_REGEX = /already\s+(exists|registered|exist)/i;

/* ------------------------------------------------------------------ *
 * Limits
 * ------------------------------------------------------------------ */

export const LIMITS = {
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 64,
  PATIENT_PASSWORD_MIN: 6,
  PATIENT_PASSWORD_MAX: 64,

  NAME_MIN: 3,
  NAME_MAX: 50,

  PHONE_DIGITS: 11,
  PHONE_DIGITS_MIN: 10,
  PHONE_DIGITS_MAX: 15,

  CNIC_DIGITS: 13,

  AGE_MIN: 1,
  AGE_MAX: 120,

  SUBJECT_MIN: 3,
  MESSAGE_MIN: 10,
  ABOUT_MAX: 2000,
  ADDRESS_MAX: 500,
  ACCESS_CODE_MIN: 4,
  ACCESS_CODE_MAX: 64,
  SPECIALIZATION_MAX: 150,
  CLINIC_NAME_MAX: 150,

  LOGIN_PASSWORD_MIN: 4,

  TOKEN_CAPACITY_MIN: 1,
  TOKEN_CAPACITY_MAX: 999,
  CONSULTATION_FEE_MAX: 100000,

  PROFILE_PIC_MAX_BYTES: 5 * 1024 * 1024,
  RADIOGRAPH_MAX_BYTES: 15 * 1024 * 1024
};

export const PROFILE_PIC_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
export const RADIOGRAPH_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

/* ------------------------------------------------------------------ *
 * Sanitisers
 * ------------------------------------------------------------------ */

export const onlyDigits = (value = '') => String(value).replace(NON_DIGIT_REGEX, '');

/** Strips separators, then hard-caps the digit run (e.g. CNIC 12345-1234567-1 -> 1234512345671). */
export const digitsOnly = (value = '', maxDigits) => {
  const digits = onlyDigits(value);
  return maxDigits ? digits.slice(0, maxDigits) : digits;
};

/** Strips everything but 0-9 and a leading `+`. */
export const sanitizePhone = (value = '') => String(value).replace(NON_PHONE_CHAR_REGEX, '');

/** Converts a raw 13-digit CNIC into the official 12345-1234567-1 display form. */
export const formatCnic = (raw = '') => {
  const digits = onlyDigits(raw);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
};

/** Drops an honourific so names can be compared/displayed consistently. */
export const stripDoctorPrefix = (value = '') => String(value).replace(DOCTOR_PREFIX_REGEX, '');

/* ------------------------------------------------------------------ *
 * Password strength (moved here so validation stays framework free)
 * ------------------------------------------------------------------ */

export const getPasswordCriteria = (password = '', minLength = LIMITS.PASSWORD_MIN, maxLength = LIMITS.PASSWORD_MAX) => {
  const hasMin = password.length >= minLength;
  const hasMax = password.length <= maxLength;
  const hasLower = PASSWORD_LOWER_REGEX.test(password);
  const hasUpper = PASSWORD_UPPER_REGEX.test(password);
  const hasNumber = PASSWORD_DIGIT_REGEX.test(password);
  const hasSpecial = PASSWORD_SYMBOL_REGEX.test(password);

  let passedCount = 0;
  if (hasMin && hasMax) passedCount += 1;
  if (hasLower && hasUpper) passedCount += 1;
  if (hasNumber) passedCount += 1;
  if (hasSpecial) passedCount += 1;

  let strength = 'empty';
  let label = 'Enter password';
  let color = 'slate';
  let score = 0;

  if (password.length > 0) {
    if (passedCount <= 1 || password.length < minLength) { strength = 'weak';   label = 'Weak';   color = 'rose';    score = 25;  }
    else if (passedCount === 2)                        { strength = 'fair';   label = 'Fair';   color = 'amber';   score = 50;  }
    else if (passedCount === 3)                        { strength = 'good';   label = 'Good';   color = 'blue';    score = 75;  }
    else                                                { strength = 'strong'; label = 'Strong'; color = 'emerald'; score = 100; }
  }

  return {
    hasMin, hasMax, hasLower, hasUpper, hasNumber, hasSpecial,
    passedCount, score, strength, label, color,
    isValid: hasMin && hasMax && (passedCount >= 2)
  };
};

/* ------------------------------------------------------------------ *
 * Regex metadata & UI descriptors (for UI badges, hints & regex displays)
 * ------------------------------------------------------------------ */

export const REGEX_PATTERNS = {
  phone: {
    regex: PHONE_REGEX,
    patternStr: '^03\\d{9}$',
    simplePattern: '03 + 9 digits',
    label: 'Mobile Phone',
    format: '11 digits starting with 03',
    example: '03001234567',
    description: "11-digit mobile starting with 03",
    validate: (val) => PHONE_REGEX.test((val || '').replace(/\D/g, ''))
  },
  cnic: {
    regex: CNIC_REGEX,
    patternStr: '^\\d{13}$',
    simplePattern: '13 digits',
    label: 'National CNIC',
    format: '13 digits without dashes',
    example: '1234512345671',
    description: '13 numeric digits without dashes',
    validate: (val) => CNIC_REGEX.test((val || '').replace(/\D/g, ''))
  },
  name: {
    regex: NAME_REGEX,
    patternStr: "^[a-zA-Z\\s.'-]+$",
    simplePattern: 'Letters & spaces only',
    label: 'Full Legal Name',
    format: 'Letters and spaces (3–50 chars)',
    example: 'Dr. Sarah Jenkins',
    description: 'Letters, spaces, and dots',
    validate: (val) => {
      const trimmed = (val || '').trim();
      return trimmed.length >= LIMITS.NAME_MIN && trimmed.length <= LIMITS.NAME_MAX && NAME_REGEX.test(trimmed);
    }
  },
  email: {
    regex: EMAIL_REGEX,
    patternStr: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$',
    simplePattern: 'name@domain.com',
    label: 'Email Address',
    format: 'username@domain.com',
    example: 'doctor@hospital.org',
    description: 'Valid email with recipient, @, and domain name',
    validate: (val) => EMAIL_REGEX.test((val || '').trim())
  },
  phoneLoose: {
    regex: PHONE_LOOSE_REGEX,
    patternStr: '^\\+?\\d{10,15}$',
    simplePattern: '10–15 digits',
    label: 'Contact / WhatsApp Phone',
    format: '10 to 15 digits',
    example: '+92 300 1234567',
    description: '10 to 15 digits, optional leading +',
    validate: (val) => {
      const clean = (val || '').replace(/[^\d+]/g, '');
      return clean.length >= 10 && clean.length <= 15;
    }
  },
  accessCode: {
    regex: ACCESS_CODE_REGEX,
    patternStr: '^[A-Za-z0-9_-]{4,64}$',
    simplePattern: 'Letters & numbers',
    label: 'Medical Auth Code',
    format: '4–64 characters',
    example: 'DOC-7860',
    description: '4–64 characters issued by hospital administration',
    validate: (val) => ACCESS_CODE_REGEX.test((val || '').trim())
  },
  password: {
    regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/,
    patternStr: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,64}$',
    simplePattern: '8+ mixed chars',
    label: 'Account Password',
    format: 'Min 8 chars: uppercase, lowercase, number & symbol',
    example: 'Medic@2024',
    description: '8–64 characters combining upper, lower, numbers and symbols',
    validate: (val) => Boolean(val) && getPasswordCriteria(val).isValid
  },
  patientPassword: {
    regex: /^.{6,64}$/,
    patternStr: '^.{6,64}$',
    simplePattern: '6+ characters',
    label: 'Portal Password',
    format: 'At least 6 characters (defaults to CNIC)',
    example: 'Patient@123',
    description: '6–64 characters for patient portal sign-in',
    validate: (val) => !val || val.length >= 6
  },
  url: {
    regex: URL_REGEX,
    patternStr: '^https?:\\/\\/[^\\s.]+\\.[^\\s]{2,}$',
    simplePattern: 'https://...',
    label: 'Website / Social URL',
    format: 'https://domain.com/...',
    example: 'https://linkedin.com/in/doctor',
    description: 'Full address starting with http:// or https://',
    validate: (val) => !val || URL_REGEX.test((val || '').trim())
  },
  identifier: {
    regex: /^(03\d{9}|\d{13})$/,
    patternStr: '^(03\\d{9}|\\d{13})$',
    simplePattern: 'Phone or CNIC',
    label: 'Phone or CNIC',
    format: '11-digit mobile OR 13-digit CNIC',
    example: '03001234567 or 1234512345671',
    description: "11-digit mobile starting with '03' OR 13-digit national CNIC",
    validate: (val) => {
      const clean = (val || '').replace(/\D/g, '');
      return clean.length === 13 || (clean.length === 11 && clean.startsWith('03'));
    }
  }
};

export const getRegexPattern = (type) => REGEX_PATTERNS[type] || null;

/* ------------------------------------------------------------------ *
 * Field validators
 * ------------------------------------------------------------------ */

/** Free-text field with a character budget, e.g. subject, address, message. */
export const validateText = (value, { label, min = 1, max, pattern, required = true } = {}) => {
  const val = (value || '').trim();
  if (!val) return required ? `${label} is required.` : '';
  if (min > 0 && val.length < min) return `${label} must be at least ${min} characters long.`;
  if (max && val.length > max) return `${label} cannot exceed ${max} characters.`;
  if (pattern && !pattern.test(val)) return `${label} contains invalid characters.`;
  return '';
};

/** Personal / clinical full name. */
export const validateName = (value, { label = 'Full Name', min = LIMITS.NAME_MIN, max = LIMITS.NAME_MAX, pattern = NAME_REGEX } = {}) => {
  const val = (value || '').trim();
  if (!val) return `${label} is required.`;
  if (val.length < min) return `${label} must be at least ${min} characters long.`;
  if (max && val.length > max) return `${label} cannot exceed ${max} characters.`;
  if (pattern && !pattern.test(val)) return `${label} should only contain letters, spaces, and punctuation (. - ').`;
  return '';
};

/** 11-digit mobile number starting with `03`. */
export const validatePhone = (value, { label = 'Phone number' } = {}) => {
  const clean = onlyDigits(value);
  if (!clean) return `${label} is required.`;
  if (!clean.startsWith('03')) return `${label} must start with '03' (e.g. 03XXXXXXXXX).`;
  if (clean.length !== LIMITS.PHONE_DIGITS) return `${label} must be exactly 11 digits (${clean.length}/11 entered).`;
  return '';
};

/** Same as validatePhone but without the `03` prefix requirement, for shared/WhatsApp contacts. */
export const validateLoosePhone = (value, { label = 'Phone number' } = {}) => {
  const clean = onlyDigits(value);
  if (!clean) return `${label} is required.`;
  if (clean.length < LIMITS.PHONE_DIGITS_MIN || clean.length > LIMITS.PHONE_DIGITS_MAX) {
    return `${label} must be between ${LIMITS.PHONE_DIGITS_MIN} and ${LIMITS.PHONE_DIGITS_MAX} digits.`;
  }
  return '';
};

/** 13-digit national CNIC / B-Form. */
export const validateCnic = (value, { label = 'CNIC' } = {}) => {
  const clean = onlyDigits(value);
  if (!clean) return `${label} / National ID is required.`;
  if (clean.length !== LIMITS.CNIC_DIGITS) return `${label} must be exactly 13 digits (${clean.length}/13 entered).`;
  return '';
};

/** Email address, with an optional required flag for optional profile fields. */
export const validateEmail = (value, { label = 'Email', required = true } = {}) => {
  const val = (value || '').trim();
  if (!val) return required ? `${label} address is required.` : '';
  if (!EMAIL_REGEX.test(val)) return `${label} address must be valid (e.g. name@domain.com).`;
  return '';
};

/** Age in whole years, inclusive bounds. */
export const validateAge = (value, { label = 'Age', min = LIMITS.AGE_MIN, max = LIMITS.AGE_MAX, required = true } = {}) => {
  if (value === '' || value === null || value === undefined) {
    return required ? `${label} is required.` : '';
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) return `${label} must be between ${min} and ${max} years.`;
  return '';
};

/** Integer inside a range, for token capacity and similar counters. */
export const validateIntegerRange = (value, { label, min = 0, max, required = true } = {}) => {
  if (value === '' || value === null || value === undefined) {
    return required ? `${label} is required.` : '';
  }
  const num = Number(value);
  if (!Number.isInteger(num)) return `${label} must be a whole number.`;
  if (num < min) return `${label} must be at least ${min}.`;
  if (max !== undefined && num > max) return `${label} cannot exceed ${max}.`;
  return '';
};

/** Non-negative money amount, for the consultation fee. */
export const validateAmount = (value, { label = 'Amount', max = LIMITS.CONSULTATION_FEE_MAX, required = true } = {}) => {
  if (value === '' || value === null || value === undefined) {
    return required ? `${label} is required.` : '';
  }
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return `${label} must be a non-negative number.`;
  if (max !== undefined && num > max) return `${label} cannot exceed ${max}.`;
  return '';
};

/**
 * Full account password rules: 8-64 characters plus at least two of
 * lower/upper/digit/symbol (OWASP aligned, enforced by getPasswordCriteria).
 */
export const validatePassword = (value, { label = 'Password', min = LIMITS.PASSWORD_MIN, max = LIMITS.PASSWORD_MAX, required = true } = {}) => {
  const val = value || '';
  if (!val) return required ? `${label} is required.` : '';
  if (val.length < min) return `${label} must be at least ${min} characters long.`;
  if (val.length > max) return `${label} cannot exceed ${max} characters.`;
  if (!getPasswordCriteria(val, min, max).isValid) {
    return `${label} is too weak. Please combine upper & lower case, numbers, or symbols.`;
  }
  return '';
};

/** Optional short password patients may set for their portal login. */
export const validateOptionalPassword = (value, { label = 'Password' } = {}) => {
  const val = value || '';
  if (!val) return '';
  if (val.length < LIMITS.PATIENT_PASSWORD_MIN) return `${label} must be at least ${LIMITS.PATIENT_PASSWORD_MIN} characters long.`;
  if (val.length > LIMITS.PATIENT_PASSWORD_MAX) return `${label} cannot exceed ${LIMITS.PATIENT_PASSWORD_MAX} characters.`;
  return '';
};

/** Password typed on a sign-in screen: length only, complexity is already known from enrolment. */
export const validateLoginPassword = (value, { label = 'Password' } = {}) => {
  const val = value || '';
  if (!val) return `${label} is required to authenticate.`;
  if (val.length < LIMITS.LOGIN_PASSWORD_MIN) return `${label} must be at least ${LIMITS.LOGIN_PASSWORD_MIN} characters long.`;
  if (val.length > LIMITS.PASSWORD_MAX) return `${label} cannot exceed ${LIMITS.PASSWORD_MAX} characters.`;
  return '';
};

/** Both password boxes match. */
export const validatePasswordMatch = (value, match, { field = 'Password', label = 'Password confirmation' } = {}) => {
  if (!match) return `Confirm your new ${field.toLowerCase()}.`;
  if (value !== match) return `${label} does not match new password.`;
  return '';
};

/** Login/reset screens accept either the registered phone or the registered CNIC. */
export const validateIdentifier = (value, { label = 'Phone Number or CNIC' } = {}) => {
  const clean = onlyDigits(value);
  if (!clean) return `Please enter your ${label}.`;
  if (clean.length === LIMITS.CNIC_DIGITS) return '';
  if (clean.length === LIMITS.PHONE_DIGITS) {
    return clean.startsWith('03')
      ? ''
      : `Phone number must start with '03' (e.g. 03XXXXXXXXX).`;
  }
  return `Please enter a valid ${LIMITS.PHONE_DIGITS}-digit Phone (03XXXXXXXXX) or ${LIMITS.CNIC_DIGITS}-digit CNIC.`;
};

/** Categorises the sign-in identifier for the live "format detected" badge. */
export const getIdentifierType = (value = '') => {
  const raw = (value || '').trim();
  if (!raw) return null;
  const clean = onlyDigits(raw);
  if (!clean) {
    return { type: 'invalid', label: 'Numbers only', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800' };
  }
  if (PHONE_REGEX.test(clean)) {
    return { type: 'phone', label: 'Mobile Number Valid', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800' };
  }
  if (CNIC_REGEX.test(clean)) {
    return { type: 'cnic', label: 'National CNIC Valid', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800' };
  }
  if (clean.length < LIMITS.PHONE_DIGITS) {
    return { type: 'typing', label: `Enter ${LIMITS.PHONE_DIGITS} digits (03...)`, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  }
  return null;
};

/** Hospital-issued medical authorization code used to enrol a doctor. */
export const validateAccessCode = (value, { label = 'Hospital Medical Authorization Code' } = {}) => {
  const val = (value || '').trim();
  if (!val) return `${label} is required to register doctor credentials.`;
  if (val.length < LIMITS.ACCESS_CODE_MIN) return `${label} must be at least ${LIMITS.ACCESS_CODE_MIN} characters long.`;
  if (val.length > LIMITS.ACCESS_CODE_MAX) return `${label} cannot exceed ${LIMITS.ACCESS_CODE_MAX} characters.`;
  if (!/^[A-Za-z0-9_-]+$/.test(val)) return `${label} may only contain letters, numbers, hyphens and underscores.`;
  return '';
};

/** One of a fixed set of options, e.g. gender. */
export const validateChoice = (value, { label, required = true } = {}) => {
  if (value === '' || value === null || value === undefined) {
    return required ? `Please select ${label}.` : '';
  }
  return '';
};

/** Uploaded image: MIME type plus a byte ceiling. */
export const validateImageFile = (file, { label = 'Photo', maxBytes = LIMITS.PROFILE_PIC_MAX_BYTES, mimeTypes = PROFILE_PIC_MIME_TYPES, allowEmpty = true } = {}) => {
  if (!file) return allowEmpty ? '' : `${label} is required.`;
  if (mimeTypes && !mimeTypes.includes(file.type)) {
    return `${label} must be an image (${mimeTypes.map(t => t.replace('image/', '').toUpperCase()).join(', ')}).`;
  }
  if (maxBytes && file.size > maxBytes) {
    return `${label} size must be less than ${Math.round(maxBytes / (1024 * 1024))}MB.`;
  }
  return '';
};

/** Absolute http(s) link for the admin social content fields. */
export const validateUrl = (value, { label = 'URL', required = false } = {}) => {
  const val = (value || '').trim();
  if (!val) return required ? `${label} is required.` : '';
  if (!URL_REGEX.test(val)) return `${label} must be a full address starting with http:// or https://.`;
  return '';
};

/* ------------------------------------------------------------------ *
 * Error-bag helpers
 * ------------------------------------------------------------------ */

/** Runs a `{ field: () => message }` map and drops the entries that passed. */
export const collectErrors = (rules) => {
  const errors = {};
  Object.entries(rules).forEach(([field, rule]) => {
    const message = typeof rule === 'function' ? rule() : rule;
    if (message) errors[field] = message;
  });
  return errors;
};

export const hasErrors = (errors) => !!errors && Object.keys(errors).length > 0;

/** First failing field, used to drive the focus chain after a failed submit. */
export const firstErrorKey = (errors) => (hasErrors(errors) ? Object.keys(errors)[0] : null);

/** Removes one key from an error bag without mutating the original. */
export const withoutField = (errors, field) => {
  if (!errors || !errors[field]) return errors;
  const copy = { ...errors };
  delete copy[field];
  return copy;
};

/** Maps a backend error message onto the field it refers to. */
export const matchErrorField = (message = '', keywordMap) => {
  const lower = String(message).toLowerCase();
  for (const [field, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(keyword => lower.includes(keyword))) return field;
  }
  return null;
};
