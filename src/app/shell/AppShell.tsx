import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { ScrollToTop } from './ScrollToTop';
import { TopBar } from './TopBar';

export function AppShell() {
  return (
    <div className="bg-background text-on-background min-h-[100dvh] flex flex-col font-body-md pb-24 md:pb-0 relative overflow-x-hidden w-full">
      <ScrollToTop />
      <TopBar />
      <div className="flex-grow flex flex-col w-full relative">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
