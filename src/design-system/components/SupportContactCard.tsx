import { Heart, Phone, PhoneCall, Stethoscope } from 'lucide-react';
import type { SupportContact } from '../../domain/support/types';
import { LinkButton } from './Button';
import { Card } from './Card';

const iconById = {
  'support-cvv': Heart,
  'support-samu': Stethoscope,
  'support-disque-saude': PhoneCall,
} as const;

export function SupportContactCard({ contact }: { contact: SupportContact }) {
  const Icon = iconById[contact.id as keyof typeof iconById] ?? Heart;

  return (
    <Card className="p-6 flex flex-col gap-4 relative overflow-hidden group bg-[#EEF8F3]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Icon fill={contact.id === 'support-cvv' ? 'currentColor' : 'none'} size={24} />
          <h2 className="font-headline-sm">{contact.name}</h2>
        </div>
        <div className="font-display-lg text-on-surface tracking-tight">{contact.phoneDisplay}</div>
        <p className="font-body-md text-on-surface-variant">{contact.description}</p>
      </div>
      <LinkButton href={contact.phoneHref} className="relative z-10 mt-2 w-full rounded-lg">
        <Phone size={20} />
        Ligar agora
      </LinkButton>
    </Card>
  );
}
