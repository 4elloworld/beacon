import { useRef, useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { useApp } from '../context/AppContext.jsx';
import { DEMO_PROPERTIES, DEMO_FLAGS, DEMO_KPIS } from '../lib/demoData.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const fmt = n => '$' + Math.round(Math.abs(n)).toLocaleString();

// Compact money for the tight property-card tiles: $9.4k, $850, $1.2M
const compact = n => {
  const v = Math.abs(n);
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 10_000) return '$' + Math.round(v / 1000) + 'k';
  if (v >= 1_000) return '$' + (v / 1000).toFixed(1) + 'k';
  return '$' + Math.round(v).toLocaleString();
};

// Per-property annual estimates, scaled to the portfolio actually loaded.
const COST_ESTIMATES_PER_PROPERTY = {
  property_tax: 5333,
  insurance:    2000,
  mortgage:     0,     // no estimate — must be entered manually
  landscaping:  1500,
};

// Reserves are conventionally a share of rent rather than a per-door figure.
const RESERVE_RATE = 0.05;

function estimatesFor(propertyCount, rentCollected) {
  const n = Math.max(propertyCount || 1, 1);
  return {
    property_tax: COST_ESTIMATES_PER_PROPERTY.property_tax * n,
    insurance:    COST_ESTIMATES_PER_PROPERTY.insurance * n,
    mortgage:     0,
    landscaping:  COST_ESTIMATES_PER_PROPERTY.landscaping * n,
    reserves:     Math.round((rentCollected || 0) * RESERVE_RATE),
  };
}

