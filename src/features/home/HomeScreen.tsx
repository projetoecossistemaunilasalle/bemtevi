import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowRight, Compass, GraduationCap, MapPin, MessageCircleHeart, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../app/routes';
import { homeCopy } from '../../content/copy/home';
import { ActionCard } from '../../design-system/components/ActionCard';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import { isFirstVisit, markVisited } from './firstVisit';
import { OnboardingScreen } from './OnboardingScreen';

export function HomeScreen() {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(isFirstVisit());
  const [supportAction, orientationAction, contactsAction] = homeCopy.actions;

  function handleOnboardingComplete() {
    markVisited();
    setShowOnboarding(false);
  }

  return (
    <AnimatePresence mode="wait">
      {showOnboarding ? (
        <OnboardingScreen key="onboarding" onContinue={handleOnboardingComplete} />
      ) : (
        <Page key="home" className="items-center text-center">
          <section className="flex flex-col items-center text-center gap-stack-sm max-w-3xl">
            <h1 className="font-display-lg text-on-surface">{homeCopy.greeting}</h1>
            <p className="font-body-lg text-on-surface-variant max-w-2xl">{homeCopy.subtitle}</p>
            <p className="font-body-md text-on-surface-variant max-w-2xl">{homeCopy.educationalDisclaimer}</p>
            <Card className="p-4 flex items-start gap-4 mt-stack-sm text-left max-w-xl w-full bg-surface-container">
              <Shield className="text-secondary shrink-0 mt-1" size={24} />
              <p className="font-body-md text-on-surface-variant">{homeCopy.privacyReassurance}</p>
            </Card>
          </section>

          <section className="flex flex-col gap-3 max-w-5xl w-full mx-auto">
            <div className="flex flex-col gap-1 text-left px-1">
              <h2 className="font-headline-sm text-on-surface">Escolha por onde começar</h2>
              <p className="font-body-md text-on-surface-variant">
                Escolha o caminho que mais combina com o que você precisa agora.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-sm">
              <ActionCard
                icon={<MessageCircleHeart className="text-primary" size={22} />}
                label={supportAction.label}
                description={supportAction.description}
                onClick={() => navigate(routes.support)}
              />
              <ActionCard
                icon={<Compass size={22} />}
                label={orientationAction.label}
                description={orientationAction.description}
                onClick={() => navigate(routes.orientation)}
              />
              <ActionCard
                icon={<MapPin size={22} />}
                label={contactsAction.label}
                description={contactsAction.description}
                onClick={() => navigate(routes.contacts)}
              />
            </div>
            {homeCopy.materialsAction ? (
              <Link
                to={routes.education}
                className="w-full bg-surface-container-lowest border border-outline-variant hover:bg-surface-container-low hover:border-secondary active:scale-[0.99] transition-all duration-200 rounded-xl px-5 py-3.5 flex items-center justify-between text-left gap-4 shadow-sm group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="p-2.5 rounded-lg bg-surface-container text-secondary shrink-0 group-hover:scale-105 transition-transform">
                    <GraduationCap size={22} />
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="font-headline-sm text-base text-on-surface">{homeCopy.materialsAction.label}</span>
                    <span className="font-body-md text-sm text-on-surface-variant">
                      {homeCopy.materialsAction.description}
                    </span>
                  </div>
                </div>
                <ArrowRight
                  size={20}
                  className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 shrink-0 transition-all"
                  aria-hidden="true"
                />
              </Link>
            ) : null}
          </section>
        </Page>
      )}
    </AnimatePresence>
  );
}
