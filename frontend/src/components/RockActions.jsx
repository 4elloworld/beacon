// Buttons for a recommended action. An action that is wired to something real is
// a live button; one that isn't yet is shown disabled and labelled, rather than
// looking identical to a working control and doing nothing when clicked.
export default function RockActions({ rock, onCosts }) {
  const isBuilt = rock.action === 'costs';

  if (isBuilt) {
    return (
      <>
        <button className="btn gold" onClick={onCosts}>{rock.primaryBtn}</button>
        <button className="btn text-link" onClick={onCosts}>{rock.secondaryBtn}</button>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        className="btn gold"
        disabled
        title="Not built yet"
        style={{ opacity: 0.45, cursor: 'not-allowed' }}
      >
        {rock.primaryBtn}
      </button>
      <span style={{ fontSize: 11, color: 'var(--ink4)', fontStyle: 'italic' }}>
        drafting coming soon — the finding above is ready to act on today
      </span>
    </div>
  );
}
