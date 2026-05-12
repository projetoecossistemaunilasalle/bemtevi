import { Shield, AlertCircle, Compass, MapPin, Leaf } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  setView: (view: 'HOME' | 'EMERGENCY' | 'ASSESSMENT' | 'NETWORK') => void;
}

export function HomeView({ setView }: Props) {
  return (
    <motion.main 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-7xl mx-auto px-container-padding-mobile mt-stack-md flex flex-col gap-stack-lg w-full"
    >
      <section className="flex flex-col items-center text-center gap-stack-sm">
        <h2 className="font-display-lg text-on-surface">Como você está hoje?</h2>
        <div className="bg-surface-container rounded-xl p-4 flex items-start gap-4 mt-stack-sm text-left max-w-md w-full">
          <Shield className="text-secondary shrink-0 mt-1" size={24} />
          <p className="font-body-md text-on-surface-variant">
            Este é um espaço seguro. Tudo o que você compartilha e busca aqui permanece 100% anônimo e confidencial.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-stack-sm max-w-md w-full mx-auto">
        <button 
          onClick={() => setView('EMERGENCY')}
          className="w-full bg-surface-container-lowest border border-outline-variant hover:bg-surface-container-low hover:border-secondary active:scale-[0.98] transition-colors duration-200 rounded-full min-h-[56px] px-6 flex items-center justify-start gap-4 shadow-sm group"
        >
          <AlertCircle className="text-[#F59E0B] group-hover:scale-110 transition-transform" size={20} fill="#F59E0B" color="#fff" />
          <span className="font-headline-sm text-on-surface">Não estou bem agora</span>
        </button>

        <button 
          onClick={() => setView('ASSESSMENT')}
          className="w-full bg-surface-container-lowest border border-outline-variant hover:bg-surface-container-low hover:border-secondary active:scale-[0.98] transition-colors duration-200 rounded-full min-h-[56px] px-6 flex items-center justify-start gap-4 shadow-sm group"
        >
          <Compass className="text-secondary group-hover:scale-110 transition-transform" size={20} />
          <span className="font-headline-sm text-on-surface">Preciso de orientação</span>
        </button>

        <button 
          onClick={() => setView('NETWORK')}
          className="w-full bg-surface-container-lowest border border-outline-variant hover:bg-surface-container-low hover:border-secondary active:scale-[0.98] transition-colors duration-200 rounded-full min-h-[56px] px-6 flex items-center justify-start gap-4 shadow-sm group"
        >
          <MapPin className="text-secondary group-hover:scale-110 transition-transform" size={20} />
          <span className="font-headline-sm text-on-surface">Ver rede de apoio local</span>
        </button>
      </section>

      <section className="w-full max-w-md mx-auto flex justify-center mt-stack-md opacity-80 pointer-events-none">
        <div className="w-48 h-48 rounded-full bg-gradient-to-tr from-surface-container to-surface-container-lowest flex items-center justify-center">
          <Leaf className="text-primary-fixed-dim" size={80} />
        </div>
      </section>
    </motion.main>
  );
}
