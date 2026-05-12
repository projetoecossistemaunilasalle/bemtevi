import { Map, Clock, Phone, Info, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

export function NetworkView() {
  return (
    <motion.main 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-grow pt-24 pb-28 px-container-padding-mobile md:px-container-padding-desktop max-w-7xl mx-auto w-full"
    >
      <section className="mb-stack-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary-container text-on-primary-container p-2 rounded-full flex items-center justify-center">
            <MapPin fill="currentColor" size={24} />
          </div>
          <h1 className="font-headline-lg text-on-surface">Rede de apoio em Canoas</h1>
        </div>
        <p className="font-body-md text-on-surface-variant">Encontre centros de atendimento e suporte próximos a você.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
        <article className="bg-surface-container-low rounded-xl border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
          <div className="p-6 flex-grow">
            <div className="flex justify-between items-start mb-4">
              <span className="bg-tertiary-container text-on-tertiary-container px-3 py-1 rounded-full font-label-md">CAPS</span>
            </div>
            <h2 className="font-headline-md text-on-surface mb-4">CAPS II Praça Brasil</h2>
            <div className="flex flex-col gap-3 font-body-md text-on-surface-variant">
              <div className="flex items-start gap-3">
                <Map className="text-secondary mt-0.5 shrink-0" size={20} />
                <span>Av. Getúlio Vargas, 7071 - Centro, Canoas - RS</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="text-secondary shrink-0" size={20} />
                <span>(51) 3236-1500</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-secondary shrink-0" size={20} />
                <span>Segunda a Sexta, 08:00 - 18:00</span>
              </div>
            </div>
            <a href="tel:5132361500" className="mt-6 flex items-center justify-center gap-2 bg-primary text-on-primary rounded-full py-3 px-6 font-label-md hover:opacity-90 transition-opacity w-full">
              <Phone size={20} />
              Ligar agora
            </a>
          </div>
        </article>

        <article className="bg-surface-container-low rounded-xl border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
          <div className="p-6 flex-grow">
            <div className="flex justify-between items-start mb-4">
              <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-label-md">UBS</span>
            </div>
            <h2 className="font-headline-md text-on-surface mb-4">UBS Centro de Saúde</h2>
            <div className="flex flex-col gap-3 font-body-md text-on-surface-variant">
              <div className="flex items-start gap-3">
                <Map className="text-secondary mt-0.5 shrink-0" size={20} />
                <span>Rua Quinze de Janeiro, 123 - Centro, Canoas - RS</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="text-secondary shrink-0" size={20} />
                <span>(51) 3462-1600</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-secondary shrink-0" size={20} />
                <span>Segunda a Sexta, 07:30 - 17:00</span>
              </div>
            </div>
            <a href="tel:5134621600" className="mt-6 flex items-center justify-center gap-2 bg-primary text-on-primary rounded-full py-3 px-6 font-label-md hover:opacity-90 transition-opacity w-full">
              <Phone size={20} />
              Ligar agora
            </a>
          </div>
        </article>

        <article className="bg-surface-container-low rounded-xl border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
          <div className="p-6 flex-grow">
            <div className="flex justify-between items-start mb-4">
              <span className="bg-outline-variant text-on-surface px-3 py-1 rounded-full font-label-md">UNIVERSIDADE</span>
            </div>
            <h2 className="font-headline-md text-on-surface mb-4">Clínica Escola de Psicologia - Ulbra</h2>
            <div className="flex flex-col gap-3 font-body-md text-on-surface-variant">
              <div className="flex items-start gap-3">
                <Map className="text-secondary mt-0.5 shrink-0" size={20} />
                <span>Av. Farroupilha, 8001 - São José, Canoas - RS</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="text-secondary shrink-0" size={20} />
                <span>(51) 3477-9200</span>
              </div>
              <div className="flex items-center gap-3">
                <Info className="text-secondary shrink-0" size={20} />
                <span>Mediante agendamento prévio</span>
              </div>
            </div>
            <a href="tel:5134779200" className="mt-6 flex items-center justify-center gap-2 bg-primary text-on-primary rounded-full py-3 px-6 font-label-md hover:opacity-90 transition-opacity w-full">
              <Phone size={20} />
              Ligar agora
            </a>
          </div>
        </article>
      </div>
    </motion.main>
  );
}
