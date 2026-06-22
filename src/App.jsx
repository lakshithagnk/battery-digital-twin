// HashRouter is required for GitHub Pages — static hosts can't handle
// server-side routing, so /logs would return a 404 on direct navigation.
// HashRouter uses #/logs which always loads index.html first.
import { HashRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import Datasets from './pages/Datasets'
import MqttConnect from './pages/MqttConnect'
import Logs from './pages/Logs'

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/mqtt" element={<MqttConnect />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}
