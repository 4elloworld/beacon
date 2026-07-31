const STEPS = ['Upload', 'Analyze', 'Dashboard', 'Key Takeaways', 'Your move', 'Remedies'];

export default function StepNav({ currentScreen, goTo, scanComplete }) {
  return (
    <div className="step-nav">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const locked = !scanComplete && n > 2;
        const cls = n < currentScreen ? 'done' : n === currentScreen ? 'active' : `future${locked ? ' locked' : ''}`;
        const icon = n < currentScreen ? '✓' : n;

        return (
          <button
            key={n}
            className={`step-btn ${cls}`}
            onClick={() => !locked && goTo(n)}
            disabled={locked}
          >
            <span className="step-num">{icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
