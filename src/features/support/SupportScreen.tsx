import { healthcareServiceGuidance, supportContacts } from '../../content/support/contacts';
import { BreathingExercise } from '../../design-system/components/BreathingExercise';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import { SupportContactCard } from '../../design-system/components/SupportContactCard';
import { Building2, HeartPulse, Hospital, PhoneCall, Wind } from 'lucide-react';

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

      {/* Onde buscar atendimento? */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <Hospital className="text-primary shrink-0" size={22} aria-hidden="true" />
          <h2 className="font-headline-sm text-on-surface">Onde buscar atendimento?</h2>
        </div>
        <div className="flex flex-col gap-3">
          {healthcareServiceGuidance.map((item) => {
            const icon =
              item.id === 'guidance-ubs' ? (
                <Building2 className="text-secondary shrink-0 mt-0.5" size={22} />
              ) : item.id === 'guidance-caps' ? (
                <HeartPulse className="text-primary shrink-0 mt-0.5" size={22} />
              ) : (
                <Hospital className="text-error shrink-0 mt-0.5" size={22} />
              );

            return (
              <Card key={item.id} className="p-4 sm:p-5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {icon}
                    <h3 className="font-title-md text-on-surface">{item.title}</h3>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                    {item.badge}
                  </span>
                </div>
                <p className="font-body-md text-on-surface-variant leading-relaxed pl-8">{item.description}</p>
              </Card>
            );
          })}
        </div>
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
