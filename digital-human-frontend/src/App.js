import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import { observer } from 'mobx-react-lite';

// 导入页面
import Dashboard from './pages/Dashboard';
import VoiceClonePage from './pages/VoiceClone/VoiceClonePage';
import LipSyncPage from './pages/LipSync/LipSyncPage';
import ChatPage from './pages/Chat/ChatPage';
import TrainingPage from './pages/Training/TrainingPage';

// 导入组件
import Header from './components/Header';
import Footer from './components/Footer';

// 创建主题
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

const App = observer(() => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Header />
        <Container maxWidth="lg" sx={{ minHeight: 'calc(100vh - 160px)', py: 3 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/voice-clone" element={<VoiceClonePage />} />
            <Route path="/lip-sync" element={<LipSyncPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/training" element={<TrainingPage />} />
          </Routes>
        </Container>
        <Footer />
      </Router>
    </ThemeProvider>
  );
});

export default App;

