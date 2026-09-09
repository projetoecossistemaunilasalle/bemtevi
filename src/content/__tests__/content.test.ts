import { describe, it, expect } from 'vitest';
import { homeCopy } from '../copy/home';
import { supportContacts } from '../support/contacts';
import { canoasServices } from '../services/canoas-services';
import { resourcesContent } from '../resources/resources';
import { flowRegistry } from '../flows/registry';
import { educationResourceGroups, DEFAULT_EDUCATION_GROUP_ID } from '../resources/groups';
import { featuredImageOptions } from '../resources/featuredImages';
import type { EducationResourceGroup } from '../resources/groups';

describe('Home copy', () => {
  it('has required fields', () => {
    expect(homeCopy.id).toBe('home-copy');
    expect(homeCopy.locale).toBe('pt-BR');
    expect(homeCopy.greeting).toBeTruthy();
    expect(homeCopy.subtitle).toBeTruthy();
    expect(homeCopy.educationalDisclaimer).toBeTruthy();
    expect(homeCopy.privacyReassurance).toBeTruthy();
    expect(homeCopy.privacyReassurance).toContain('entre acessos');
    expect(homeCopy.privacyReassurance).not.toContain('entre sessões');
  });

  it('has actions and materialsAction defined', () => {
    expect(homeCopy.actions.length).toBeGreaterThan(0);
    homeCopy.actions.forEach((action) => {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.description).toBeTruthy();
    });
    expect(homeCopy.materialsAction?.label).toBeTruthy();
    expect(homeCopy.materialsAction?.description).toBeTruthy();
  });
});

describe('Support contacts', () => {
  it('has required metadata', () => {
    expect(supportContacts.id).toBe('support-contacts');
    expect(supportContacts.locale).toBe('pt-BR');
    expect(supportContacts.title).toBeTruthy();
  });

  it('lists contacts', () => {
    expect(supportContacts.contacts.length).toBeGreaterThan(0);
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

  it('every service has address, phone, city and state', () => {
    canoasServices.services.forEach((service) => {
      expect(service.address).toBeTruthy();
      expect(service.phoneHref).toMatch(/^tel:/);
      expect(service.city).toBeTruthy();
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

  it('every resource has id, title, source, description, and tags', () => {
    resourcesContent.resources.forEach((resource) => {
      expect(resource.id).toBeTruthy();
      expect(resource.title).toBeTruthy();
      expect(resource.source).toBeTruthy();
      expect(resource.description).toBeTruthy();
      expect(Array.isArray(resource.tags)).toBe(true);
    });
  });

  it('includes generated resources and lets them override base resource IDs', async () => {
    const generatedModule = await import('../resources/generated-resources');
    const generatedIds = generatedModule.generatedResources.map((resource) => resource.id);

    generatedIds.forEach((id) => {
      const matches = resourcesContent.resources.filter((resource) => resource.id === id);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual(generatedModule.generatedResources.find((resource) => resource.id === id));
    });
  });
});

describe('Flow registry', () => {
  it('contains switchable guided conversation flows', () => {
    const flows = flowRegistry.flows as import('../../domain/flow-engine/types').GuidedFlow[];

    expect(flows.length).toBeGreaterThan(0);
    flows.forEach((flow) => {
      expect(flow.type).toBe('guided_conversation');
      expect(flow.entry.enteringPhrases.length).toBeGreaterThan(0);
    });
    expect(flows.some((flow) => flow.purpose === 'orientation_entry')).toBe(true);
    expect(flows.some((flow) => flow.purpose === 'post_flow_routing')).toBe(true);
  });
});

describe('Featured image options', () => {
  it('defines bundled catalog images', () => {
    expect(featuredImageOptions.length).toBeGreaterThan(0);
    featuredImageOptions.forEach((option) => {
      expect(option.id).toBeTruthy();
      expect(option.src).toBeTruthy();
      expect(option.alt).toBeTruthy();
    });
  });
});

describe('Education resource groups', () => {
  it('exports an array that is not empty', () => {
    expect(educationResourceGroups).toBeInstanceOf(Array);
    expect(educationResourceGroups.length).toBeGreaterThan(0);
  });

  it('every group has required id, title, and numeric order', () => {
    educationResourceGroups.forEach((group: EducationResourceGroup) => {
      expect(typeof group.id).toBe('string');
      expect(group.id).toBeTruthy();
      expect(typeof group.title).toBe('string');
      expect(group.title).toBeTruthy();
      expect(typeof group.order).toBe('number');
    });
  });

  it('every group has a unique id', () => {
    const ids = educationResourceGroups.map((g: EducationResourceGroup) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no group uses the reserved geral ID', () => {
    const ids = educationResourceGroups.map((g: EducationResourceGroup) => g.id);
    expect(ids).not.toContain(DEFAULT_EDUCATION_GROUP_ID);
  });

  it('includes the shipped groups: auto-cuidado, sala-de-aula, formacao', () => {
    const ids = educationResourceGroups.map((g: EducationResourceGroup) => g.id);
    expect(ids).toContain('auto-cuidado');
    expect(ids).toContain('sala-de-aula');
    expect(ids).toContain('formacao');
  });
});
