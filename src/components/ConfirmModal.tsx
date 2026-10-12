import { Loader2 } from 'lucide-react';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };

export default function ConfirmModal({
  title,
  body,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div className="rounded-[14px] p-5 max-w-sm w-full" style={surface} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white text-[16px] font-bold">{title}</h2>
        <p className="text-[#8A8B91] text-[13px] mt-1">{body}</p>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-[#E1E2E6] hover:text-white"
            style={{ background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white disabled:opacity-60 flex items-center gap-1.5"
            style={{ background: '#FF2B55' }}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
