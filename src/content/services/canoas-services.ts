import type { ServicesContent } from '../../domain/services/types';
import { canoasClinicServices, canoasEmergencyAndCapsServices } from './canoas/canoas';
import { esteioSapucaiaServices } from './canoas/esteioSapucaia';
import { novoHamburgoServices } from './canoas/novoHamburgo';
import { portoAlegreServices } from './canoas/portoAlegre';
import { saoLeopoldoServices } from './canoas/saoLeopoldo';

export const canoasServices = {
  id: 'canoas-services',
  version: '1.0.0',
  status: 'draft',
  locale: 'pt-BR',
  title: 'Rede de apoio à saúde',
  description: 'Encontre serviços de saúde e apoio próximos a você.',
  services: [
    ...canoasEmergencyAndCapsServices,
    ...saoLeopoldoServices,
    ...novoHamburgoServices,
    ...esteioSapucaiaServices,
    ...portoAlegreServices,
    ...canoasClinicServices,
  ],
} satisfies ServicesContent;
