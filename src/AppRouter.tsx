import React from 'react';
import { Routes, Route } from 'react-router-dom';
import App from './App';
import DataVisualizations from './components/DataVisualizations';
import AnalysisGuide from './pages/AnalysisGuide';

const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/data-visualizations" element={<DataVisualizations />} />
      <Route path="/analysis-guide" element={<AnalysisGuide />} />
    </Routes>
  );
};

export default AppRouter;