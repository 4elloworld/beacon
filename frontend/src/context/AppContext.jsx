import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [portfolioData, setPortfolioData] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [ownerContext, setOwnerContext] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [costState, setCostState] = useState({
    property_tax:  { mode: 'pending', value: '' },
    insurance:     { mode: 'pending', value: '' },
    mortgage:      { mode: 'pending', value: '' },
    landscaping:   { mode: 'pending', value: '' },
    reserves:      { mode: 'pending', value: '' },
  });
  const [concealState, setConcealState] = useState({
    global: false,
    properties: new Set(),
  });

  function updateCost(type, mode, value = '') {
    setCostState(prev => ({ ...prev, [type]: { mode, value } }));
  }

  function togglePropertyConceal(id) {
    setConcealState(prev => {
      const next = new Set(prev.properties);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, properties: next };
    });
  }

  function toggleGlobalConceal() {
    setConcealState(prev => ({
      global: !prev.global,
      properties: new Set(),
    }));
  }

  function isConcealed(id) {
    return concealState.global || concealState.properties.has(id);
  }

  const completenessPercent = (() => {
    const filled = Object.values(costState).filter(c => c.mode !== 'pending').length;
    return Math.min(52 + Math.round((filled / 5) * 40), 92);
  })();

  return (
    <AppContext.Provider value={{
      portfolioData, setPortfolioData,
      analysisResults, setAnalysisResults,
      ownerContext, setOwnerContext,
      uploadDescription, setUploadDescription,
      additionalFiles, setAdditionalFiles,
      costState, updateCost,
      concealState, togglePropertyConceal, toggleGlobalConceal, isConcealed,
      completenessPercent,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
