import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Compass, MapPin, MessageCircleHeart, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
          <section className="flex flex-col items-center text-center gap-stack-sm">
            <h1 className="font-display-lg text-on-surface">{homeCopy.title}</h1>
            <p className="font-body-lg text-on-surface-variant max-w-2xl">{homeCopy.subtitle}</p>
            <Card className="p-4 flex items-start gap-4 mt-stack-sm text-left max-w-xl w-full bg-surface-container">
              <Shield className="text-secondary shrink-0 mt-1" size={24} />
              <p className="font-body-md text-on-surface-variant">{homeCopy.privacyReassurance}</p>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-stack-sm max-w-5xl w-full mx-auto">
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
          </section>
        </Page>
      )}
    </AnimatePresence>
  );
}
