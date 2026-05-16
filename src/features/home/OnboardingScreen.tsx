import { useState } from 'react';
import { motion } from 'motion/react';
import { Brain, Compass, HeartHandshake, Shield } from 'lucide-react';
import { Button } from '../../design-system/components/Button';

export function OnboardingScreen({ onContinue }: { onContinue: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: <Brain size={48} className="text-on-primary" />,
      title: 'Bem-vindo ao SeCuida',
      body: 'Um espaço seguro e anônimo para cuidar de você. Aqui, ninguém precisa saber quem você é — só importa como você está se sentindo.',
    },
    {
      icon: <Shield size={48} className="text-on-primary" />,
      title: 'Sua privacidade importa',
      body: 'Não pedimos login, CPF, e-mail ou nome da escola. Nada do que você faz aqui é salvo ou compartilhado.',
    },
    {
      icon: <Compass size={48} className="text-on-primary" />,
      title: 'No seu ritmo',
      body: 'Você escolhe como quer seguir: orientação guiada, recursos para estudar, ou contatos de apoio. Tudo no seu tempo.',
    },
    {
      icon: <HeartHandshake size={48} className="text-on-primary" />,
      title: 'Você não está sozinho(a)',
      body: 'O SeCuida foi feito para educadores que merecem acolhimento. Vamos começar?',
    },
  ];

  const current = steps[step];

  return (
    <motion.div
      data-onboarding-screen
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-[calc(100dvh-4rem-1px)] max-h-[calc(100dvh-4rem-1px)] -mb-24 md:mb-0 flex flex-col bg-primary relative overflow-hidden"
    >
      {/* Wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
          <path d="M0 120C240 40 480 160 720 120C960 80 1200 160 1440 120V200H0V120Z" fill="rgba(255,255,255,0.08)" />
          <path d="M0 140C240 80 480 180 720 140C960 100 1200 180 1440 140V200H0V140Z" fill="rgba(255,255,255,0.05)" />
        </svg>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-container-padding-mobile md:px-container-padding-desktop py-[clamp(1rem,5dvh,3rem)] text-center relative z-10">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-[clamp(0.875rem,3dvh,1.5rem)] max-w-md"
        >
          <div className="w-[clamp(4.5rem,14dvh,6rem)] h-[clamp(4.5rem,14dvh,6rem)] rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
            {current.icon}
          </div>
          <h1 className="font-display-lg text-on-primary">{current.title}</h1>
          <p className="font-body-lg text-on-primary/85 leading-relaxed">{current.body}</p>
        </motion.div>
      </div>

      <div className="relative z-10 shrink-0 px-container-padding-mobile md:px-container-padding-desktop pt-[clamp(0.75rem,3dvh,1.5rem)] pb-[calc(6rem+max(0.75rem,env(safe-area-inset-bottom)))] md:pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-3">
        {/* Step indicators */}
        <div className="flex gap-2 mb-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-on-primary' : 'bg-on-primary/30'
              }`}
            />
          ))}
        </div>

        {step < steps.length - 1 ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setStep((s) => s + 1)}
            className="w-full max-w-sm bg-white/15 !text-on-primary border-white/20 hover:bg-white/25"
          >
            Continuar
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            onClick={onContinue}
            className="w-full max-w-sm bg-white !text-primary hover:bg-white/90 font-bold"
          >
            Começar
          </Button>
        )}

        {step < steps.length - 1 && (
          <button
            onClick={onContinue}
            className="font-label-md text-on-primary/70 hover:text-on-primary transition-colors"
          >
            Pular
          </button>
        )}
      </div>
    </motion.div>
  );
}
