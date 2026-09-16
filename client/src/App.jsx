import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';

import { Landing } from './pages/Landing';
import { Repositories } from './pages/Repositories';
import { RepoDetail } from './pages/RepoDetail';
import { AnalysisView } from './pages/AnalysisView';
import { HistoryTrends } from './pages/HistoryTrends';
import { Settings } from './pages/Settings';
import { HowItWorksDetail } from './pages/HowItWorksDetail';

export function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/how-it-works/:slug" element={<HowItWorksDetail />} />
          <Route path="/repos" element={<Repositories />} />
          <Route path="/repos/:id" element={<RepoDetail />} />
          <Route path="/analysis/:id" element={<AnalysisView />} />
          <Route path="/trends" element={<HistoryTrends />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SocketProvider>
  );
}

export default App;
