import React from 'react';
import {
  FileText, Scale, CheckCircle, UserCheck, Stethoscope, Cpu, AlertTriangle,
  ClipboardCheck, CalendarClock, CreditCard, Lightbulb, ShieldAlert, Plug,
  Scale as ScaleIcon, Shield, UserX, RefreshCw, Mail
} from 'lucide-react';

const sections = [
  {
    icon: CheckCircle,
    title: '1. Acceptance of Terms',
    paragraphs: [
      'By accessing or using the PulmoAI platform (the "Platform"), you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree with any part of these terms, you must not use the Platform.',
      'These terms apply to all visitors, registered patients, registered doctors, and administrators. By using the Platform you confirm that you are legally capable of entering into this agreement.'
    ]
  },
  {
    icon: UserCheck,
    title: '2. Eligibility and Account Registration',
    paragraphs: [
      'Public registration on the Platform is restricted to licensed medical professionals. Doctor accounts are created using a single-use registration code issued by a PulmoAI administrator. Registration codes are non-transferable, may be redeemed only once, and may be revoked at our discretion.',
      'Patient accounts are created by a verified doctor, or through the guest token flow, which allows a patient to reserve a queue slot without a prior account. You must provide accurate, current, and complete information and are solely responsible for the accuracy of what you submit.',
      'You must be at least 18 years of age to hold an account. Minors may only be processed under a doctor-supervised workflow, where a doctor submits the record on their behalf.'
    ]
  },
  {
    icon: Stethoscope,
    title: '3. Medical Disclaimer',
    paragraphs: [
      'The PulmoAI system provides AI-assisted analysis for educational, research, and preliminary screening purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment, and it must not be used as the sole basis for any clinical decision.',
      'Nothing on this Platform constitutes medical advice, a doctor-patient relationship, or a guarantee of any outcome. Always consult a qualified, licensed healthcare professional who can examine the patient directly.',
      'If you or someone under your care is experiencing severe shortness of breath, acute chest pain, confusion, coughing up blood, or any other medical emergency, do not rely on this Platform. Visit the nearest hospital emergency department immediately or call 1122.'
    ],
    accent: 'amber'
  },
  {
    icon: Cpu,
    title: '4. AI Model Limitations and Accuracy',
    paragraphs: [
      'The Platform classifies chest radiographs into three categories: Normal, Pneumonia, and Tuberculosis. The underlying model is a deep convolutional neural network trained on a bounded research dataset, and its output includes a confidence score and an anatomical heatmap highlighting regions of interest.',
      'AI performance is inherently limited. Results can be incorrect or misleading because of image quality, radiographic technique, patient positioning, co-existing conditions, disease stage, scanner hardware, contrast and exposure settings, and images that fall outside the training distribution. The model has not been prospectively validated for every population, device, or clinical setting.',
      'A "Normal" result does not mean a patient is healthy or free of disease. A low confidence score does not mean a patient is safe. A high confidence score is not a clinical diagnosis. Every result must be independently verified by a doctor, who remains fully responsible for the final interpretation and any resulting treatment decision.'
    ],
    accent: 'amber'
  },
  {
    icon: ClipboardCheck,
    title: '5. User Responsibilities',
    paragraphs: [
      'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately if you suspect unauthorised access.',
      'You must not upload images that you do not have the right to use, or that were obtained without the patient\u2019s informed consent.',
      'You must not attempt to re-identify, correlate, or export patient data for any purpose other than the direct clinical care of that patient.'
    ]
  },
  {
    icon: Stethoscope,
    title: '6. Doctor Obligations and Clinical Verification',
    paragraphs: [
      'Doctors using the Platform must hold a valid, current, and verifiable medical licence, and must maintain the professional and ethical standards of their profession and jurisdiction.',
      'Doctors are required to independently verify every AI-generated prediction against their own clinical judgement, the original radiograph, and the patient\u2019s clinical history. A doctor must not upload an image they know to be uninterpretable, out of scope, or improperly obtained, and must not rely on the AI output in place of their own assessment.',
      'Doctors remain solely liable for diagnosis, treatment, prescriptions, referrals, and all other clinical decisions. The Platform does not review, endorse, or approve any clinical decision made through it.'
    ]
  },
  {
    icon: CalendarClock,
    title: '7. Appointments, Token Queue, and Scheduling',
    paragraphs: [
      'The Platform operates a live clinic queue in which each doctor issues numbered tokens to patients for a given booking date. Token availability, timing, and ordering are controlled by the doctor\u2019s configured scheduling behaviour and maximum daily capacity.',
      'A confirmed token represents a place in the queue only. It is not an appointment with a fixed consultation time, does not guarantee that you will be seen within any particular period, and does not guarantee that the doctor will be able to attend to you.',
      'Doctors may reorder, reassign, or cancel tokens at their discretion, including where a patient is a no-show, arrives out of order, or was registered offline or on behalf of a family member. The Platform is not liable for lost clinical time arising from queue changes.',
      'You must not attempt to resell, transfer, or duplicate a token.'
    ]
  },
  {
    icon: CreditCard,
    title: '8. Fees, Payments, and Refunds',
    paragraphs: [
      'Some doctors charge a consultation fee, which is set by the individual doctor and displayed to you at the time of booking. The fee recorded against your appointment is the fee that was active at the moment you booked, and it is not subsequently changed by a doctor altering their listed fee.',
      'Payments processed through the Platform are transactional only. The Platform does not provide medical insurance, and processing a payment does not guarantee that a consultation will take place or that any particular clinical service will be delivered.',
      'Refund and cancellation requests are handled by the treating doctor and the applicable clinic, not by the Platform. Because queue capacity is limited and clinical slots are time-sensitive, a booked token is generally non-refundable where the doctor has been consulted or where a slot has been released to another patient.'
    ]
  },
  {
    icon: Lightbulb,
    title: '9. Intellectual Property',
    paragraphs: [
      'The Platform, including its software, source code, machine learning models, trained weights, user interface, design, branding, logos, documentation, and all underlying intellectual property, is owned by PulmoAI or its licensors and is protected by applicable intellectual property laws.',
      'Radiograph images you upload remain your property to the extent they are your property, and you grant us a limited, non-exclusive licence to host, process, and display them solely to operate the Platform and deliver the services you have requested. You retain all rights in your content, and we claim no ownership of it beyond that limited licence.',
      'No licence or right is granted to reverse engineer the models or software, extract model weights, attempt to reconstruct the training dataset, probe the models programmatically to build a competing system, or resell or sublicense any part of the Platform without our prior written consent.'
    ]
  },
  {
    icon: ShieldAlert,
    title: '10. Prohibited Activities',
    paragraphs: [
      'You must not use the Platform to: submit intentionally corrupted, manipulated, or mislabelled images; attempt to obtain a result for an image that is not a chest radiograph of the patient concerned; interfere with, disrupt, or attempt to gain unauthorised access to the Platform, its models, or its infrastructure; scrape, harvest, or bulk-extract patient data, model outputs, or doctor listings; bypass rate limits, access controls, or administrative restrictions; upload malicious code, or impersonate any person or entity.',
      'Automated interaction with the Platform, including model probing, adversarial testing, and dataset reconstruction, is prohibited without written authorisation.'
    ],
    accent: 'red'
  },
  {
    icon: Plug,
    title: '11. Availability and Third-Party Services',
    paragraphs: [
      'The Platform is provided on an as-available basis. We do not guarantee that the service will be uninterrupted, error-free, or permanently available, and we may modify, suspend, or discontinue any feature at any time.',
      'The Platform depends on third-party infrastructure, including hosting, databases, and network providers, whose failures are outside our reasonable control. A doctor\u2019s availability, equipment, and connection are likewise outside our control.'
    ]
  },
  {
    icon: ScaleIcon,
    title: '12. Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by law, PulmoAI and its officers, employees, doctors, and affiliates are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, nor for any loss of profits, revenue, data, goodwill, or medical opportunity, arising out of or related to your use of the Platform or any AI output.',
      'The Platform is an assistive screening tool. To the fullest extent permitted by law, our aggregate liability arising from any AI output or Platform failure is limited to the amount you paid to use the Platform in the twelve months preceding the claim, or to zero where you have not paid anything.',
      'Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for fraud, or for death or personal injury caused by negligence.'
    ]
  },
  {
    icon: Shield,
    title: '13. Indemnification',
    paragraphs: [
      'You agree to indemnify, defend, and hold harmless PulmoAI, its officers, employees, and affiliates from and against any and all claims, losses, liabilities, damages, costs, and expenses, including reasonable legal fees, arising out of or in connection with your use of the Platform, your breach of these terms, your violation of any law or regulation, your infringement of any third-party right, or your upload of any image you were not authorised to use.'
    ]
  },
  {
    icon: UserX,
    title: '14. Suspension and Termination',
    paragraphs: [
      'You may request deletion of your account at any time. Records that we are legally or clinically required to retain, such as completed consultations and diagnostic history, may be retained in an anonymised form where deletion is not permissible.',
      'We may suspend, restrict, or permanently terminate any account, without notice, that breaches these terms, supplies fraudulent credentials, misuses clinical data, or endangers the integrity of the Platform. Where safety or a regulatory obligation requires it, we will act promptly.'
    ]
  },
  {
    icon: RefreshCw,
    title: '15. Modifications to These Terms',
    paragraphs: [
      'We may revise these Terms at any time. Material changes will be notified through the Platform or, where appropriate, by email. Continued use of the Platform after a change takes effect constitutes acceptance of the revised terms. If you do not accept a revision, you must stop using the Platform and may request account deletion.'
    ]
  },
  {
    icon: Mail,
    title: '16. Governing Law and Disputes',
    paragraphs: [
      'These Terms are governed by the laws applicable in the jurisdiction in which the treating doctor is licensed and the patient is treated. Any dispute arising out of or in connection with the Platform that cannot be resolved amicably will be subject to the exclusive jurisdiction of the competent courts of that jurisdiction.',
      'Nothing in these terms limits any right or remedy you have under applicable consumer protection, medical, or data protection law, including any right you may have to bring proceedings in your own jurisdiction.'
    ]
  }
];

