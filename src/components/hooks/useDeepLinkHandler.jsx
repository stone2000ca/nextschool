'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { School } from '@/lib/entities';

/**
 * useDeepLinkHandler — E51-S1A
 *
 * Reads deep link URL params on Consultant mount, resolves school slug
 * to a school object, and triggers the correct tab/section/visit card.
 *
 * URL params consumed: school, tab, section, visitId
 * After hydration, params are cleaned from the URL via replaceState.
 *
 * Designed to run once on mount — will not re-trigger on subsequent
 * param changes (guarded by a "handled" ref).
 */
export function useDeepLinkHandler({
  setSelectedSchool,
  setDetailTab,
  setCurrentView,
}) {
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const schoolSlug = searchParams.get('school');
    const tab = searchParams.get('tab');
    const section = searchParams.get('section');
    const visitId = searchParams.get('visitId');

    // Nothing to do if no deep link params
    if (!schoolSlug && !tab && !section && !visitId) return;

    handledRef.current = true;

    async function resolve() {
      try {
        // Resolve school slug → school object
        if (schoolSlug) {
          const results = await School.filter({ slug: schoolSlug });
          const school = results?.[0];

          if (school) {
            setSelectedSchool(school);
            setCurrentView('detail');

            // Set tab if specified, otherwise default to overview
            if (tab) {
              setDetailTab(tab);
            }
          } else {
            console.warn('[DeepLink] School not found for slug:', schoolSlug);
          }
        }

        // Store section + visitId on window for downstream components to read
        // (S3/S4 will consume these to scroll to / expand the correct visit card)
        if (section || visitId) {
          window.__deepLinkContext = { section, visitId };
        }
      } catch (err) {
        console.error('[DeepLink] Error resolving deep link:', err);
      } finally {
        // Clean URL params so parent doesn't see long param strings
        cleanUrlParams();
      }
    }

    resolve();
  }, [searchParams, setSelectedSchool, setDetailTab, setCurrentView]);
}

/**
 * Remove deep link params from the URL without triggering a navigation.
 * Preserves any non-deep-link params (e.g. "q" for pending messages).
 */
function cleanUrlParams() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const deepLinkKeys = ['school', 'tab', 'section', 'visitId'];
  let changed = false;

  for (const key of deepLinkKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (changed) {
    window.history.replaceState({}, '', url.pathname + (url.search || ''));
  }
}
