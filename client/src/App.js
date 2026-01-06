import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';

// Context Providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { EmailProvider } from './context/EmailContext';
import { SocketProvider } from './context/SocketContext';

// Components
import Dashboard from './pages/Dashboard';
import Compose from './pages/Compose';
import Campaign from './pages/Campaign';
import Contacts from './pages/Contacts';
import Templates from './pages/Templates';
import SMTPConfig from './pages/SMTPConfig';
import Workers from './pages/Workers';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';

// Socket connection
const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#4361ee',
      light: '#4cc9f0',
      dark: '#3a56d4'
    },
    secondary: {
      main: '#7209b7'
    },
    success: {
      main: '#4cc9f0'
    },
    error: {
      main: '#f72585'
    },
    warning: {
      main: '#f8961e'
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none'
    }
  },
  shape: {
    borderRadius: 12
  }
});

// Protected Route Component - This should be inside App but outside the function
const ProtectedRouteWrapper = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Or use this simpler version to bypass auth (for testing):
const SimpleProtectedRoute = ({ children }) => {
  // Check localStorage directly
  const user = localStorage.getItem('user');
  return user ? children : <Navigate to="/login" />;
};

function App() {
  useEffect(() => {
    // Socket connection handling
    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '10px',
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#4cc9f0',
            },
          },
          error: {
            style: {
              background: '#f72585',
            },
          },
        }}
      />
      <AuthProvider>
        <EmailProvider>
          <SocketProvider socket={socket}>
            <Router>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                {/* <Route path="/register" element={<Register />} /> */}
                
                {/* Protected routes with Layout */}
                <Route 
                  path="/" 
                  element={
                    <SimpleProtectedRoute>
                      <Layout />
                    </SimpleProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="compose" element={<Compose />} />
                  <Route path="campaign" element={<Campaign />} />
                  <Route path="contacts" element={<Contacts />} />
                  <Route path="templates" element={<Templates />} />
                  <Route path="smtp" element={<SMTPConfig />} />
                  <Route path="workers" element={<Workers />} />
                  <Route path="history" element={<History />} />
                </Route>
                
                {/* Redirect all other routes */}
                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </Router>
          </SocketProvider>
        </EmailProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;