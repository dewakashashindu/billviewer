/** Sharing attachments needs Web Share file support; mailto and WhatsApp URLs cannot attach files. */
type Target = 'native' | 'whatsapp' | 'email';
type ShareNavigator = Pick<Navigator, 'share' | 'canShare'>;
type Options = {
  file: File;
  title: string;
  target: Target;
  navigator: ShareNavigator | null;
  download: () => void;
  openTarget: (target: 'whatsapp' | 'email') => void;
  message: (text: string) => void;
  done: () => void;
};
export function shareReportPdf(o: Options): void {
  const {file, target, navigator: nav} = o;
  let supported = false;
  try { supported = !!nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({files: [file]}); } catch { /* not supported */ }
  if (supported && nav) {
    try {
      void nav.share({files: [file], title: o.title}).then(o.done).catch((error: unknown) => {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
        o.download();
        o.message(`PDF downloaded (${file.name}). Open ${target === 'native' ? 'your preferred app' : target === 'whatsapp' ? 'WhatsApp' : 'your email app'} and attach the downloaded file before sending.`);
      });
      return;
    } catch {
      // The share API can also fail synchronously; use the same explicit fallback.
    }
  }
  o.download();
  if (target !== 'native') o.openTarget(target);
  o.message(`PDF downloaded (${file.name}). ${target === 'native' ? 'Open your preferred app' : target === 'whatsapp' ? 'In WhatsApp' : 'In your email app'}, attach the downloaded PDF before sending. The file is not attached automatically.`);
}
