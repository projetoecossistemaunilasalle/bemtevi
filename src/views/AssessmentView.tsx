import { useState } from 'react';
import { Briefcase, Moon, Heart, MoreHorizontal, ArrowRight, BookOpen, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AssessmentView({ setView }: { setView: (v: string) => void }) {
  const [step, setStep] = useState(1);

  return (
    <div className="w-full flex-grow flex">
      <AnimatePresence mode="wait">
        {step === 1 && <Step1 key="s1" onNext={() => setStep(2)} />}
        {step === 2 && <StepChat key="s2" onNext={() => setStep(3)} />}
        {step === 3 && <Step2 key="s3" onNext={() => setStep(4)} />}
        {step === 4 && <Step3 key="s4" onNext={() => setView('NETWORK')} />}
      </AnimatePresence>
    </div>
  );
}

function Step1({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState('');

  return (
    <motion.main 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-grow w-full max-w-3xl mx-auto px-container-padding-mobile md:px-container-padding-desktop pt-stack-md md:pt-stack-lg"
    >
      <div className="text-center mb-stack-lg">
        <h1 className="font-display-lg text-on-background mb-stack-sm">Vamos entender o que você precisa</h1>
        <p className="font-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Responda sem pressa. Este é um espaço seguro e confidencial pensado para o seu bem-estar.
        </p>
      </div>

      <div className="bg-surface-container-lowest shadow-[0_4px_12px_rgba(27,58,107,0.1)] rounded-xl p-stack-md mb-stack-md">
        <h2 className="font-headline-md text-on-surface text-center mb-stack-md">O que mais te preocupa hoje?</h2>
        
        <div className="flex flex-col gap-stack-sm">
          <label className={`group relative flex items-center p-4 bg-[#EEF8F3] rounded-lg cursor-pointer hover:bg-primary-fixed-dim transition-colors border-l-4 ${selected === 'work' ? 'border-primary' : 'border-transparent'}`}>
            <input type="radio" className="peer sr-only" name="concern" value="work" onChange={(e) => { setSelected(e.target.value); setTimeout(onNext, 400); }} />
            <div className="absolute inset-0 rounded-lg border-l-4 border-transparent peer-checked:border-primary peer-checked:bg-primary-container/10 transition-all pointer-events-none"></div>
            <Briefcase className="text-secondary mr-4 relative z-10" />
            <span className="font-body-lg text-on-surface relative z-10 group-hover:text-on-surface peer-checked:font-bold">Estresse excessivo no trabalho</span>
          </label>
          
          <label className={`group relative flex items-center p-4 bg-[#EEF8F3] rounded-lg cursor-pointer hover:bg-primary-fixed-dim transition-colors border-l-4 ${selected === 'sleep' ? 'border-primary' : 'border-transparent'}`}>
            <input type="radio" className="peer sr-only" name="concern" value="sleep" onChange={(e) => { setSelected(e.target.value); setTimeout(onNext, 400); }} />
            <div className="absolute inset-0 rounded-lg border-l-4 border-transparent peer-checked:border-primary peer-checked:bg-primary-container/10 transition-all pointer-events-none"></div>
            <Moon className="text-secondary mr-4 relative z-10" />
            <span className="font-body-lg text-on-surface relative z-10 group-hover:text-on-surface peer-checked:font-bold">Dificuldade para dormir ou ansiedade</span>
          </label>
          
          <label className={`group relative flex items-center p-4 bg-[#EEF8F3] rounded-lg cursor-pointer hover:bg-primary-fixed-dim transition-colors border-l-4 ${selected === 'sadness' ? 'border-primary' : 'border-transparent'}`}>
            <input type="radio" className="peer sr-only" name="concern" value="sadness" onChange={(e) => { setSelected(e.target.value); setTimeout(onNext, 400); }} />
            <div className="absolute inset-0 rounded-lg border-l-4 border-transparent peer-checked:border-primary peer-checked:bg-primary-container/10 transition-all pointer-events-none"></div>
            <Heart className="text-secondary mr-4 relative z-10" />
            <span className="font-body-lg text-on-surface relative z-10 group-hover:text-on-surface peer-checked:font-bold">Sentimento de desamparo ou tristeza</span>
          </label>
          
          <label className={`group relative flex items-center p-4 bg-[#EEF8F3] rounded-lg cursor-pointer hover:bg-primary-fixed-dim transition-colors border-l-4 ${selected === 'other' ? 'border-primary' : 'border-transparent'}`}>
            <input type="radio" className="peer sr-only" name="concern" value="other" onChange={(e) => { setSelected(e.target.value); setTimeout(onNext, 400); }} />
            <div className="absolute inset-0 rounded-lg border-l-4 border-transparent peer-checked:border-primary peer-checked:bg-primary-container/10 transition-all pointer-events-none"></div>
            <MoreHorizontal className="text-secondary mr-4 relative z-10" />
            <span className="font-body-lg text-on-surface relative z-10 group-hover:text-on-surface peer-checked:font-bold">Outro</span>
          </label>
        </div>
      </div>
    </motion.main>
  );
}

function StepChat({ onNext }: { onNext: () => void }) {
  return (
    <motion.main 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-grow flex flex-col px-container-padding-mobile pb-8 max-w-3xl mx-auto w-full mt-stack-md relative h-full"
    >
      <div className="flex flex-col gap-stack-lg w-full flex-grow">
        <div className="flex items-start gap-gutter w-full">
          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-surface-container shadow-sm border border-outline-variant flex items-center justify-center">
            <img 
              alt="Avatar SeCuida" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCO-X8WPfKw3DcduVCKfxt4fNgy618L5GV6meuX94stOWppyMNB1ySYGx_0sjoRjf1lsdKYsod6kFjzYZxQdE3VrOukYFWtnnxaDcEZBlbnnnWAdDGbFQ6fW3Q3wQXYjpsyCyoHdskPgwDN33B5DHA-LrjoiTZ1sM7AY-sf-6yW__6zFmiTmlIM6uQQgaUt5DQj3xLWkMeez3cWgCe-ekZFBolC_68cSd0c-_0Re1tei6QIWIlojwTStNtflRRbOktmebcFSSbvPWY" 
            />
          </div>
          <div className="bg-[#EEF8F3] text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-[0_2px_8px_rgba(27,58,107,0.05)] border border-outline-variant/30 max-w-[85%]">
            <p className="font-body-lg">Como está seu nível de cansaço nos últimos dias?</p>
          </div>
        </div>

        <div className="flex flex-col gap-stack-sm w-full pl-16">
          <button 
            onClick={onNext}
            className="w-full text-left bg-surface-container-lowest border-2 border-outline-variant rounded-full py-4 px-6 font-body-md text-on-surface hover:bg-surface-container-low hover:border-secondary transition-colors duration-200 shadow-sm active:scale-[0.98]"
          >
            Estou exausto(a)
          </button>
          <button 
            onClick={onNext}
            className="w-full text-left bg-surface-container-lowest border-2 border-outline-variant rounded-full py-4 px-6 font-body-md text-on-surface hover:bg-surface-container-low hover:border-secondary transition-colors duration-200 shadow-sm active:scale-[0.98]"
          >
            Cansado(a), mas conseguindo
          </button>
          <button 
            onClick={onNext}
            className="w-full text-left bg-surface-container-lowest border-2 border-outline-variant rounded-full py-4 px-6 font-body-md text-on-surface hover:bg-surface-container-low hover:border-secondary transition-colors duration-200 shadow-sm active:scale-[0.98]"
          >
            Mais ou menos
          </button>
          <button 
            onClick={onNext}
            className="w-full text-left bg-surface-container-lowest border-2 border-outline-variant rounded-full py-4 px-6 font-body-md text-on-surface hover:bg-surface-container-low hover:border-secondary transition-colors duration-200 shadow-sm active:scale-[0.98]"
          >
            Me sinto bem
          </button>
        </div>
      </div>

      <div className="mt-auto pt-stack-lg sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pb-4 z-10 w-full">
        <div className="relative w-full">
          <input 
            type="text" 
            placeholder="Digite ou escolha uma resposta..." 
            className="w-full bg-surface-container-lowest border border-secondary/30 rounded-full py-4 pl-6 pr-12 font-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-[0_4px_12px_rgba(27,58,107,0.08)]"
          />
          <button 
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-secondary hover:text-primary transition-colors flex items-center justify-center rounded-full hover:bg-surface-container-low"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </motion.main>
  );
}

function Step2({ onNext }: { onNext: () => void }) {
  const [value, setValue] = useState(7);

  return (
    <motion.main 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-grow flex flex-col items-center justify-center px-container-padding-mobile md:px-container-padding-desktop w-full max-w-3xl mx-auto"
    >
      <div className="w-full mb-stack-lg text-center mt-stack-md">
        <p className="font-label-md text-on-surface-variant mb-2">Pergunta 2 de 5</p>
        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: '40%' }}></div>
        </div>
      </div>
      
      <div className="w-full bg-surface-container-lowest rounded-xl p-6 md:p-10 shadow-[0_4px_12px_rgba(27,58,107,0.05)] border border-surface-variant/50">
        <h1 className="font-display-lg text-on-surface mb-stack-lg text-center">Como está seu nível de cansaço nos últimos dias?</h1>
        
        <div className="w-full mt-stack-md mb-stack-lg px-2">
          <div className="relative w-full h-12 flex items-center">
            <input 
              type="range" min="0" max="10" 
              value={value} onChange={(e) => setValue(Number(e.target.value))}
              className="w-full relative z-10" id="tiredness-slider" 
            />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2 bg-primary rounded-l-full z-0 pointer-events-none" style={{ width: `${value * 10}%` }}></div>
          </div>
          
          <div className="flex justify-between w-full mt-4">
            <span className="font-label-md text-on-surface-variant">Nenhum</span>
            <span className="font-label-md text-error">Extremo</span>
          </div>
          
          <div className="flex justify-between w-full px-[10px] -mt-10 relative z-0 pointer-events-none opacity-30">
            {[...Array(11)].map((_, i) => (
              <div key={i} className={`w-0.5 ${i % 5 === 0 ? 'h-3' : 'h-2 mt-0.5'} ${i === 10 ? 'bg-error' : 'bg-on-surface-variant'}`}></div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-center mt-stack-lg">
          <button 
            onClick={onNext}
            className="bg-[#3A9E6E] hover:bg-primary-container text-on-primary font-label-md py-3 px-12 rounded-full shadow-[0_4px_12px_rgba(27,58,107,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 min-h-[48px] flex items-center justify-center gap-2 w-full md:w-auto"
          >
            Próximo
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </motion.main>
  );
}

function Step3({ onNext }: { onNext: () => void }) {
  return (
    <motion.main 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex-grow w-full max-w-7xl mx-auto px-container-padding-mobile py-stack-md flex flex-col gap-stack-lg"
    >
      <section className="flex flex-col gap-stack-sm">
        <h1 className="font-headline-md text-on-surface">Com base no que você compartilhou, isso pode te ajudar:</h1>
      </section>

      <section className="flex flex-col gap-stack-sm">
        <div className="bg-surface rounded-xl p-gutter flex flex-col gap-stack-md shadow-[0_8px_24px_-8px_rgba(27,58,107,0.12)] border border-outline-variant/30">
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="flex flex-col items-start gap-3">
              <span className="bg-secondary-container text-on-secondary-container font-label-md px-2 py-1 rounded-md">FEEVALE</span>
              <h2 className="font-headline-sm text-on-surface">Guia Prático de Regulação Emocional em Sala de Aula</h2>
            </div>
            <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-container-low flex items-center justify-center border border-outline-variant/20">
              <img 
                alt="Illustration" 
                className="w-full h-full object-cover opacity-90 mix-blend-multiply" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUu8741_OQaC5gUnsKWur7Ue7XjPl0zrmuOIJ4Beja1qwe3ecefY-jAPirXyxkalCbdbrni9ru9BNvN445eECuIikPSHgiq06Tzqu-95xgP3UoyvMQVVQI36N81_js4EGvH1QQRVXJ_e8rIpiTlui2vOpllyou7wJMei-tkTvrlnzhswzlJVMxW6GA0QKmGziWmfB7sY5Eskwn6YISBEpc1HqIHOmjdvGPEcHf13Ez2CF_WEnk99EtkQo2HAQMRaTBB1WY5bv-ygQ" 
              />
            </div>
          </div>
          <div>
            <p className="font-body-md text-on-surface-variant">
              Descubra estratégias práticas e acessíveis para lidar com a sobrecarga diária e gerenciar o estresse no ambiente escolar. Este material foi desenvolvido com foco no acolhimento e na preservação da saúde mental do professor.
            </p>
          </div>
          <div className="mt-auto pt-2">
            <button className="w-full min-h-[48px] bg-primary hover:bg-surface-tint text-on-primary font-label-md px-4 py-2 rounded-full flex items-center justify-center gap-2 transition-colors shadow-[0_4px_12px_rgba(27,58,107,0.15)]">
              <BookOpen size={20} />
              Ver material
            </button>
          </div>
        </div>
        
        <div className="flex justify-center mt-stack-sm">
          <button onClick={onNext} className="text-primary hover:text-on-primary-fixed-variant font-label-md min-h-[48px] flex items-center justify-center px-4 py-2 rounded-full transition-colors underline underline-offset-4 decoration-primary/30 hover:decoration-primary">
            Ver outros recursos
          </button>
        </div>
      </section>
    </motion.main>
  );
}
