import { useState } from 'react';
import BeaconDot from './components/BeaconDot.jsx';
import StepNav from './components/StepNav.jsx';
import Upload from './screens/Upload.jsx';
import Analyze from './screens/Analyze.jsx';
import Dashboard from './screens/Dashboard.jsx';
import KeyTakeaways from './screens/KeyTakeaways.jsx';
import YourMove from './screens/YourMove.jsx';
import Remedies from './screens/Remedies.jsx';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [scanComplete, setScanComplete] = useState(false);

  function goTo(n) {
    if (!scanComplete && n > 2) return;
    setCurrentScreen(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleAnalyzeComplete() {
    setScanComplete(true);
    setCurrentScreen(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const screens = {
    1: <Upload onNext={() => goTo(2)} />,
    2: <Analyze onComplete={handleAnalyzeComplete} alreadyDone={scanComplete} />,
    3: <Dashboard onKeyTakeaways={() => goTo(4)} />,
    4: <KeyTakeaways onNext={() => goTo(5)} />,
    5: <YourMove onBack={() => goTo(3)} onNext={() => goTo(6)} />,
    6: <Remedies onBack={() => goTo(3)} />,
  };

  return (
    <>
      <div className="beacon-bar" />
      <div className="app">
        <nav className="top-nav">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div className="logo">
              <BeaconDot />
              Beacon
            </div>
            <div className="tagline">Shine light on your portfolio.</div>
          </div>
          <StepNav
            currentScreen={currentScreen}
            goTo={goTo}
            scanComplete={scanComplete}
          />
        </nav>

        <div key={currentScreen} className="screen-fade">
          {screens[currentScreen]}
        </div>
      </div>
    </>
  );
}
