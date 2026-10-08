import { useRoute, type Route } from './router';
import { Today } from './screens/Today';
import { Challenges } from './screens/Challenges';
import { ChallengeDetail } from './screens/ChallengeDetail';
import { ChallengeForm } from './screens/ChallengeForm';
import { Settings } from './screens/Settings';

const TABS = [
  { href: '#/', label: 'Today', icon: '✓', match: ['today'] },
  { href: '#/challenges', label: 'Challenges', icon: '◎', match: ['challenges', 'challenge', 'new', 'edit'] },
  { href: '#/settings', label: 'Settings', icon: '⚙', match: ['settings'] },
];

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'today': return <Today />;
    case 'challenges': return <Challenges />;
    case 'challenge': return <ChallengeDetail id={route.id} />;
    case 'new': return <ChallengeForm />;
    case 'edit': return <ChallengeForm key={route.id} id={route.id} />;
    case 'settings': return <Settings />;
  }
}

export function App() {
  const route = useRoute();
  return (
    <div className="app">
      <Screen route={route} />
      <nav className="tabbar">
        {TABS.map((t) => (
          <a key={t.href} href={t.href} className={t.match.includes(route.name) ? 'active' : ''}
            aria-current={t.match.includes(route.name) ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
