// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./components/Dashboard";
import { ThemeProvider } from "./components/theme-provider";


function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage/>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
      </ThemeProvider>
  );
}

export default App;