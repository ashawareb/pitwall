import { Navigate, Route, Routes } from 'react-router-dom';
import Picker from './routes/Picker.js';
import Session from './routes/Session.js';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Picker />} />
      <Route path="/p/:hash" element={<Picker />} />
      <Route path="/s/:projectHash/:sessionId" element={<Session />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
