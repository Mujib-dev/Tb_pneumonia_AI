import React from 'react';
import {
  ShieldCheck, Database, LineChart, Scale, Share2, Stethoscope, Lock,
  Trash2, Cookie, UserCheck, Bell, Globe, RefreshCw, Mail, Image, Cpu, FileCheck
} from 'lucide-react';

const sections = [
  {
    icon: Database,
    title: '1. Information We Collect',
    paragraphs: [
      'We collect only the information needed to operate the Platform, identify users, and deliver clinical queue services. This includes your name, phone number, CNIC, age, gender, and account credentials when you register.',
      'Doctors additionally provide a specialization, clinic name, professional address, an "about" description, a timetable, a consultation fee, and a profile photograph. Profile photographs must be JPG, JPEG, or PNG.',
      'We also record transactional data, such as token bookings, queue position, booking date, appointment status, and the fee charged, as well as messages you submit through the contact form.'
    ]
  },
  {
    icon: Image,
    title: '2. Medical Images and Diagnostic Data',
    paragraphs: [
      'When a chest radiograph is uploaded, we store the image file together with the AI-generated classification (Normal, Pneumonia, or Tuberculosis), the confidence score, the full per-class probability breakdown, the generated anatomical heatmap, and the date and time of analysis.',
      'Uploads are limited to a maximum of 10 MB per file. Our automated pre-screening checks that an upload is a genuine chest radiograph rather than a photograph of a person, a screenshot, or unrelated content, and rejected uploads are not analysed.',
      'We retain diagnostic history so that it remains available to you and to your doctor for continuity of care. Diagnostic records are sensitive health information and are treated as such.'
    ]
  },
  {
    icon: LineChart,
    title: '3. How We Use Your Information',
    paragraphs: [
      'We use your information to operate, maintain, secure, and improve the Platform: to authenticate you, to manage the live token queue, to run the AI analysis and return results, to generate reports, to process payments, and to send service communications such as token and appointment updates.',
      'We use limited, aggregated, and de-identified data to understand feature usage and improve model quality and reliability. We do not sell your personal information, and we do not share it for advertising.',
      'Automated analysis produces an assistive suggestion only. No clinical decision, diagnosis, or treatment is made by an automated system alone; a verified doctor is responsible for every interpretation and any resulting action.'
    ]
  },
  {
    icon: Scale,
    title: '4. Legal Basis for Processing',
    paragraphs: [
      'We process personal data on one or more of the following bases: performance of our agreement with you, compliance with a legal obligation, protection of vital interests in an emergency, and our legitimate interests in operating and securing the Platform. Where consent is the applicable basis, you may withdraw it at any time.'
    ]
  },
  {
    icon: Share2,
    title: '5. How We Share Your Information',
    paragraphs: [
      'We do not sell, rent, or trade personal information. We share limited data only with: service providers who host the infrastructure, store data, or deliver communications on our behalf, who are bound to protect it; the doctor who is directly caring for you, who must be able to access your radiographs, results, and history to treat you; and authorities, where disclosure is required by law, court order, or to protect the safety of the platform and its users.',
      'We will notify you of any legally compelled disclosure unless prohibited by law. We do not sell or share data for cross-context behavioural advertising.'
    ]
  },
  {
    icon: Stethoscope,
    title: '6. Doctor Access to Patient Data',
    paragraphs: [
      'A doctor may view the radiographs, AI results, and diagnostic history of patients registered to them, and may add clinical notes and profile information to those records. This access is scoped to the doctor–patient relationship and is revoked when that relationship ends.',
      'You should not upload an image for a patient who has not consented, and you must not use the Platform to access a patient record you are not authorised to see.'
    ]
  },
  {
    icon: Lock,
    title: '7. How We Store and Protect Data',
    paragraphs: [
      'Data is transmitted over encrypted connections and stored on access-controlled infrastructure. Passwords are stored only as salted, irreversible cryptographic hashes and are never stored or logged in plain text. Access to radiographs and diagnostic records is restricted to authorised users and is scoped to their clinical role.',
      'All images and records are stored in Pakistan and are not transferred outside the country. Every registered account is uniquely identified by phone number and CNIC, which we use to prevent duplicate and fraudulent registrations.'
    ]
  },
  {
    icon: Cpu,
    title: '8. Automated Analysis and Profiling',
    paragraphs: [
      'Uploaded radiographs are processed automatically by a deep learning model to produce a classification and confidence score. This processing is limited to the submitted image and does not incorporate unrelated personal data.',
      'No decision based solely on automated processing has a legal or similarly significant effect on you. A doctor reviews every result, and you may request human review of any AI output at any time.'
    ]
  },
  {
    icon: Trash2,
    title: '9. Data Retention',
    paragraphs: [
      'Diagnostic images, results, and appointment records are retained for as long as your account is active so that your clinical history remains available, and may be retained for a longer period where required by medical record-keeping obligations.',
      'When you request account deletion, we remove or irreversibly anonymise your personal information, except for the limited records we are legally or clinically required to retain, which are then stored without identifying information.',
      'When we no longer need your data for the purposes collected, we delete or anonymise it.'
    ]
  },
  {
    icon: Cookie,
    title: '10. Cookies and Local Storage',
    paragraphs: [
      'To keep you signed in and to remember preferences such as your theme, we use browser cookies and local storage. This is necessary for the Platform to function and is not used to track you across other websites.',
      'You can clear cookies and local storage through your browser settings. Doing so will sign you out and reset your stored preferences.'
    ]
  },
  {
    icon: UserCheck,
    title: '11. Your Privacy Rights',
    paragraphs: [
      'Subject to applicable law, you have the right to: access a copy of your personal information and diagnostic records; request correction of inaccurate or incomplete information; request deletion of your account and data; object to or restrict certain processing; withdraw consent where consent is the basis for processing; and receive a portable copy of your data in a structured, machine-readable format.',
      'We may need to verify your identity before acting on a request, and we may decline a request where a legal or clinical obligation requires us to retain the record. We aim to respond to requests as promptly as legally required.'
    ]
  },
  {
    icon: FileCheck,
    title: '12. Security Incident Notification',
    paragraphs: [
      'We monitor our systems for unauthorised access and take reasonable steps to prevent, detect, and address security incidents. In the event of a breach that is likely to affect your rights and freedoms, we will notify you and the relevant supervisory authority in accordance with applicable data protection law.'
    ]
  },
  {
    icon: Bell,
    title: '13. Children’s Privacy',
    paragraphs: [
      'The Platform is not directed to children under 18, and we do not knowingly collect information from them directly. Where a minor is processed, a verified doctor submits the record and manages the child’s data on their behalf, and that doctor is responsible for obtaining any consent required by law.'
    ]
  },
  {
    icon: Globe,
    title: '14. Data Subject Complaints',
    paragraphs: [
      'If you are not satisfied with how we have handled your personal information, you may raise a complaint with us through the in-app contact form. You also have the right to lodge a complaint with your national data protection authority, and we will cooperate with any such enquiry.'
    ]
  },
  {
    icon: RefreshCw,
    title: '15. Changes to This Policy',
    paragraphs: [
      'We may update this Privacy Policy to reflect changes in our practices, the law, or the Platform. Material changes will be notified through the Platform. Your continued use of the Platform after a change takes effect constitutes acceptance of the revised policy.'
    ]
  },
  {
    icon: Mail,
    title: '16. Contact Us',
    paragraphs: [
      'For any privacy question, data request, or concern, use the in-app contact form. Include enough detail for us to locate your records, and never send a password. We will respond to verified requests as promptly as we can.'
    ]
  }
];

const Privacy = () => {
  return (
    <div className="max-w-4xl mx-auto pt-10 pb-20 px-4">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-2 shadow-xs">
          <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
          <span>Data Protection</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <ShieldCheck size={24} className="text-blue-600 dark:text-blue-400 shrink-0" />
          Privacy Policy
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
          How PulmoAI collects, uses, stores, and protects your information, including medical images and diagnostic records.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Lock size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong className="font-extrabold">Your radiographs are health data.</strong> They are
            accessible only to you and the doctor treating you, are never sold, and are stored in Pakistan.
          </p>
        </div>

        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title} className="mt-8 first:mt-6">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Icon size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                {section.title}
              </h2>
              <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          );
        })}

        <p className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          This policy applies to all PulmoAI users: patients, doctors, and administrators.
        </p>
      </div>
    </div>
  );
};

export default Privacy;
