import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';

import { Landing } from './pages/Landing';
import { RepoDetail } from './pages/RepoDetail';
import { AnalysisView } from './pages/AnalysisView';
import { HowItWorksDetail } from './pages/HowItWorksDetail';

export function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/how-it-works/:slug" element={<HowItWorksDetail />} />
          <Route path="/repos" element={<Navigate to="/" replace />} />
          <Route path="/repos/:id" element={<RepoDetail />} />
          <Route path="/analysis/:id" element={<AnalysisView />} />
          <Route path="/trends" element={<Navigate to="/" replace />} />
          <Route path="/repos/:repoId/trends" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SocketProvider>
  );
}

export default App;
