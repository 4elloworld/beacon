import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { buildInsights } from '../lib/insights.js';

const PILL = { red: 'red', amber: 'amber', blue: 'blue' };

const ROCKS = [
  {
    id: 1, cls: 'r1', priority: <span className="pill red"><span className="pdot" />Most urgent</span>,
    title: 'Demand receipts for every unnamed repair charge',
    body: '$15,840 in repairs — zero vendor names. Three duplicate charge pairs. Four charges logged on the same day. This is the most likely place charges need verification. A written request for itemized receipts gives your property manager the opportunity to provide documentation — and may recover money already paid.',
    primaryBtn: 'Draft request letter →',
    secondaryBtn: 'See total at risk',
  },
  {
    id: 2, cls: 'r2', priority: <span className="pill amber"><span className="pdot" />This month</span>,
    title: 'Decide on the chronic late-payer lease renewal',
    body: '11 late fees and 2 bounced checks in 8 months is a pattern — not a streak of bad luck. The lease renewal decision is worth making before renewal paperwork is signed. Another year with this tenant carries the same risk profile — on a property already running at 109% expense ratio.',
    primaryBtn: 'Assess tenant risk →',
    secondaryBtn: 'Know your options',
  },
  {
    id: 3, cls: 'r3', priority: <span className="pill blue">This quarter</span>,
    title: 'Build your true cost picture',
    body: 'Your dashboard reflects AppFolio data only. Property taxes, landlord insurance, and capital reserves are real costs not captured here. On a 6-property portfolio these could add $28,000–$48,000 per year. Until you see that number you cannot make a confident hold, sell, or refinance decision on any property.',
    primaryBtn: 'Enhance my data →',
    secondaryBtn: 'See estimates',
  },
];

export default function YourMove({ onBack, onNext }) {
  const [dismissed, setDismissed] = useState(new Set());
  const { analysisResults } = useApp();
  const insights = buildInsights(analysisResults);

  const rocks = insights
    ? insights.rocks.map((r, i) => ({
        ...r,
        id: i + 1,
        priority: (
          <span className={`pill ${PILL[r.priority.kind]}`}>
            {r.priority.kind !== 'blue' && <span className="pdot" />}
            {r.priority.text}
          </span>
        ),
      }))
    : ROCKS;

  function dismiss(id) {
    setDismissed(prev => new Set([...prev, id]));
  }

  const visible = rocks.filter(r => !dismissed.has(r.id));

  return (
    <div>
      <h2 className="serif" style={{ fontSize: 32, marginBottom: 8, fontWeight: 400 }}>Your move.</h2>
      <p style={{ color: 'var(--ink3)', marginBottom: 24, fontSize: 14 }}>
        The highest-impact actions from your data. Dismiss anything that doesn't apply.
      </p>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink4)' }}>
          <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, marginBottom: 8, color: 'var(--ink3)' }}>You've cleared your rocks.</h3>
          <p style={{ fontSize: 13, color: 'var(--ink4)', marginBottom: 20 }}>There's more on your list — here's what's next.</p>
          <button className="btn primary" onClick={onNext}>Keep going →</button>
        </div>
      ) : (
        visible.map(r => (
          <div key={r.id} className={`rock ${r.cls}`}>
            <div className="rock-head">
              {r.priority}
              <button className="rock-dismiss" onClick={() => dismiss(r.id)} title="Dismiss">✕</button>
            </div>
            <div className="rock-num">0{r.id}</div>
            <div className="rock-title">{r.title}</div>
            <div className="rock-body">{r.body}</div>
            <div className="btn-row">
              <button className="btn gold">{r.primaryBtn}</button>
              <button className="btn text-link">{r.secondaryBtn}</button>
            </div>
          </div>
        ))
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <button className="btn ghost" onClick={onBack}>← Back to portfolio</button>
        <button className="btn" onClick={onNext}>Keep going →</button>
      </div>
    </div>
  );
}
