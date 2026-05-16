import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const PHASES = [
  { label: 'Inspire', duration: 4 },
  { label: 'Segure', duration: 2 },
  { label: 'Solte', duration: 6 },
] as const;

type PhaseIndex = 0 | 1 | 2;

export function BreathingExercise() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<PhaseIndex>(0);
  const [countdown, setCountdown] = useState<number>(PHASES[0].duration);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          const nextPhase = ((phase + 1) % 3) as PhaseIndex;
          setPhase(nextPhase);
          return PHASES[nextPhase].duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [active, phase]);

  function handleToggle() {
    if (active) {
      setActive(false);
      setPhase(0);
      setCountdown(PHASES[0].duration);
    } else {
      setActive(true);
    }
  }

  const scale = phase === 0 ? 1.4 : phase === 1 ? 1.4 : 1;
  const phaseLabel = PHASES[phase].label;

  return (
    <section className="bg-[#EEF8F3] rounded-xl p-6 border border-primary/20 shadow-sm flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center w-40 h-40">
        <motion.div
          className="absolute w-32 h-32 rounded-full bg-primary/10 border-2 border-primary/30"
          animate={{ scale: active ? scale : 1 }}
          transition={{ duration: PHASES[phase].duration, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-24 h-24 rounded-full bg-primary/20 border border-primary/40"
          animate={{ scale: active ? scale : 1 }}
          transition={{ duration: PHASES[phase].duration, ease: 'easeInOut', delay: 0.1 }}
        />
        <motion.div
          className="absolute w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center"
          animate={{ scale: active ? scale : 1 }}
          transition={{ duration: PHASES[phase].duration, ease: 'easeInOut', delay: 0.2 }}
        >
          {active && (
            <span className="font-display-lg text-primary">{countdown}</span>
          )}
        </motion.div>
      </div>

      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={active ? phaseLabel : 'idle'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="font-headline-sm text-on-surface"
          >
            {active ? phaseLabel : 'Respire por um momento'}
          </motion.p>
        </AnimatePresence>
        {!active && (
          <p className="font-body-md text-on-surface-variant mt-2">
            Inspire contando até quatro, segure por dois, solte o ar contando até seis.
          </p>
        )}
      </div>

      <button
        onClick={handleToggle}
        className="font-label-md text-primary bg-surface-container-lowest border border-primary/20 rounded-full px-6 py-3 hover:bg-primary-container transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {active ? 'Parar' : 'Começar a respirar'}
      </button>
    </section>
  );
}
