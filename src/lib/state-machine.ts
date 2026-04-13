import { StructureState, TimerKind } from "@prisma/client";

export type TransitionAction =
  | "SHIELD_DOWN"    // Shield stripped → starts SHIELD_TO_ARMOR timer
  | "ARMOR_DOWN"     // Armor stripped → starts ARMOR_TO_HULL timer
  | "HULL_DOWN"      // Hull destroyed
  | "REGENERATED"    // POS repaired itself, back to shield
  | "MARK_DEAD"      // Manually mark as destroyed
  | "CANCEL_TIMER";  // Cancel current timer (entry error)

interface TransitionResult {
  nextState: StructureState;
  timerKind?: TimerKind;   // set if a new timer should be created
  clearTimer?: boolean;     // set if the active timer should be cleared
  eventAction: string;
}

// Valid transitions map: [currentState][action] → result
const TRANSITIONS: Partial<Record<
  StructureState,
  Partial<Record<TransitionAction, TransitionResult>>
>> = {
  SHIELD: {
    SHIELD_DOWN: {
      nextState: "ARMOR_TIMER",
      timerKind: "SHIELD_TO_ARMOR",
      eventAction: "SHIELD_DOWN",
    },
    MARK_DEAD: {
      nextState: "DEAD",
      clearTimer: true,
      eventAction: "MARKED_DEAD",
    },
  },
  ARMOR_TIMER: {
    REGENERATED: {
      nextState: "SHIELD",
      clearTimer: true,
      eventAction: "REGENERATED",
    },
    CANCEL_TIMER: {
      nextState: "SHIELD",
      clearTimer: true,
      eventAction: "CANCELLED",
    },
    MARK_DEAD: {
      nextState: "DEAD",
      clearTimer: true,
      eventAction: "MARKED_DEAD",
    },
  },
  ARMOR_VULNERABLE: {
    ARMOR_DOWN: {
      nextState: "HULL_TIMER",
      timerKind: "ARMOR_TO_HULL",
      eventAction: "ARMOR_DOWN",
    },
    REGENERATED: {
      nextState: "SHIELD",
      clearTimer: true,
      eventAction: "REGENERATED",
    },
    MARK_DEAD: {
      nextState: "DEAD",
      clearTimer: true,
      eventAction: "MARKED_DEAD",
    },
  },
  HULL_TIMER: {
    REGENERATED: {
      nextState: "SHIELD",
      clearTimer: true,
      eventAction: "REGENERATED",
    },
    CANCEL_TIMER: {
      nextState: "ARMOR_VULNERABLE",
      clearTimer: true,
      eventAction: "CANCELLED",
    },
    MARK_DEAD: {
      nextState: "DEAD",
      clearTimer: true,
      eventAction: "MARKED_DEAD",
    },
  },
  HULL_VULNERABLE: {
    MARK_DEAD: {
      nextState: "DEAD",
      clearTimer: true,
      eventAction: "MARKED_DEAD",
    },
    REGENERATED: {
      nextState: "SHIELD",
      clearTimer: true,
      eventAction: "REGENERATED",
    },
  },
};

export function canTransition(
  currentState: StructureState,
  action: TransitionAction
): boolean {
  return !!TRANSITIONS[currentState]?.[action];
}

export function getTransition(
  currentState: StructureState,
  action: TransitionAction
): TransitionResult {
  const result = TRANSITIONS[currentState]?.[action];
  if (!result) {
    throw new Error(
      `Invalid transition: ${action} from state ${currentState}`
    );
  }
  return result;
}

// Actions available for each state (for the UI)
export function availableActions(state: StructureState): TransitionAction[] {
  const map = TRANSITIONS[state];
  if (!map) return [];
  return Object.keys(map) as TransitionAction[];
}

export function stateLabel(state: StructureState): string {
  const labels: Record<StructureState, string> = {
    SHIELD: "Shield",
    ARMOR_TIMER: "Armor Timer",
    ARMOR_VULNERABLE: "Armor Vulnerable",
    HULL_TIMER: "Hull Timer",
    HULL_VULNERABLE: "Hull Vulnerable",
    DEAD: "Dead",
  };
  return labels[state];
}

export function actionLabel(action: TransitionAction): string {
  const labels: Record<TransitionAction, string> = {
    SHIELD_DOWN: "Shield Down",
    ARMOR_DOWN: "Armor Down",
    HULL_DOWN: "Hull Down",
    REGENERATED: "POS Regenerated",
    MARK_DEAD: "Mark as Dead",
    CANCEL_TIMER: "Cancel Timer",
  };
  return labels[action];
}

// Returns true if the action requires an expiresAt datetime input
export function requiresTimer(action: TransitionAction): boolean {
  return action === "SHIELD_DOWN" || action === "ARMOR_DOWN";
}
