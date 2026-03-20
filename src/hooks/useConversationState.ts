'use client';

import { useState, useCallback, useRef } from 'react';
import { STATES, BRIEF_STATUS } from '@/lib/stateMachineConfig';

// --- Types ---

type State = (typeof STATES)[keyof typeof STATES];
type BriefStatus = (typeof BRIEF_STATUS)[keyof typeof BRIEF_STATUS] | null;

export interface StateEnvelope {
  state: State;
  briefStatus: BriefStatus;
  previousState: State | null;
  transitionReason: string | null;
}

interface UseConversationStateReturn extends StateEnvelope {
  /** Call with the raw response.data from the orchestrate API to update state. */
  updateFromResponse: (data: Record<string, unknown>) => void;
}

// --- Defaults ---

const INITIAL_ENVELOPE: StateEnvelope = {
  state: STATES.WELCOME,
  briefStatus: null,
  previousState: null,
  transitionReason: null,
};

// --- Hook ---

/**
 * useConversationState (P4-S4.3)
 *
 * Consumes the stateEnvelope returned by orchestrate API responses and
 * exposes { state, briefStatus, previousState, transitionReason }.
 *
 * Falls back to legacy flat fields (response.data.state / .briefStatus)
 * when stateEnvelope is absent, for backward compatibility.
 */
export function useConversationState(
  initial?: Partial<StateEnvelope>,
): UseConversationStateReturn {
  const [envelope, setEnvelope] = useState<StateEnvelope>({
    ...INITIAL_ENVELOPE,
    ...initial,
  });

  // Ref to avoid stale closures in rapid successive calls
  const envelopeRef = useRef(envelope);
  envelopeRef.current = envelope;

  const updateFromResponse = useCallback(
    (data: Record<string, unknown>) => {
      if (!data) return;

      const raw = data.stateEnvelope as Partial<StateEnvelope> | undefined;

      if (raw && typeof raw === 'object' && raw.state) {
        // Primary path: stateEnvelope present
        setEnvelope({
          state: raw.state as State,
          briefStatus: (raw.briefStatus as BriefStatus) ?? null,
          previousState: (raw.previousState as State) ?? envelopeRef.current.state,
          transitionReason: (raw.transitionReason as string) ?? null,
        });
      } else if (data.state) {
        // Legacy fallback: flat fields on response.data
        setEnvelope((prev) => ({
          state: data.state as State,
          briefStatus: (data.briefStatus as BriefStatus) ?? prev.briefStatus,
          previousState: prev.state,
          transitionReason: null,
        }));
      }
      // If neither stateEnvelope nor state exists, keep current envelope unchanged
    },
    [],
  );

  return {
    ...envelope,
    updateFromResponse,
  };
}
