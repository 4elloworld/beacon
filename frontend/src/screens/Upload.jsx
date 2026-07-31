import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { parseCSV } from '../lib/csvParser.js';

// `soon` marks a report Beacon accepts but does not analyze yet. Listing them
// shows where the product is going; the marker keeps that from reading as a
// promise the upload screen doesn't keep.
const REPORT_CONFIG = {
  general_ledger:       { label: 'General Ledger',       required: true,  desc: 'Expense ratios · Vendor anomalies · Duplicate detection · Cash flow trends' },
  income_register:      { label: 'Income Register',      required: false, soon: true, desc: 'Exact rent collected vs expected · Partial payment detection' },
  rent_roll:            { label: 'Rent Roll',             required: false, soon: true, desc: 'Lease expiry countdown · Security deposit tracker' },
  owner_expense_report: { label: 'Owner Expense Report', required: false, soon: true, desc: 'Full vendor name visibility · Expense category breakdown' },
  cash_flow_detail:     { label: 'Cash Flow Detail',     required: false, soon: true, desc: 'Monthly net by property · Distribution verification' },
  property_performance: { label: 'Property Performance', required: false, soon: true, desc: 'Per-property rent roll-up · Management fee rates' },
};

export default function Upload({ onNext }) {
  const { setPortfolioData } = useApp();
  const [detectedReports, setDetectedReports] = useState({}); // by type — drives the "unlocks" cards
  const [uploadedFiles, setUploadedFiles] = useState([]);     // every file, in order
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    setError('');
    try {
      const result = await parseCSV(file);
      setDetectedReports(prev => ({ ...prev, [result.reportType]: result }));
      setUploadedFiles(prev => [...prev, result]);
      setPortfolioData(prev => ({
        ...(prev || {}),
        uploads: [...((prev?.uploads) || []), result],
      }));
    } catch {
      setError("We couldn't read that file — please check it's a CSV export from AppFolio, Buildium, or Propertyware.");
    }
  }, [setPortfolioData]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(handleFile);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const hasUpload = Object.keys(detectedReports).length > 0;

  return (
    <div>
      {/* Header — compact */}
      <div style={{ marginBottom: 16 }}>
        <h2 className="serif" style={{ fontSize: 28, marginBottom: 4, fontWeight: 400 }}>Start with what you have.</h2>
        <p style={{ color: 'var(--ink3)', fontSize: 13, maxWidth: 560 }}>
          One file is enough to begin. Your General Ledger alone unlocks 8 insights most investors have never seen.
        </p>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card">
        <div className="card-body" style={{ padding: '16px 20px' }}>

          {/* Drop zone — compact */}
          <div
            className={`drop-zone compact${isDragging ? ' dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <div className="upload-icon-wrap" style={{ width: 36, height: 36, flexShrink: 0, margin: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <div className="serif" style={{ fontSize: 16, fontWeight: 500 }}>Drop your CSV files here or click to browse</div>
                <div style={{ fontSize: 12, color: 'var(--ink4)' }}>AppFolio · Buildium · Propertyware · any export works</div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => Array.from(e.target.files).forEach(handleFile)}
            />
          </div>

          {/* Upload confirmations */}
          {hasUpload && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {/* Listed per file, not per report type — two ledgers are two rows,
                  and the filename identifies a file whose format we don't know. */}
              {uploadedFiles.map((result, i) => (
                <div key={`${result.filename}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--green-light)', border: '1px solid #B8D9CA', borderRadius: 'var(--radius)', animation: 'fadeUp .25s ease both' }}>
                  <span style={{ color: 'var(--green2)', fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--ink2)', minWidth: 0 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.filename}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink4)' }}>
                      {REPORT_CONFIG[result.reportType]?.label || 'Format not recognized'}
                      {' · '}{result.rowCount.toLocaleString()} {result.rowCount === 1 ? 'row' : 'rows'}
                      {result.dateRange && ` · ${result.dateRange.start} – ${result.dateRange.end}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Compact report cards */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>What each report unlocks</div>
            <div className="report-grid-compact">
              {Object.entries(REPORT_CONFIG).map(([type, config]) => {
                const found = !!detectedReports[type];
                return (
                  <div key={type} className={`report-card-compact${found ? ' found' : ''}${config.required ? ' required' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div className={`report-icon-sm ${found ? 'found' : config.required ? 'req' : 'opt'}`}>
                        {found ? '✓' : config.required ? '★' : '+'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: found ? 'var(--green2)' : config.required ? 'var(--gold-dark)' : 'var(--ink2)', flex: 1 }}>
                        {config.label}
                      </div>
                      {found && (
                        <span className="pill green" style={{ fontSize: 9, padding: '1px 5px' }}>
                          <span className="pdot" />{config.soon ? 'Received' : 'Uploaded'}
                        </span>
                      )}
                      {!found && config.required && <span className="pill gold" style={{ fontSize: 9, padding: '1px 5px' }}><span className="pdot" />Required</span>}
                      {!found && config.soon && (
                        <span style={{ fontSize: 9, color: 'var(--ink4)', fontStyle: 'italic', flexShrink: 0 }}>soon</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink4)', lineHeight: 1.4 }}>{config.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--parchment)' }}>
          <button className="btn primary" onClick={onNext}>Analyze my portfolio →</button>
        </div>
      </div>
    </div>
  );
}