const shortMoney = n => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`);

function costItemsFor(est) {
  return [
    { type: 'property_tax', label: 'Property taxes',          impact: `~${shortMoney(est.property_tax)}/yr est.`, hasEstimate: true },
    { type: 'insurance',    label: 'Landlord insurance',      impact: `~${shortMoney(est.insurance)}/yr est.`,    hasEstimate: true },
    { type: 'mortgage',     label: 'Mortgage / debt service', impact: 'varies',                                    hasEstimate: false },
    { type: 'landscaping',  label: 'Lawn & landscaping',      impact: `~${shortMoney(est.landscaping)}/yr est.`,  hasEstimate: true },
    { type: 'reserves',     label: 'Capital reserves (5%)',   impact: `~${shortMoney(est.reserves)}/yr est.`,     hasEstimate: true },
  ];
}

const COST_LABELS = {
  property_tax: 'taxes',
  insurance: 'insurance',
  mortgage: 'mortgage',
  landscaping: 'landscaping',
  reserves: 'reserves',
};

function computeAddedCosts(costState, estimates) {
  let total = 0;
  const addedTypes = [];
  for (const [type, state] of Object.entries(costState)) {
    let amt = 0;
    if (state.mode === 'manual' && state.value) {
      amt = parseFloat(state.value) || 0;
    } else if (state.mode === 'est') {
      amt = estimates[type] || 0;
    }
    if (amt > 0) { total += amt; addedTypes.push(type); }
  }
  return { total, addedTypes };
}

// Counts up to `target`. The animation is decoration — a timer guarantees the
// final value lands even where requestAnimationFrame is throttled or never runs
// (background tab, low-power mode, reduced motion), so the headline figure is
// never left showing a stale number.
function useCountUp(target, duration = 500) {
  const [current, setCurrent] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    prevRef.current = target;

    let frame = null;
    const start = Date.now();
    const animate = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setCurrent(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    const settle = setTimeout(() => setCurrent(target), duration + 50);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [target, duration]);

  return current;
}

export default function Dashboard({ onKeyTakeaways }) {
  const {
    completenessPercent,
    toggleGlobalConceal, togglePropertyConceal, isConcealed, concealState,
    costState, updateCost, analysisResults,
  } = useApp();

  // Real analysis when a file was uploaded and the backend responded; demo data otherwise.
  const isReal = Boolean(analysisResults?.isRealData && analysisResults.properties?.length);
  const PROPERTIES = isReal ? analysisResults.properties : DEMO_PROPERTIES;
  const FLAGS = isReal ? analysisResults.flags : DEMO_FLAGS;
  const KPIS = isReal
    ? {
        propertyCount: analysisResults.propertyCount,
        dateRange: analysisResults.dateRange,
        rentCollected: analysisResults.totalRent,
        totalExpenses: analysisResults.totalExpenses,
        netPosition: analysisResults.netPosition,
        ownerContributed: 0,
        flagCount: analysisResults.flagCount,
        baseExpenseRatio: analysisResults.baseExpenseRatio,
      }
    : DEMO_KPIS;

  const lossCount = PROPERTIES.filter(p => (p.exp || 0) > (p.rent || 0)).length;

  const concealed = concealState.global;
  const [costsOpen, setCostsOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showAllFlags, setShowAllFlags] = useState(false);
  const prevAddedRef = useRef(0);

  const visibleFlags = showAllFlags ? FLAGS : FLAGS.slice(0, 12);
  // A bar per property stops being readable past ~14; show the worst ratios.
  const chartProps = PROPERTIES.length > 14 ? PROPERTIES.slice(0, 14) : PROPERTIES;

  // Compute added costs against estimates sized to this portfolio
  const estimates = estimatesFor(KPIS.propertyCount, KPIS.rentCollected);
  const COST_ITEMS = costItemsFor(estimates);
  const { total: addedCosts, addedTypes } = computeAddedCosts(costState, estimates);
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
  const baseRatio = KPIS.baseExpenseRatio;
  const trueRatioRaw = hasCosts && KPIS.rentCollected > 0
    ? Math.round(((KPIS.totalExpenses + addedCosts) / KPIS.rentCollected) * 100)
    : baseRatio;
  const displayTrueRatio = useCountUp(trueRatioRaw);
  const netPosition = KPIS.netPosition - (hasCosts ? addedCosts : 0);

  // Delta label: "taxes + insurance"
  const deltaLabel = addedTypes.map(t => COST_LABELS[t]).join(' + ');

  function getAddr(p) {
    const num = p.num || '';
    if (isConcealed(p.id)) {
      const masked = num ? `#${num.slice(-2)}` : '#••';
      return { line1: `•• ${p.street}`, line2: [masked, p.city].filter(Boolean).join(' · '), concealed: true };
    }
    return { line1: [num, p.street].filter(Boolean).join(' '), line2: p.city, concealed: false };
  }

  const pctLabel = completenessPercent >= 80 ? 'strong data picture' : completenessPercent >= 65 ? 'good coverage' : 'based on uploaded data only';
  const pctColor = completenessPercent >= 80 ? 'var(--green2)' : completenessPercent >= 65 ? 'var(--blue)' : 'var(--gold)';
  const concealCount = PROPERTIES.filter(p => isConcealed(p.id)).length;
  const concealStatus = concealCount === 0 ? 'all visible' : concealCount === PROPERTIES.length ? 'all concealed' : `${concealCount} of ${PROPERTIES.length} concealed`;

  return (
    <div>
      {!isReal && (
        <div style={{
          background: 'var(--gold-light)', border: '1px solid var(--gold)', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--ink2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>◆</span>
          <span><strong>Sample portfolio.</strong> Upload a General Ledger CSV to see your own numbers here.</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="serif" style={{ fontSize: 32, marginBottom: 4, fontWeight: 400 }}>Your portfolio</h2>
          <div style={{ fontSize: 13, color: 'var(--ink4)' }}>
            {KPIS.propertyCount} {KPIS.propertyCount === 1 ? 'property' : 'properties'} · {KPIS.dateRange}
          </div>
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
        <div className="kpi success"><div className="kpi-label">Rent collected</div><div className="kpi-val">{fmt(KPIS.rentCollected)}</div><div className="kpi-sub">{KPIS.dateRange}</div></div>

        <div className={`kpi danger${isFlashing ? ' kpi-flash' : ''}`}>
          <div className="kpi-label">Total expenses</div>
          <div className="kpi-val">{fmt(KPIS.totalExpenses + (hasCosts ? addedCosts : 0))}</div>
          <div className="kpi-sub">
            {hasCosts ? `includes ${fmt(addedCosts)} added costs` : `${baseRatio}% of rent collected`}
          </div>
        </div>

        <div className={`kpi ${netPosition < 0 ? 'danger' : 'success'}${isFlashing ? ' kpi-flash' : ''}`}>
          <div className="kpi-label">Net position</div>
          <div className="kpi-val">{netPosition < 0 ? '-' : ''}{fmt(netPosition)}</div>
          <div className="kpi-sub">
            {hasCosts ? 'including added costs' : isReal ? 'from uploaded data' : 'from sample data'}
          </div>
        </div>

        {KPIS.ownerContributed > 0 && (
          <div className="kpi warning">
            <div className="kpi-label">Owner contributed</div>
            <div className="kpi-val">{fmt(KPIS.ownerContributed)}</div>
            <div className="kpi-sub">added from personal funds</div>
          </div>
        )}

        <div className={`kpi ${KPIS.flagCount > 0 ? 'danger' : 'success'}`}>
          <div className="kpi-label">Flags detected</div>
          <div className="kpi-val">{KPIS.flagCount}</div>
          <div className="kpi-sub">{KPIS.flagCount > 0 ? 'need your attention' : 'nothing flagged'}</div>
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
                        Use estimate
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
          <span className="card-label">
            Property P&amp;L — rent vs expenses
            {chartProps.length < PROPERTIES.length && ` (top ${chartProps.length} by expense ratio)`}
          </span>
          <span style={{ fontSize: 11, color: lossCount > 0 ? 'var(--red)' : 'var(--green2)' }}>
            {lossCount > 0
              ? `${lossCount} of ${PROPERTIES.length} ${PROPERTIES.length === 1 ? 'property' : 'properties'} running at a loss`
              : 'All properties cash-flow positive'}
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: 'var(--ink4)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#3B8BD4', display: 'inline-block' }} />Rent</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#8B2230', display: 'inline-block' }} />Expenses</span>
          </div>
          <div className="chart-wrap">
            <Bar
              data={{
                labels: chartProps.map(p => p.street.split(' ').slice(0, 2).join(' ')),
                datasets: [
                  { label: 'Rent', data: chartProps.map(p => p.rent), backgroundColor: '#3B8BD4', borderWidth: 0, borderRadius: 4 },
                  { label: 'Expenses', data: chartProps.map(p => p.exp), backgroundColor: '#8B2230', borderWidth: 0, borderRadius: 4 },
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
          {PROPERTIES.map(p => {
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
                    <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--green)' }}>{compact(p.rent)}</div>
                  </div>
                  <div style={{ background: 'var(--parchment)', borderRadius: 6, padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Expenses</div>
                    <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--red)' }}>{compact(p.exp)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: rc, fontWeight: 500, marginBottom: 3 }}>{ratio}% expense ratio</div>
                {p.note && <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{p.note}</div>}
                {p.late > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span className="pill red">
                      <span className="pdot" />{p.late} late {p.late === 1 ? 'fee' : 'fees'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Anomaly flags */}
      <div className="card">
        <div className="card-head">
          <span className="card-label">Anomaly flags</span>
          <span className={`pill ${FLAGS.length > 0 ? 'red' : 'green'}`}>
            <span className="pdot" />{FLAGS.length} item{FLAGS.length === 1 ? '' : 's'} · click any to explore
          </span>
        </div>
        {visibleFlags.map((f, i) => (
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
        {FLAGS.length > visibleFlags.length && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              className="btn sm"
              onClick={() => setShowAllFlags(s => !s)}
            >
              {showAllFlags ? 'Show fewer' : `Show all ${FLAGS.length} flags`}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button className="btn primary" onClick={onKeyTakeaways}>Key Takeaways →</button>
      </div>
    </div>
  );
}
