import { useEffect, useRef, useState } from 'react';
import { Button, cx } from './ui.jsx';

const JAAS_DOMAIN = '8x8.vc';
const JAAS_APP = 'vpaas-magic-cookie-3652cf032c2e40239b1a3e773f2fafa7';
const SCRIPT_URL = `https://${JAAS_DOMAIN}/${JAAS_APP}/external_api.js`;

let scriptPromise = null;
function loadJitsi() {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        script.remove();
        reject(new Error('Video script failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * The video table (8x8 / Jitsi). Loaded the first time it is shown, then kept
 * mounted so the call (and its audio) carries on while the drawer is closed.
 */
export function VideoRoom({ jwtToken, demo = false, className }) {
  const holder = useRef(null);
  const [phase, setPhase] = useState(jwtToken && !demo ? 'loading' : 'unavailable');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!jwtToken || demo) return undefined;
    let api = null;
    let cancelled = false;
    setPhase('loading');

    loadJitsi()
      .then(() => {
        if (cancelled || !holder.current) return;
        api = new window.JitsiMeetExternalAPI(JAAS_DOMAIN, {
          roomName: `${JAAS_APP}/MMPPoker`,
          jwt: jwtToken,
          parentNode: holder.current,
          width: '100%',
          height: '100%',
          lang: 'en',
        });
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('failed');
      });

    return () => {
      cancelled = true;
      api?.dispose();
    };
  }, [jwtToken, demo, attempt]);

  return (
    <div className={cx('relative overflow-hidden rounded-panel bg-rail', className)}>
      <div ref={holder} className="absolute inset-0" />
      {phase !== 'ready' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          {phase === 'loading' ? <p className="text-body text-chalk-dim">Connecting to the video table…</p> : null}
          {phase === 'unavailable' ? (
            <p className="max-w-[32ch] text-body text-chalk-dim">
              {demo
                ? 'Video is switched off in sample mode.'
                : 'Video isn’t set up for this seat yet. Ask whoever runs the server to add its video key.'}
            </p>
          ) : null}
          {phase === 'failed' ? (
            <>
              <p className="max-w-[32ch] text-body text-chalk">Video couldn’t load. Check your connection and try again.</p>
              <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
