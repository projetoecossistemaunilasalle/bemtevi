import { Heart, Stethoscope, Flame, Phone } from 'lucide-react';
import { motion } from 'motion/react';

export function EmergencyView() {
  return (
    <motion.main 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="px-container-padding-mobile max-w-3xl mx-auto pt-stack-md flex flex-col gap-stack-lg w-full"
    >
      <section className="flex flex-col gap-stack-sm text-center items-center mt-4">
        <div className="w-32 h-32 mb-4 bg-surface-container rounded-full flex items-center justify-center overflow-hidden shadow-sm">
          <img 
            alt="Supportive" 
            className="w-full h-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqkCrY1EdscBmNcq_excVY7DjEwsWfigzGXHMwzoGe0vG9orWO5X2YSkXPstVQ11phTL6lp19Mjtue0ScZkFNfU4lb1iQFipZTUsrMBeCa_XMSUPeegCV6Zgg1BRuEj1HR7M4aTA_-cBB6IVAJiAg4KrOnHt379sOgOf9No7B_FTU7rA9wS7_TDq_7AUR0II2VZp8jFTdQ2uVaAjcD6bOikqQNKWWpzTNF4q06p8W9B4d6lgE0Uiufz8kqX_dj2b8iqW9KWI6mDeQ" 
          />
        </div>
        <h1 className="font-display-lg text-primary">Você não está sozinho(a).</h1>
        <p className="font-body-lg text-on-surface-variant max-w-md mx-auto">
          Se você estiver em sofrimento agora, estas pessoas podem te ajudar.
        </p>
      </section>

      <section className="flex flex-col gap-stack-md">
        <div className="bg-[#EEF8F3] rounded-xl p-6 flex flex-col gap-4 shadow-[0_4px_12px_rgba(27,58,107,0.05)] border border-outline-variant/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Heart fill="currentColor" size={24} />
              <h2 className="font-headline-sm">CVV</h2>
            </div>
            <div className="font-display-lg text-on-surface tracking-tight">188</div>
            <p className="font-body-md text-on-surface-variant">
              Centro de Valorização da Vida. Atendimento 24h, gratuito e sigiloso para apoio emocional e prevenção ao suicídio.
            </p>
          </div>
          <a href="tel:188" className="relative z-10 mt-2 w-full min-h-[48px] bg-primary text-on-primary font-label-md rounded-lg flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(27,58,107,0.1)] hover:bg-surface-tint transition-colors">
            <Phone size={20} />
            Ligar agora
          </a>
        </div>

        <div className="bg-[#EEF8F3] rounded-xl p-6 flex flex-col gap-4 shadow-[0_4px_12px_rgba(27,58,107,0.05)] border border-outline-variant/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Stethoscope size={24} />
              <h2 className="font-headline-sm">SAMU</h2>
            </div>
            <div className="font-display-lg text-on-surface tracking-tight">192</div>
            <p className="font-body-md text-on-surface-variant">
              Serviço de Atendimento Móvel de Urgência. Para emergências médicas que necessitem de intervenção imediata.
            </p>
          </div>
          <a href="tel:192" className="relative z-10 mt-2 w-full min-h-[48px] bg-primary text-on-primary font-label-md rounded-lg flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(27,58,107,0.1)] hover:bg-surface-tint transition-colors">
            <Phone size={20} />
            Ligar agora
          </a>
        </div>

        <div className="bg-[#EEF8F3] rounded-xl p-6 flex flex-col gap-4 shadow-[0_4px_12px_rgba(27,58,107,0.05)] border border-outline-variant/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Flame fill="currentColor" size={24} />
              <h2 className="font-headline-sm">Bombeiros</h2>
            </div>
            <div className="font-display-lg text-on-surface tracking-tight">193</div>
            <p className="font-body-md text-on-surface-variant">
              Corpo de Bombeiros. Para resgates, tentativas de suicídio em andamento ou situações de risco iminente à vida.
            </p>
          </div>
          <a href="tel:193" className="relative z-10 mt-2 w-full min-h-[48px] bg-primary text-on-primary font-label-md rounded-lg flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(27,58,107,0.1)] hover:bg-surface-tint transition-colors">
            <Phone size={20} />
            Ligar agora
          </a>
        </div>
      </section>
    </motion.main>
  );
}
