import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { Providers } from './providers';
import { Router } from './router';

function getBasename(baseUrl: string): string {
  // If BASE_URL is a full URL (e.g. from CI --base), extract just the pathname
  if (baseUrl.startsWith('http')) {
    try {
      return new URL(baseUrl).pathname;
    } catch {
      return '/';
    }
  }
  return baseUrl;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <BrowserRouter basename={getBasename(import.meta.env.BASE_URL)}>
          <Router />
        </BrowserRouter>
      </Providers>
    </ErrorBoundary>
  );
}