const iconClass = (accent) => {
  if (accent === 'amber') return 'text-amber-600 dark:text-amber-400';
  if (accent === 'red') return 'text-red-600 dark:text-red-400';
  return 'text-blue-600 dark:text-blue-400';
};

const Terms = () => {
  return (
    <div className="max-w-4xl mx-auto pt-10 pb-20 px-4">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-2 shadow-xs">
          <Scale size={14} className="text-blue-600 dark:text-blue-400" />
          <span>Legal Agreement</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <FileText size={24} className="text-blue-600 dark:text-blue-400 shrink-0" />
          Terms &amp; Conditions
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
          Please read these terms carefully. PulmoAI is an assistive screening platform and is not a substitute for professional medical care.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong className="font-extrabold">Medical emergency?</strong> If you are experiencing severe
            shortness of breath, acute chest pain, or coughing up blood, do not use this Platform. Go to the
            nearest emergency department or call <strong className="font-extrabold">1122</strong> immediately.
          </p>
        </div>

        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title} className="mt-8 first:mt-6">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Icon size={18} className={`${iconClass(section.accent)} shrink-0`} />
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

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
            Key Rules at a Glance
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              Every AI result must be independently verified by a doctor.
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              A token reserves a place in the queue, not a guaranteed consultation time.
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              A "Normal" result is not a clean bill of health.
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              Patient images must only be uploaded with the patient&rsquo;s informed consent.
            </li>
            <li className="flex gap-2">
              <CheckCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              Registration codes are single-use and non-transferable.
            </li>
          </ul>
        </div>

        <p className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          Questions about these terms? Use the in-app contact form and our team will respond.
        </p>
      </div>
    </div>
  );
};

export default Terms;
