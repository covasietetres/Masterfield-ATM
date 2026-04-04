import { Sidebar } from '@/components/Sidebar';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { CallNotification } from '@/components/CallNotification';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PresenceProvider>
      <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
        <CallNotification />
        <Sidebar />
        <div className="md:ml-64 flex flex-col min-h-screen">
          <main className="flex-1 p-4 pt-16 md:p-8 md:pt-8 max-w-[100vw] overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </PresenceProvider>
  );
}
