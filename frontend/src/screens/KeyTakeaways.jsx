import BeaconDot from '../components/BeaconDot.jsx';
import { useApp } from '../context/AppContext.jsx';
import { buildInsights } from '../lib/insights.js';
import { costsSummary } from '../lib/costs.js';
import { DEMO_KPIS } from '../lib/demoData.js';

const CALLOUTS = [
  { type: 'red',   icon: '⚠', body: <><strong>5 of 6 properties are running at a loss.</strong> Not one of them has expenses below rent collected. One property is spending $1.58 for every $1.00 earned. This isn't bad luck — it's a structural problem that's been invisible until now.</> },
  { type: 'red',   icon: '⚠', body: <><strong>$15,840 in repairs with zero vendor names.</strong> 22 charges labeled only "Repairs." Three identical amounts in the same month. Four charges on the same day. This is where charges become impossible to verify.</> },
  { type: 'amber', icon: '!',  body: <><strong>One property has a chronic late-paying tenant.</strong> 11 late fees and 2 bounced checks across 8 months. That lease renewal decision is worth making before it expires.</> },
  { type: 'amber', icon: '!', incomplete: true, body: <><strong>Your picture is still incomplete.</strong> Property taxes, insurance, and mortgage aren't in this data. Your expense ratios are already significant — the true numbers may be higher.</> },
  { type: 'green', icon: '✓',  body: <><strong>You found this now.</strong> Not next April. The same data that revealed these problems now guides every next move. Here are the three most important ones.</> },
];

export default function KeyTakeaways({ onNext }) {
  const { analysisResults, costState } = useApp();

  const isReal = Boolean(analysisResults?.isRealData);
  const propertyCount = isReal ? analysisResults.propertyCount : DEMO_KPIS.propertyCount;
  const rentCollected = isReal ? analysisResults.totalRent : DEMO_KPIS.rentCollected;
  const totalExpenses = isReal ? analysisResults.totalExpenses : DEMO_KPIS.totalExpenses;
  const baseRatio     = isReal ? analysisResults.baseExpenseRatio : DEMO_KPIS.baseExpenseRatio;

  const costs = costsSummary(costState, propertyCount, rentCollected);
  const insights = buildInsights(analysisResults, costs);

  let callouts;
  if (insights) {
    callouts = insights.callouts.map(c => ({
      type: c.type, icon: c.icon,
      body: <><strong>{c.lead}</strong>{c.rest}</>,
    }));
  } else {
    // Sample copy, minus the "still incomplete" line once costs have been added —
    // it would contradict the dashboard the owner just filled in.
    callouts = CALLOUTS.filter(c => !(costs.total > 0 && c.incomplete));
    if (costs.total > 0) {
      const trueRatio = Math.round(((totalExpenses + costs.total) / rentCollected) * 100);
      callouts = [
        ...callouts.slice(0, -1),
        {
          type: 'amber', icon: '!',
          body: <>
            <strong>You've added ${Math.round(costs.total).toLocaleString()} of costs the export didn't carry.</strong>
            {` That moves your expense ratio from ${baseRatio}% to ${trueRatio}% — the truer picture of what this portfolio costs to run.`}
          </>,
        },
        callouts[callouts.length - 1],
      ];
    }
  }

  return (
    <div>
      <div className="card">
        <div className="congrats-hero">
          <div style={{ width: 56, height: 56, margin: '0 auto 16px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-light)', border: '1.5px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BeaconDot size={14} />
            </div>
          </div>
          <h2 className="serif" style={{ fontSize: 28, fontWeight: 500, marginBottom: 12 }}>Key Takeaways</h2>
          <p style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.8, maxWidth: 520, margin: '0 auto' }}>
            You let your own data speak — probably for the first time. Most property owners only find out what's wrong at tax time, when it's already too late. The light is on now. Here's what it revealed.
          </p>
        </div>
        <div className="card-body">
          <div className="sec-title" style={{ marginBottom: 14 }}>What Beacon found in your portfolio</div>
          {callouts.map((c, i) => (
            <div key={i} className={`callout ${c.type}`}>
              <div style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{c.icon}</div>
              <div className="callout-body">{c.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky-cta">
        <button className="btn primary" onClick={onNext} style={{ padding: '12px 28px', fontSize: 14 }}>Show me my move →</button>
      </div>
    </div>
  );
}
