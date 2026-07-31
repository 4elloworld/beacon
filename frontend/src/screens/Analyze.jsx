import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { DEMO_SCAN_STEPS } from '../lib/demoData.js';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Analyze({ onComplete, alreadyDone }) {
  const { portfolioData, setAnalysisResults } = useApp();
  const analysisResultRef = useRef(null);

  // If returning to this screen after scan completed, show done state immediately
  const [visibleSteps, setVisibleSteps] = useState(alreadyDone ? DEMO_SCAN_STEPS : []);
  const [progress, setProgress] = useState(alreadyDone ? 100 : 0);
  const [statusText, setStatusText] = useState(alreadyDone ? 'Analysis complete — see what we found.' : 'Starting analysis…');
  const [scanDone, setScanDone] = useState(alreadyDone);

  useEffect(() => {
    if (alreadyDone) return; // already ran — don't re-animate

    // Kick off backend analysis in parallel — result stored for when user clicks CTA
    const uploads = portfolioData?.uploads || [];
    if (uploads.length > 0) {
      fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: uploads[0].data }),
      })
        .then(r => r.json())
        .then(data => { analysisResultRef.current = data; })
        .catch(() => {}); // gracefully fall back to demo data
    }

    // Animation loop — runs regardless of backend state
    let i = 0;
    const interval = setInterval(() => {
      if (i < DEMO_SCAN_STEPS.length) {
        const step = DEMO_SCAN_STEPS[i];
        setVisibleSteps(prev => [...prev, step]);
        setProgress(Math.round(((i + 1) / DEMO_SCAN_STEPS.length) * 100));
        setStatusText(step.label + '…');
        i++;
      } else {
        clearInterval(interval);
        setStatusText('Analysis complete — see what we found.');
        setScanDone(true);
      }
    }, 660);

    return () => clearInterval(interval);
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
