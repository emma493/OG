import { useEffect, useState } from 'react';
import { Eye, Loader2, Pencil, Trash2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { deleteLinkDoc, shareUrlFor, subscribeToLinks, toggleLinkActive, updateLinkDuration } from '../lib/ogFirebase';
import { DURATION_RE } from '../lib/links';
import { friendlyReason } from '../lib/utils';
import type { OgLinkDocument } from '../types';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };
const inputStyle = { background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' };

export default function ManageLinksPage() {
  const [links, setLinks] = useState<OgLinkDocument[]>([]);
  const [connected, setConnected] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => subscribeToLinks((list) => { setLinks(list); setConnected(true); }, () => setConnected(false)), []);

  const onToggle = async (id: string, current: boolean) => {
    setBusyId(id);
    setError('');
    try {
      await toggleLinkActive(id, current);
      setToast(current ? `Hid ${id}` : `Showed ${id}`);
    } catch (e) {
      setError(friendlyReason(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!confirmId) return;
    setBusyId(confirmId);
    setError('');
    try {
      await deleteLinkDoc(confirmId);
      setToast(`Deleted ${confirmId} — old shares now 404`);
    } catch (e) {
      setError(friendlyReason(e));
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const saveDuration = async (id: string) => {
    if (!DURATION_RE.test(editDuration.trim())) {
      setError('Use m:ss format, e.g. 2:56');
      return;
    }
    setBusyId(id);
    setError('');
    try {
      await updateLinkDuration(id, editDuration.trim());
      setEditingId(null);
      setToast(`Updated ${id} pill — re-bake art stays, pill text updates on next publish only`);
    } catch (e) {
      setError(friendlyReason(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white text-[22px] font-extrabold tracking-tight">Manage Links</h1>
          <p className="text-[#8A8B91] text-[13px] mt-1">{connected ? `${links.length} links · edit pill, hide/show, delete` : 'Connecting…'}</p>
        </div>
        {toast && <span className="text-emerald-400 text-[12px] font-bold">{toast}</span>}
      </div>
      {error && (
        <div className="mt-4 rounded-[10px] p-3 text-[12px] font-bold text-[#FF2B55]" style={{ background: 'rgba(255,43,85,0.1)', border: '1px solid rgba(255,43,85,0.5)' }}>
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {!connected && (
          <div className="flex items-center gap-2 text-[#8A8B91] text-[13px]">
            <Loader2 size={15} className="animate-spin" /> Loading links…
          </div>
        )}
        {links.map((l) => (
          <div key={l.id} className="rounded-[14px] p-4 grid gap-2.5 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center" style={surface}>
            {l.imageUrl ? (
              <img src={l.imageUrl} alt="" loading="lazy" className="w-full sm:w-[120px] aspect-[1200/630] object-cover rounded-[8px]" />
            ) : (
              <div className="w-full sm:w-[120px] aspect-[1200/630] rounded-[8px] flex items-center justify-center text-[11px] text-[#8A8B91]" style={{ background: '#16171D' }}>—</div>
            )}
            <div className="min-w-0 grid gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-white text-[13px] font-bold font-mono truncate" title={shareUrlFor(l.slug)}>{shareUrlFor(l.slug)}</code>
                {!l.is_active && (
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full bg-white/[0.08] text-[#8A8B91]">Hidden</span>
                )}
              </div>
              <div className="text-[#8A8B91] text-[11px] font-mono truncate" title={l.sourceUrl}>src: {l.sourceUrl || '—'}</div>
              <div className="flex items-center gap-3 text-[#8A8B91] text-[12px]">
                <span className="flex items-center gap-1 tabular-nums"><Eye size={13} /> {(l.clicks || 0).toLocaleString()}</span>
                {editingId === l.id ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      placeholder="2:56"
                      className="w-[90px] px-2.5 py-1.5 rounded-[8px] text-white text-[12px] font-mono outline-none"
                      style={inputStyle}
                    />
                    <button type="button" disabled={busyId === l.id} onClick={() => saveDuration(l.id)} className="px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-white disabled:opacity-50" style={{ background: '#FF2B55' }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#8A8B91]">Cancel</button>
                  </span>
                ) : (
                  <span className="font-mono">pill: {l.duration || '—'}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => { setEditingId(l.id); setEditDuration(l.duration || ''); }}
                className="p-2 rounded-[8px] text-[#8A8B91] hover:text-white hover:bg-white/[0.06] disabled:opacity-50"
                title="Edit duration pill (metadata only)"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => onToggle(l.id, l.is_active)}
                className="px-3.5 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white disabled:opacity-50"
                style={inputStyle}
              >
                {busyId === l.id ? '…' : l.is_active ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => setConfirmId(l.id)}
                aria-label={`Delete ${l.slug}`}
                className="p-2 rounded-[8px] text-[#8A8B91] hover:text-[#FF2B55] hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {connected && links.length === 0 && (
          <div className="rounded-[14px] p-10 text-center text-[#8A8B91] text-[14px]" style={surface}>Nothing to manage yet — publish from Add Links first.</div>
        )}
      </div>

      {confirmId && (
        <ConfirmModal
          title={`Delete ${confirmId}?`}
          body="Removes the Firestore doc. The /epN URL stops working (bots get fallback, humans get ?from=missing). This can't be undone."
          confirmLabel="Delete"
          busy={busyId === confirmId}
          onCancel={() => setConfirmId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
