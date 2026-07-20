import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { Providers } from './providers';
import { Router } from './router';

export default function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Router />
        </BrowserRouter>
      </Providers>
    </ErrorBoundary>
  );
}
