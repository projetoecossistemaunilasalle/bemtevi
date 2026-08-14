/* eslint-disable jsx-a11y/media-has-caption -- The bundled ambient track is instrumental and contains no speech. */
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PHASES = [
  { label: 'Inspire', duration: 4 },
  { label: 'Segure', duration: 2 },
  { label: 'Solte', duration: 6 },
] as const;

const AMBIENT_AUDIO_VOLUME = 0.5;
const ambientAudioUrl = `${import.meta.env.BASE_URL}audio/sunset-plains.mp3`;

type PhaseIndex = 0 | 1 | 2;

export function BreathingExercise() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<PhaseIndex>(0);
  const [countdown, setCountdown] = useState<number>(PHASES[0].duration);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundError, setSoundError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

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

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  async function playAmbientAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = AMBIENT_AUDIO_VOLUME;
    try {
      await audio.play();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setSoundEnabled(false);
      setSoundError('Não foi possível reproduzir o som neste dispositivo. O exercício continua sem áudio.');
    }
  }

  function stopAmbientAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }

  function handleToggle() {
    if (active) {
      setActive(false);
      setPhase(0);
      setCountdown(PHASES[0].duration);
      stopAmbientAudio();
    } else {
      setActive(true);
      setSoundError('');
      if (soundEnabled) void playAmbientAudio();
    }
  }

  function handleSoundToggle() {
    setSoundError('');

    if (soundEnabled) {
      setSoundEnabled(false);
      stopAmbientAudio();
      return;
    }

    setSoundEnabled(true);
    if (active) void playAmbientAudio();
  }

  const scale = phase === 0 ? 1.4 : phase === 1 ? 1.4 : 1;
  const phaseLabel = PHASES[phase].label;

  return (
    <section className="bg-[#EEF8F3] rounded-xl p-6 border border-primary/20 shadow-sm flex flex-col items-center gap-6">
      <audio
        ref={audioRef}
        src={ambientAudioUrl}
        loop
        preload="auto"
        aria-hidden="true"
        onError={() => {
          setSoundEnabled(false);
          setSoundError('Não foi possível carregar o som ambiente. O exercício continua sem áudio.');
        }}
      />

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
          {active && <span className="font-display-lg text-primary">{countdown}</span>}
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
        type="button"
        onClick={handleToggle}
        className="font-label-md text-primary bg-surface-container-lowest border border-primary/20 rounded-full px-6 py-3 hover:bg-primary-container hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {active ? 'Parar' : 'Começar a respirar'}
      </button>

      <div className="flex flex-col items-center gap-2 border-t border-primary/15 pt-5 w-full">
        <button
          type="button"
          aria-pressed={soundEnabled}
          aria-describedby="ambient-sound-status"
          onClick={handleSoundToggle}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            soundEnabled
              ? 'border-primary bg-primary-fixed text-on-surface'
              : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary'
          }`}
        >
          {soundEnabled ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
          {soundEnabled ? 'Som ambiente ativado' : 'Ativar som ambiente'}
        </button>
        <p
          id="ambient-sound-status"
          role="status"
          aria-live="polite"
          className={`max-w-sm text-center font-body-sm ${soundError ? 'text-error' : 'text-on-surface-variant'}`}
        >
          {soundError ||
            (soundEnabled
              ? active
                ? 'O som suave acompanha o exercício e para quando você encerrar.'
                : 'O som começará quando você iniciar o exercício.'
              : 'O som ambiente está desativado. Você pode ativá-lo a qualquer momento.')}
        </p>
      </div>
    </section>
  );
}
