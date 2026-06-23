import type { ComponentType } from 'react'
import SearchView from './views/SearchView'
import SettingsView from './views/SettingsView'
import SavedWordsView from './views/SavedWordsView'
import OnboardingView from './views/OnboardingView'

// Every app window loads the same bundle and selects its view by URL hash.
// Each view is mounted as its own root component, so no hook ever runs
// conditionally (the hazard the old early-return-before-hooks code carried).
const ROUTES: Record<string, ComponentType> = {
  '#/settings': SettingsView,
  '#/saved': SavedWordsView,
  '#/onboarding': OnboardingView,
}

export default function Router() {
  const View = ROUTES[window.location.hash] ?? SearchView
  return <View />
}
