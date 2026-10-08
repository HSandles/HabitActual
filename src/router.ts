import { useEffect, useState } from 'react';

// Hash routes (#/challenges, #/c/<id>) work on GitHub Pages without server rewrites
// and give the phone's back gesture something to go back to.
export type Route =
  | { name: 'today' }
  | { name: 'challenges' }
  | { name: 'challenge'; id: string }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'settings' };

function parse(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/');
  switch (a) {
    case 'challenges': return { name: 'challenges' };
    case 'c': return b ? { name: 'challenge', id: b } : { name: 'challenges' };
    case 'new': return { name: 'new' };
    case 'edit': return b ? { name: 'edit', id: b } : { name: 'challenges' };
    case 'settings': return { name: 'settings' };
    default: return { name: 'today' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string, { replace = false } = {}): void {
  if (replace) location.replace(`#${path}`);
  else location.hash = path;
}
