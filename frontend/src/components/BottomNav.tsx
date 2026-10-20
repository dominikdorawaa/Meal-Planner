import type { MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { t } from '../i18n';
import { HOME_TAB, TABS, useHomeBelowTabs, useTabNavigation } from '../lib/tabNavigation';
import { useTabSwipe } from '../lib/tabSwipe';
import { useTextEntryFocused } from '../lib/textEntryFocus';

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function BottomNav() {
  const path = useLocation().pathname;
  useHomeBelowTabs();
  const goToTab = useTabNavigation();
  const hidden = useTextEntryFocused();
  useTabSwipe(path, path !== HOME_TAB, goToTab);

  return (
    <nav
      aria-label={t('nav.label')}
      aria-hidden={hidden || undefined}
      className={`fixed bottom-0 w-full z-50 pointer-events-none transition-[opacity,transform] duration-200 ${hidden ? 'opacity-0 translate-y-4' : ''}`}
    >
      <div className={`bottom-nav fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-4 right-4 h-[58px] p-1 rounded-full flex items-stretch bg-surface-container-lowest/90 backdrop-blur-2xl shadow-ambient border border-surface-container-highest/20 ${hidden ? '' : 'pointer-events-auto'}`}>
        {TABS.map(tab => {
          const active = path === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
              tabIndex={hidden ? -1 : undefined}
              onClick={event => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                goToTab(tab.path);
              }}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-full active:scale-95 duration-200 ${active ? 'bg-primary/10 text-primary' : 'text-primary/50'}`}
            >
              <span className="material-symbols-outlined text-[22px]" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
              <span className={`font-body text-[10px] leading-none truncate max-w-full ${active ? 'font-bold' : 'font-medium'}`}>{t(tab.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
