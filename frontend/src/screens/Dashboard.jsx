import { useRef, useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { useApp } from '../context/AppContext.jsx';
import { DEMO_PROPERTIES, DEMO_FLAGS, DEMO_KPIS } from '../lib/demoData.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const fmt = n => '$' + Math.abs(n).toLocaleString();

// Annual estimates for each cost type (portfolio-wide)
const COST_ESTIMATES_ANNUAL = {
  property_tax:  32000,
  insurance:     12000,
  mortgage:      0,       // no estimate — must be entered manually
  landscaping:   9000,
  reserves:      9372,
};

const COST_ITEMS = [
  { type: 'property_tax', label: 'Property taxes',          impact: '~$32K/yr est.',  hasEstimate: true },
  { type: 'insurance',    label: 'Landlord insurance',      impact: '~$12K/yr est.',  hasEstimate: true },
  { type: 'mortgage',     label: 'Mortgage / debt service', impact: 'varies',         hasEstimate: false },
  { type: 'landscaping',  label: 'Lawn & landscaping',      impact: '~$9K/yr est.',   hasEstimate: true },
  { type: 'reserves',     label: 'Capital reserves (5%)',   impact: '~$9,372/yr est.', hasEstimate: true },
];

const COST_LABELS = {
  property_tax: 'taxes',
  insurance: 'insurance',
  mortgage: 'mortgage',
  landscaping: 'landscaping',
  reserves: 'reserves',
};

function computeAddedCosts(costState) {
  let total = 0;
  const addedTypes = [];
  for (const [type, state] of Object.entries(costState)) {
    let amt = 0;
    if (state.mode === 'manual' && state.value) {
      amt = parseFloat(state.value) || 0;
    } else if (state.mode === 'est') {
      amt = COST_ESTIMATES_ANNUAL[type] || 0;
    }
    if (amt > 0) { total += amt; addedTypes.push(type); }
  }
  return { total, addedTypes };
}

// Simple count-up hook
function useCountUp(target, duration = 500) {
  const [current, setCurrent] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    prevRef.current = target;
    const start = Date.now();
    const animate = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setCurrent(Math.round(from + (target - from) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}

export default function Dashboard({ onKeyTakeaways }) {
  const {
    completenessPercent,
    toggleGlobalConceal, togglePropertyConceal, isConcealed, concealState,
    costState, updateCost,
  } = useApp();

  const concealed = concealState.global;
  const [costsOpen, setCostsOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const prevAddedRef = useRef(0);

  // Compute added costs
  const { total: addedCosts, addedTypes } = computeAddedCosts(costState);
  const hasCosts = addedCosts > 0;

  // Flash KPI cards when costs change
  useEffect(() => {
    if (addedCosts !== prevAddedRef.current) {
      prevAddedRef.current = addedCosts;
      if (addedCosts > 0) {
        setIsFlashing(true);
        const t = setTimeout(() => setIsFlashing(false), 700);
        return () => clearTimeout(t);
      }
    }
  }, [addedCosts]);

  // True expense ratio calculation
  const baseRatio = DEMO_KPIS.baseExpenseRatio;
  const trueRatioRaw = hasCosts
    ? Math.round(((DEMO_KPIS.totalExpenses + addedCosts) / DEMO_KPIS.rentCollected) * 100)
    : baseRatio;
  const displayTrueRatio = useCountUp(trueRatioRaw);

  // Delta label: "taxes + insurance"
  const deltaLabel = addedTypes.map(t => COST_LABELS[t]).join(' + ');

  function getAddr(p) {
    if (isConcealed(p.id)) {
      return { line1: `•• ${p.street}`, line2: `#${p.num.slice(-2)} · ${p.city}`, concealed: true };
    }
    return { line1: `${p.num} ${p.street}`, line2: p.city, concealed: false };
  }

  const pctLabel = completenessPercent >= 80 ? 'strong data picture' : completenessPercent >= 65 ? 'good coverage' : 'based on uploaded data only';
  const pctColor = completenessPercent >= 80 ? 'var(--green2)' : completenessPercent >= 65 ? 'var(--blue)' : 'var(--gold)';
  const concealCount = DEMO_PROPERTIES.filter(p => isConcealed(p.id)).length;
  const concealStatus = concealCount === 0 ? 'all visible' : concealCount === DEMO_PROPERTIES.length ? 'all concealed' : `${concealCount} of ${DEMO_PROPERTIES.length} concealed`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="serif" style={{ fontSize: 32, marginBottom: 4, fontWeight: 400 }}>Your portfolio</h2>
          <div style={{ fontSize: 13, color: 'var(--ink4)' }}>{DEMO_KPIS.propertyCount} properties · {DEMO_KPIS.dateRange}</div>
        </div>
        <div className="btn-row">
          <button className="btn sm" onClick={toggleGlobalConceal}>
            🔒 {concealed ? 'Reveal all' : 'Conceal addresses'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--ink4)' }}>{concealStatus}</span>
          <button className="btn primary" onClick={onKeyTakeaways}>Key Takeaways →</button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi success"><div className="kpi-label">Rent collected</div><div className="kpi-val">{fmt(DEMO_KPIS.rentCollected)}</div><div className="kpi-sub">{DEMO_KPIS.dateRange}</div></div>

        <div className={`kpi danger${isFlashing ? ' kpi-flash' : ''}`}>
          <div className="kpi-label">Total expenses</div>
          <div className="kpi-val">{fmt(DEMO_KPIS.totalExpenses + (hasCosts ? addedCosts : 0))}</div>
          <div className="kpi-sub">{hasCosts ? `includes ${fmt(addedCosts)} added costs` : 'expenses above rent'}</div>
        </div>

        <div className={`kpi danger${isFlashing ? ' kpi-flash' : ''}`}>
          <div className="kpi-label">Net position</div>
          <div className="kpi-val">-{fmt(Math.abs(DEMO_KPIS.netPosition) + (hasCosts ? addedCosts : 0))}</div>
          <div className="kpi-sub">{hasCosts ? 'including added costs' : 'from uploaded data'}</div>
        </div>

        <div className="kpi warning">
          <div className="kpi-label">Owner contributed</div>
          <div className="kpi-val">{fmt(DEMO_KPIS.ownerContributed)}</div>
          <div className="kpi-sub">added from personal funds</div>
        </div>

        <div className="kpi danger">
          <div className="kpi-label">Flags detected</div>
          <div className="kpi-val">{DEMO_KPIS.flagCount}</div>
          <div className="kpi-sub">need your attention</div>
        </div>

        {/* True expense ratio — locked until first cost entered */}
        <div className={`kpi${hasCosts ? ' danger kpi-flash' : ' ghost'}`} key={hasCosts ? 'unlocked' : 'locked'}>
          <div className="kpi-label">True expense ratio</div>
          {hasCosts ? (
            <>
              <div className="kpi-val" style={{ fontSize: 22 }}>{displayTrueRatio}%</div>
              <div className="kpi-sub" style={{ color: 'var(--red)' }}>
                {baseRatio}% → {trueRatioRaw}% after {deltaLabel}
              </div>
              {trueRatioRaw > baseRatio && (
                <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4, fontWeight: 500 }}>
                  Your true picture is more significant than AppFolio shows
                </div>
              )}
            </>
          ) : (
            <>
              <div className="kpi-val" style={{ fontSize: 16, color: 'var(--ink4)', fontWeight: 400 }}>—</div>
              <div className="kpi-sub">
                <button
                  className="link"
                  style={{ fontSize: 11, color: 'var(--gold-dark)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
                  onClick={() => setCostsOpen(true)}
                >
                  add costs to unlock
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Missing costs collapsible panel */}
      <div className="costs-panel" style={{ marginBottom: 16 }}>
        <button
          className="costs-panel-toggle"
          onClick={() => setCostsOpen(o => !o)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: hasCosts ? 'var(--green2)' : 'var(--ink2)' }}>
              {hasCosts ? `✓ Missing costs added — ${fmt(addedCosts)}/yr` : 'Missing costs — add to unlock true expense ratio'}
            </span>
            {!hasCosts && (
              <span style={{ fontSize: 11, color: 'var(--ink4)' }}>property taxes · insurance · mortgage · reserves</span>
            )}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink4)', flexShrink: 0 }}>
            {costsOpen ? '▲ Collapse' : '▼ Expand'}
          </span>
        </button>

        {costsOpen && (
          <div className="costs-panel-body" style={{ animation: 'fadeUp .2s ease both' }}>
            <div style={{ fontSize: 12, color: 'var(--ink4)', marginBottom: 14 }}>
              Each cost you add recalculates your KPIs and true expense ratio instantly. All optional.
            </div>
            {COST_ITEMS.map(item => {
              const state = costState[item.type];
              return (
                <div key={item.type} className="enhance-row">
                  <div className="enhance-top">
                    <div className="enhance-label">{item.label}</div>
                    <div className="enhance-impact">{item.impact}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <button className={`ebtn${state.mode === 'na' ? ' na' : ''}`} onClick={() => updateCost(item.type, 'na')}>Not applicable</button>
                    {item.hasEstimate && (
                      <button className={`ebtn${state.mode === 'est' ? ' est' : ''}`} onClick={() => updateCost(item.type, 'est')}>
                        Use estimate ({item.impact})
                      </button>
                    )}
                    <button className={`ebtn${state.mode === 'manual' ? ' manual' : ''}`} onClick={() => updateCost(item.type, 'manual')}>
                      I know this: $
                      <input
                        className="einput"
                        type="number"
                        placeholder="0"
                        value={state.value || ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateCost(item.type, 'manual', e.target.value)}
                        style={{ marginLeft: 4 }}
                      />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Completeness meter */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: pctColor, fontFamily: 'var(--serif)', minWidth: 44 }}>{completenessPercent}%</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5, color: 'var(--ink2)' }}>
                    Dashboard completeness — <span style={{ color: pctColor }}>{pctLabel}</span>
                  </div>
                  <div className="prog-wrap">
                    <div className="prog-bar" style={{ width: `${completenessPercent}%`, background: pctColor, transition: 'width .4s ease' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* P&L chart */}
      <div className="card">
        <div className="card-head">
          <span className="card-label">Property P&amp;L — rent vs expenses</span>
          <span style={{ fontSize: 11, color: 'var(--red)' }}>5 of 6 properties running at a loss</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: 'var(--ink4)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#3B8BD4', display: 'inline-block' }} />Rent</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#8B2230', display: 'inline-block' }} />Expenses</span>
          </div>
          <div className="chart-wrap">
            <Bar
              data={{
                labels: DEMO_PROPERTIES.map(p => p.street.split(' ').slice(0, 2).join(' ')),
                datasets: [
                  { label: 'Rent', data: DEMO_PROPERTIES.map(p => p.rent), backgroundColor: '#3B8BD4', borderWidth: 0, borderRadius: 4 },
                  { label: 'Expenses', data: DEMO_PROPERTIES.map(p => p.exp), backgroundColor: '#8B2230', borderWidth: 0, borderRadius: 4 },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' $' + (ctx.raw / 1000).toFixed(1) + 'k' } } },
                scales: {
                  x: { ticks: { font: { size: 11, family: 'Outfit' }, autoSkip: false, maxRotation: 30 }, grid: { display: false } },
                  y: { ticks: { font: { size: 11, family: 'Outfit' }, callback: v => '$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: 'rgba(0,0,0,.04)' } },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Property health */}
      <div className="card">
        <div className="card-head">
          <span className="card-label">Property health scores</span>
          <span style={{ fontSize: 11, color: 'var(--ink4)' }}>hover to conceal · click to explore</span>
        </div>
        <div className="prop-grid">
          {DEMO_PROPERTIES.map(p => {
            const addr = getAddr(p);
            const ratio = Math.round((p.exp / p.rent) * 100);
            const statusPill = { red: <span className="pill red"><span className="pdot" />Critical</span>, amber: <span className="pill amber"><span className="pdot" />Needs attention</span>, green: <span className="pill green"><span className="pdot" />Good</span> }[p.status];
            const rc = p.status === 'red' ? 'var(--red)' : p.status === 'amber' ? 'var(--amber)' : 'var(--green2)';
            return (
              <div key={p.id} className="prop-card">
                <button className="prop-lock-btn" onClick={() => togglePropertyConceal(p.id)} title={addr.concealed ? 'Reveal address' : 'Conceal address'}>
                  {addr.concealed ? '🔓' : '🔒'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, paddingRight: 30 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: addr.concealed ? 'var(--gold)' : 'var(--ink2)' }}>{addr.line1}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 1 }}>{addr.line2}</div>
                  </div>
                  {statusPill}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div style={{ background: 'var(--parchment)', borderRadius: 6, padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Rent</div>
                    <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--green)' }}>${(p.rent / 1000).toFixed(0)}k</div>
                  </div>
                  <div style={{ background: 'var(--parchment)', borderRadius: 6, padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Expenses</div>
                    <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--red)' }}>${(p.exp / 1000).toFixed(0)}k</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: rc, fontWeight: 500, marginBottom: 3 }}>{ratio}% expense ratio</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{p.note}</div>
                {p.late > 0 && <div style={{ marginTop: 6 }}><span className="pill red"><span className="pdot" />{p.late} late fees</span></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Anomaly flags */}
      <div className="card">
        <div className="card-head">
          <span className="card-label">Anomaly flags</span>
          <span className="pill red"><span className="pdot" />7 items · click any to explore</span>
        </div>
        {DEMO_FLAGS.map((f, i) => (
          <div key={i} className="flag-row">
            <span className={`pill ${f.sev}`} style={{ flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
              <span className="pdot" />{f.sev === 'red' ? 'Critical' : 'Review'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink2)', marginBottom: 3 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{f.sub}</div>
            </div>
            <span className="flag-arrow">→</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button className="btn primary" onClick={onKeyTakeaways}>Key Takeaways →</button>
      </div>
    </div>
  );
}
