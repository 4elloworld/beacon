import { useState } from 'react';
import { DEMO_ACTIONS } from '../lib/demoData.js';

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
    primaryBtn: 'Add missing costs →',
    secondaryBtn: 'See estimates',
  },
];

export default function Remedies({ onBack }) {
  const [checked, setChecked] = useState(new Set());

  function toggle(i) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div>
      <h2 className="serif" style={{ fontSize: 32, marginBottom: 8, fontWeight: 400 }}>Remedies</h2>
      <p style={{ color: 'var(--ink3)', marginBottom: 24, fontSize: 14 }}>Problems found. Here's how to fix them — ordered by impact.</p>

      {/* Big rocks */}
      {ROCKS.map(r => (
        <div key={r.id} className={`rock ${r.cls}`}>
          <div className="rock-head">
            {r.priority}
          </div>
          <div className="rock-num">0{r.id}</div>
          <div className="rock-title">{r.title}</div>
          <div className="rock-body">{r.body}</div>
          <div className="btn-row">
            <button className="btn gold">{r.primaryBtn}</button>
            <button className="btn text-link">{r.secondaryBtn}</button>
          </div>
        </div>
      ))}

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0 24px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <div style={{ fontSize: 11, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0 }}>Additional actions</div>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Action checklist */}
      <div className="card">
        <div style={{ padding: '0 20px' }}>
          {DEMO_ACTIONS.map((a, i) => {
            const done = checked.has(i);
            return (
              <div key={i} className={`action-item${a.high ? ' high' : ''}${done ? ' done' : ''}`}>
                <div className={`action-cb${done ? ' checked' : ''}`} onClick={() => toggle(i)}>
                  {done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>✓</span>}
                </div>
                <div>
                  <div className="action-title" style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, color: done ? 'var(--ink4)' : 'var(--ink2)', textDecoration: done ? 'line-through' : 'none' }}>
                    {a.high && !done && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', marginRight: 6, verticalAlign: 'middle' }} />}
                    {a.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{a.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate full plan CTA */}
      <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 4, fontWeight: 500 }}>Want your complete action plan?</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)' }}>A full prioritized roadmap — all properties, all risks, 90-day sequence.</div>
          </div>
          <button className="btn primary">Generate full plan →</button>
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <button className="btn ghost" onClick={onBack}>← Back to portfolio</button>
      </div>
    </div>
  );
}
