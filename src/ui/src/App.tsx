import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Servers } from "./pages/Servers";
import { Workspaces } from "./pages/Workspaces";
import { Logs } from "./pages/Logs";

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
