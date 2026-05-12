import { useState } from 'react';
import { Brain, Home, BookOpen, Users } from 'lucide-react';
import { HomeView } from './views/HomeView';
import { EmergencyView } from './views/EmergencyView';
import { AssessmentView } from './views/AssessmentView';
import { NetworkView } from './views/NetworkView';

export default function App() {
  const [currentView, setCurrentView] = useState<'HOME' | 'EMERGENCY' | 'ASSESSMENT' | 'NETWORK'>('HOME');

  return (
    <div className="bg-background text-on-background min-h-[100dvh] flex flex-col font-body-md pb-24 md:pb-0 relative overflow-x-hidden w-full">
      <header className="bg-surface sticky top-0 z-40 w-full flat no shadows">
        <div className="flex items-center px-container-padding-mobile h-16 w-full max-w-7xl mx-auto justify-between">
          <button 
            onClick={() => setCurrentView('HOME')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Brain className="text-primary" size={28} />
            <h1 className="font-headline-lg-mobile text-primary">SeCuida</h1>
          </button>

          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setCurrentView('HOME')}
              className={`font-label-md px-4 py-2 flex items-center gap-2 rounded-full transition-colors ${
                currentView === 'HOME' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <Home size={20} fill={currentView === 'HOME' ? 'currentColor' : 'none'} />
              Home
            </button>
            <button 
              onClick={() => setCurrentView('ASSESSMENT')}
              className={`font-label-md px-4 py-2 flex items-center gap-2 rounded-full transition-colors ${
                currentView === 'ASSESSMENT' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <BookOpen size={20} fill={currentView === 'ASSESSMENT' ? 'currentColor' : 'none'} />
              Orientação
            </button>
            <button 
              onClick={() => setCurrentView('NETWORK')}
              className={`font-label-md px-4 py-2 flex items-center gap-2 rounded-full transition-colors ${
                currentView === 'NETWORK' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <Users size={20} fill={currentView === 'NETWORK' ? 'currentColor' : 'none'} />
              Rede
            </button>
          </nav>
        </div>
      </header>

      <div className="flex-grow flex flex-col w-full relative">
        {currentView === 'HOME' && <HomeView setView={setCurrentView} />}
        {currentView === 'EMERGENCY' && <EmergencyView />}
        {currentView === 'ASSESSMENT' && <AssessmentView setView={setCurrentView} />}
        {currentView === 'NETWORK' && <NetworkView />}
      </div>

      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-surface shadow-[0_-4px_12px_0_rgba(27,58,107,0.1)] rounded-t-xl md:hidden">
        <button 
          onClick={() => setCurrentView('HOME')}
          className={`flex flex-col items-center justify-center p-2 scale-95 duration-200 ease-in-out font-label-md ${
            currentView === 'HOME' ? 'bg-primary-container text-on-primary-container rounded-full px-5 py-1' : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <Home size={24} fill={currentView === 'HOME' ? 'currentColor' : 'none'} className="mb-1" />
          <span className="text-[12px] leading-tight">Home</span>
        </button>
        
        <button 
          onClick={() => setCurrentView('ASSESSMENT')}
          className={`flex flex-col items-center justify-center p-2 scale-95 duration-200 ease-in-out font-label-md ${
            currentView === 'ASSESSMENT' ? 'bg-primary-container text-on-primary-container rounded-full px-5 py-1' : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <BookOpen size={24} fill={currentView === 'ASSESSMENT' ? 'currentColor' : 'none'} className="mb-1" />
          <span className="text-[12px] leading-tight">Orientação</span>
        </button>

        <button 
          onClick={() => setCurrentView('NETWORK')}
          className={`flex flex-col items-center justify-center p-2 scale-95 duration-200 ease-in-out font-label-md ${
            currentView === 'NETWORK' ? 'bg-primary-container text-on-primary-container rounded-full px-5 py-1' : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <Users size={24} fill={currentView === 'NETWORK' ? 'currentColor' : 'none'} className="mb-1" />
          <span className="text-[12px] leading-tight">Rede</span>
        </button>
      </nav>
    </div>
  );
}
