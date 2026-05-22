import { createContext, useContext } from 'react';

export type TabId =
  | 'overview'
  | 'seasons'
  | 'standings'
  | 'matchups'
  | 'h2h'
  | 'players';

export type View =
  | { kind: 'tab'; id: TabId }
  | { kind: 'manager'; ownerId: string };

interface NavCtx {
  view: View;
  goTo: (v: View) => void;
}

export const NavContext = createContext<NavCtx | null>(null);

export function useNav(): NavCtx {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside <NavContext.Provider>');
  return ctx;
}
