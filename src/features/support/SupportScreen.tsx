import { supportContacts } from '../../content/support/contacts';
import { BreathingExercise } from '../../design-system/components/BreathingExercise';
import { Page } from '../../design-system/components/Page';
import { SupportContactCard } from '../../design-system/components/SupportContactCard';
import { PhoneCall, Wind } from 'lucide-react';

const heroImage = `${import.meta.env.BASE_URL}hands_holding_plant.png`;

export function SupportScreen() {
  return (
    <Page width="narrow" className="pt-stack-md pb-12">
      <section className="flex flex-col gap-stack-sm text-center items-center mt-4">
        <div className="w-32 h-32 mb-4 bg-surface-container rounded-full flex items-center justify-center overflow-hidden shadow-sm">
          <img alt="Apoio" className="w-full h-full object-cover" src={heroImage} />
        </div>
        <h1 className="font-display-lg text-primary flex items-center gap-3 justify-center">{supportContacts.title}</h1>
        <p className="font-body-lg text-on-surface-variant max-w-md mx-auto">{supportContacts.description}</p>
      </section>

      {/* Precisa de um momento para se acalmar? */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <Wind className="text-secondary shrink-0" size={20} aria-hidden="true" />
          <h2 className="font-headline-sm text-on-surface">Precisa de um momento para se acalmar?</h2>
        </div>
        <p className="font-body-md text-on-surface-variant px-1 -mt-1">
          Faça uma pausa e experimente uma respiração breve antes de continuar.
        </p>
        <BreathingExercise />
      </section>

      {/* Precisa de apoio agora? */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <PhoneCall className="text-primary shrink-0" size={22} aria-hidden="true" />
          <h2 className="font-headline-sm text-on-surface">Precisa de apoio agora?</h2>
        </div>
        <div className="flex flex-col gap-stack-md">
          {supportContacts.contacts.map((contact) => (
            <SupportContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      </section>
    </Page>
  );
}
