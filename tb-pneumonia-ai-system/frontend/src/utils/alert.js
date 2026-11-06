import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

export const clinicalSwal = Swal.mixin({
  background: '#0f172a',
  color: '#ffffff',
  confirmButtonColor: '#2563eb',
  cancelButtonColor: '#1e293b',
  customClass: {
    popup: 'border border-black/10 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-[#0f172a]',
    title: 'text-slate-900 dark:text-white font-black tracking-tight text-lg sm:text-xl',
    htmlContainer: 'text-gray-600 dark:text-gray-400 text-xs leading-relaxed',
    confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 transition-colors mx-1 cursor-pointer shadow-md shadow-blue-500/20',
    cancelButton: 'px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider text-gray-700 dark:text-gray-300 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:bg-white/10 transition-colors mx-1 cursor-pointer',
    input: 'bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 w-full mb-2',
    actions: 'mt-4'
  },
  buttonsStyling: false
});

export const showErrorAlert = (title, text) => {
  clinicalSwal.fire({
    icon: 'error',
    title: title || 'Error',
    text: text || 'An unexpected error occurred.',
  });
};

export const showSuccessAlert = (title, text) => {
  clinicalSwal.fire({
    icon: 'success',
    title: title || 'Success',
    text: text || 'Operation completed successfully.',
  });
};
