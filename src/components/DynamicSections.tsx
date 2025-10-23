'use client';

import { useState, lazy, Suspense } from 'react';

// Lazy loaded komponenty - načtou se až když jsou potřeba
const Snacks = lazy(() => import('./sections/Snacks'));
const Healthy = lazy(() => import('./sections/Healthy'));
const About = lazy(() => import('./sections/About'));

// Import první sekce přímo - načte se hned
import Breakfast from './sections/Breakfast';

const sections = [
  {
    id: 'snidane',
    name: 'Snídaňová nabídka',
    icon: '🌅',
    component: Breakfast,
    lazy: false,
  },
  {
    id: 'svacinky',
    name: 'Svačinky',
    icon: '🍪',
    component: Snacks,
    lazy: true,
  },
  {
    id: 'zdrave',
    name: 'Zdravé mlsání',
    icon: '🥗',
    component: Healthy,
    lazy: true,
  },
  { id: 'onas', name: 'O nás', icon: '👩‍🍳', component: About, lazy: true },
];

// Loading spinner komponenta
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      <span className="ml-3 text-zinc-600 dark:text-zinc-400">
        Načítá se...
      </span>
    </div>
  );
}

export default function DynamicSections() {
  const [activeSection, setActiveSection] = useState('snidane');

  const renderSection = () => {
    const section = sections.find(s => s.id === activeSection);
    if (!section) return null;

    // Pro první sekci (breakfast) vyrendruj přímo bez lazy loading
    if (activeSection === 'snidane') {
      return <Breakfast />;
    }

    // Pro ostatní sekce použij lazy loading
    const LazyComponent = section.component;
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <LazyComponent />
      </Suspense>
    );
  };

  return (
    <div className="space-y-8">
      {/* Navigační tabs */}
      <div className="flex flex-wrap justify-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${
                activeSection === section.id
                  ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-700/50'
              }
            `}
          >
            <span className="text-lg">{section.icon}</span>
            <span>{section.name}</span>
          </button>
        ))}
      </div>

      {/* Aktivní sekce */}
      <div className="min-h-[400px]">{renderSection()}</div>

      {/* Indikátor načítání */}
      <div className="text-center text-xs text-zinc-500 dark:text-zinc-500">
        {sections.find(s => s.id === activeSection)?.lazy && (
          <span>
            💡 Tato sekce se načítá na vyžádání pro rychlejší první načtení
            stránky
          </span>
        )}
      </div>
    </div>
  );
}
