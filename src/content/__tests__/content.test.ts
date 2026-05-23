import { describe, it, expect } from 'vitest';
import { homeCopy } from '../copy/home';
import { supportContacts } from '../support/contacts';
import { canoasServices } from '../services/canoas-services';
import { resourcesContent } from '../resources/resources';
import { flowRegistry } from '../flows/registry';

describe('Home copy', () => {
  it('has required fields', () => {
    expect(homeCopy.id).toBe('home-copy');
    expect(homeCopy.locale).toBe('pt-BR');
    expect(homeCopy.title).toBeTruthy();
    expect(homeCopy.subtitle).toBeTruthy();
    expect(homeCopy.privacyReassurance).toBeTruthy();
  });

  it('has exactly 3 actions', () => {
    expect(homeCopy.actions).toHaveLength(3);
    homeCopy.actions.forEach((action) => {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.description).toBeTruthy();
    });
  });
});

describe('Support contacts', () => {
  it('has required metadata', () => {
    expect(supportContacts.id).toBe('support-contacts');
    expect(supportContacts.locale).toBe('pt-BR');
    expect(supportContacts.title).toBeTruthy();
  });

  it('has CVV, SAMU, and Bombeiros', () => {
    const ids = supportContacts.contacts.map((c) => c.id);
    expect(ids).toContain('support-cvv');
    expect(ids).toContain('support-samu');
    expect(ids).toContain('support-bombeiros');
  });

  it('every contact has a phone link', () => {
    supportContacts.contacts.forEach((contact) => {
      expect(contact.phoneHref).toMatch(/^tel:/);
      expect(contact.phoneDisplay).toBeTruthy();
    });
  });

  it('every contact has review metadata', () => {
    supportContacts.contacts.forEach((contact) => {
      expect(contact.review.status).toBe('pending_review');
    });
  });
});

describe('Canoas services', () => {
  it('has required metadata', () => {
    expect(canoasServices.id).toBe('canoas-services');
    expect(canoasServices.locale).toBe('pt-BR');
    expect(canoasServices.title).toBeTruthy();
  });

  it('lists services', () => {
    expect(canoasServices.services.length).toBeGreaterThan(0);
  });

  it('every service has address and phone', () => {
    canoasServices.services.forEach((service) => {
      expect(service.address).toBeTruthy();
      expect(service.phoneHref).toMatch(/^tel:/);
      expect(service.city).toBe('Canoas');
      expect(service.state).toBe('RS');
    });
  });
});

describe('Resources content', () => {
  it('has required metadata', () => {
    expect(resourcesContent.id).toBe('education-resources');
    expect(resourcesContent.locale).toBe('pt-BR');
  });

  it('lists resources', () => {
    expect(resourcesContent.resources.length).toBeGreaterThan(0);
  });

  it('every resource has id, title, source, description, tags', () => {
    resourcesContent.resources.forEach((resource) => {
      expect(resource.id).toBeTruthy();
      expect(resource.title).toBeTruthy();
      expect(resource.source).toBeTruthy();
      expect(resource.description).toBeTruthy();
      expect(Array.isArray(resource.tags)).toBe(true);
    });
  });
});

describe('Flow registry', () => {
  it('contains switchable guided conversation flows', () => {
    const flows = flowRegistry.flows as import('../../domain/flow-engine/types').GuidedFlow[];
    const flowIds = flows.map((flow) => flow.id);

    expect(flows).toHaveLength(8);
    expect(flowIds).toEqual(
      expect.arrayContaining([
        'orientation-understand-feelings',
        'orientation-talk-through-experience',
        'orientation-next-care-step',
        'orientation-calm-moment',
        'post-flow-next-step',
        'work-stress',
        'rest-recovery',
        'srq20',
      ]),
    );
    flows.forEach((flow) => {
      expect(flow.type).toBe('guided_conversation');
      expect(flow.entry.enteringPhrases.length).toBeGreaterThan(0);
    });
    expect(flows.filter((flow) => flow.purpose === 'orientation_entry')).toHaveLength(4);
    expect(flows.find((flow) => flow.id === 'post-flow-next-step')?.purpose).toBe('post_flow_routing');
  });
});
