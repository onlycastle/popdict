import type { ComponentType } from 'react'
import SearchView from './views/SearchView'
import SettingsView from './views/SettingsView'
import SavedWordsView from './views/SavedWordsView'
import OnboardingView from './views/OnboardingView'
import { resolveRoute, type Route } from './resolveRoute'

// Every app window loads the same bundle and selects its view by URL hash.
// Each view is mounted as its own root component, so no hook ever runs
// conditionally (the hazard the old early-return-before-hooks code carried).
const VIEWS: Record<Route, ComponentType> = {
  search: SearchView,
  settings: SettingsView,
  saved: SavedWordsView,
  onboarding: OnboardingView,
}

export default function Router() {
  const View = VIEWS[resolveRoute(window.location.hash)]
  return <View />
}
