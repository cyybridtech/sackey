import { Download, Smartphone, Share, PlusSquare, CheckCircle, X } from 'lucide-react';
import Modal from './Modal';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  onNativeInstall?: () => void;
  hasNativePrompt: boolean;
}

export default function InstallAppModal({
  isOpen,
  onClose,
  isIOS,
  onNativeInstall,
  hasNativePrompt,
}: InstallAppModalProps) {
  if (!isOpen) return null;

  return (
    <Modal title="Install POS App on Your Phone" onClose={onClose} size="md">
      <div className="space-y-5 text-slate-700">
        <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Add to Phone Home Screen</h4>
            <p className="text-xs text-slate-500">
              Enjoy instant access, fast full-screen view, and no browser address bar!
            </p>
          </div>
        </div>

        {hasNativePrompt ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Click the button below to automatically install the POS application to your phone:
            </p>
            <button
              type="button"
              onClick={() => {
                onNativeInstall?.();
                onClose();
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Download className="w-5 h-5" />
              <span>Install to Phone Now</span>
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <p className="font-semibold text-slate-800 text-sm mb-2">How to install on iPhone / iPad (Safari):</p>
            <ol className="space-y-2.5 text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <span>Tap the <strong>Share</strong> button <Share className="w-4 h-4 inline text-blue-600 mx-1" /> at the bottom of Safari.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <span>Scroll down and tap <strong>'Add to Home Screen'</strong> <PlusSquare className="w-4 h-4 inline text-blue-600 mx-1" />.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <span>Tap <strong>Add</strong> in the top right corner. The POS App will appear on your phone screen!</span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <p className="font-semibold text-slate-800 text-sm mb-2">How to install on Android (Chrome):</p>
            <ol className="space-y-2.5 text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <span>Tap the <strong>three dots (⋮)</strong> menu in the top right corner of Chrome.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <span>Tap <strong>'Install app'</strong> or <strong>'Add to Home screen'</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <span>Confirm <strong>Install</strong>. The POS app will be added directly to your apps!</span>
              </li>
            </ol>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
