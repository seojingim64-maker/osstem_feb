import { useState } from 'react';
import Landing from './components/Landing';
import Permission from './components/Permission';
import Scanner from './components/Scanner';
import Result from './components/Result';
import Simulation from './components/Simulation';

function App() {
  const [step, setStep] = useState('landing');
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleStart = () => setStep('permission');
  const handlePermissionGranted = () => setStep('scanning');
  const handleScanComplete = (result) => {
    setAnalysisResult(result);
    setStep('result'); // or 'scanning' -> 'analyzing' -> 'result'
  };
  const handleSimulationStart = () => setStep('simulation');
  const handleBackToResult = () => setStep('result');

  return (
    <div className="container">
      {step === 'landing' && <Landing onStart={handleStart} />}
      {step === 'permission' && <Permission onGranted={handlePermissionGranted} />}
      {step === 'scanning' && <Scanner onScanComplete={handleScanComplete} />}
      {step === 'result' && <Result result={analysisResult} onSimulate={handleSimulationStart} />}
      {step === 'simulation' && <Simulation result={analysisResult} onBack={handleBackToResult} />}
    </div>
  );
}

export default App;
