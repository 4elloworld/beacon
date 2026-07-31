import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { DEMO_SCAN_STEPS } from '../lib/demoData.js';
import { ANALYZABLE_REPORTS, REPORT_LABELS } from '../lib/csvParser.js';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Analyze({ onComplete, alreadyDone }) {
  const { portfolioData, analysisResults, setAnalysisResults } = useApp();
  const analysisResultRef = useRef(null);
  const skippedRef = useRef([]);
  const [notice, setNotice] = useState(null);

  const doneSteps = analysisResults?.scanSteps || DEMO_SCAN_STEPS;

  // If returning to this screen after scan completed, show done state immediately
  const [visibleSteps, setVisibleSteps] = useState(alreadyDone ? doneSteps : []);
  const [progress, setProgress] = useState(alreadyDone ? 100 : 0);
  const [statusText, setStatusText] = useState(alreadyDone ? 'Analysis complete — see what we found.' : 'Starting analysis…');
  const [scanDone, setScanDone] = useState(alreadyDone);

  useEffect(() => {
    if (alreadyDone) return; // already ran — don't re-animate

    const uploads = portfolioData?.uploads || [];

    // Analyze the report Beacon reads best. A General Ledger wins even if it was
    // dropped in second, so file order never decides which numbers the owner sees.
    const primary = uploads.find(u => ANALYZABLE_REPORTS.includes(u.reportType)) || uploads[0];

    // Merge every upload of the same type — two ledgers covering different years
    // are one portfolio. Other reports are set aside rather than blended in.
    const merged = uploads.filter(u => u.reportType === primary?.reportType);
    const rows = merged.flatMap(u => u.data);
    skippedRef.current = uploads.filter(u => u.reportType !== primary?.reportType);

    const analysis = uploads.length > 0
      ? fetch(`${API_URL}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            analysisResultRef.current = data?.isRealData ? data : null;

            // Say what powered the numbers. A file we set aside is acknowledged
            // by name — never silently dropped — but it isn't framed as a failure.
            const messages = [];
            const label = u => REPORT_LABELS[u.reportType] || REPORT_LABELS.unknown;

            if (data && !data.isRealData) {
              messages.push(
                `Analyzed ${merged.length === 1 ? merged[0].filename : `${merged.length} files`}, but couldn't find the numbers. ${data.readError} Showing sample data below so you can still explore.`
              );
            } else if (merged.length > 1) {
              messages.push(`Analyzed ${merged.length} ${label(primary)} files together as one portfolio.`);
            }

            for (const s of skippedRef.current) {
              messages.push(
                `${label(s)} noted — Beacon works from the ${label(primary)}, which carries the transaction detail behind these numbers.`
              );
            }

            if (messages.length) setNotice(messages.join(' '));

            return analysisResultRef.current;
          })
          .catch(() => null)
      : Promise.resolve(null);

    // Reveal steps one at a time. Steps come from the real analysis once it lands;
    // until then the demo steps stand in so the animation can start immediately.
    let i = 0;
    let cancelled = false;
    const interval = setInterval(() => {
      const steps = analysisResultRef.current?.scanSteps || DEMO_SCAN_STEPS;
      if (cancelled) return;
      if (i < steps.length) {
        const step = steps[i];
        setVisibleSteps(prev => [...prev, step]);
        setProgress(Math.round(((i + 1) / steps.length) * 100));
        setStatusText(step.label + '…');
        i++;
      } else {
        clearInterval(interval);
        analysis.finally(() => {
          if (cancelled) return;
          const real = analysisResultRef.current;
          if (real?.scanSteps) setVisibleSteps(real.scanSteps);
          setProgress(100);
          setStatusText('Analysis complete — see what we found.');
          setScanDone(true);
        });
      }
    }, 660);

    return () => { cancelled = true; clearInterval(interval); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCTA() {
    if (analysisResultRef.current) {
      setAnalysisResults(analysisResultRef.current);
    }
    onComplete();
  }

  return (
    <div>
      <h2 className="serif" style={{ fontSize: 32, marginBottom: 8, fontWeight: 400 }}>Analyzing your portfolio</h2>
      <p style={{ color: 'var(--ink3)', marginBottom: 28, fontSize: 14 }}>Finding the story your numbers have been trying to tell you.</p>

      {notice && scanDone && (
        <div style={{
          background: 'var(--gold-light)', border: '1px solid var(--gold)', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--ink2)',
          display: 'flex', alignItems: 'flex-start', gap: 8, animation: 'fadeUp .3s ease both',
        }}>
          <span style={{ fontSize: 14, lineHeight: 1.3 }}>◆</span>
          <span>{notice}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div style={{ padding: '4px 0' }}>
            {visibleSteps.map((step, idx) => (
              <div key={idx} className="scan-step vis">
                <div className={`scan-ico ${step.type}`}>{step.ico}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink2)' }}>{step.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 2 }}>{step.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="prog-wrap">
              <div className="prog-bar" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--green2)' : 'var(--gold)' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
              {statusText}
            </div>
          </div>
        </div>

        {scanDone && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--parchment)', display: 'flex', justifyContent: 'center', animation: 'fadeUp .3s ease both' }}>
            <button
              className="btn primary"
              onClick={handleCTA}
              style={{ padding: '12px 32px', fontSize: 15 }}
            >
              See what we found →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
