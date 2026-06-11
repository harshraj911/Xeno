import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e2130',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '13px'
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#0f1117' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#0f1117' } }
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
