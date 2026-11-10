import {useEffect, useMemo, useRef} from "react";
import type {WorldState} from "../model/world";
import {EngineMemory, RuleEvaluation, step} from "../rules/rulesEngine";

/**
 * React glue around the pure rules engine. All history lives in `EngineMemory`,
 * threaded through `step`: this hook only holds the latest memory in a ref.
 *
 * The evaluation is computed in `useMemo` from the memory committed by the
 * previous render. The memory `step` returns is stored in a `useEffect`, not
 * during render, so rendering stays free of side effects (and safe under
 * StrictMode's double render): a render that is discarded never advances the
 * engine. Because effects run before the next world change can render, the
 * next `step` always sees the memory from the last committed frame.
 */
export function useRulesEngine(world: WorldState): RuleEvaluation {
	const memoryRef = useRef<EngineMemory | null>(null);

	const result = useMemo(() => step(world, memoryRef.current, performance.now()), [world]);

	useEffect(() => {
		memoryRef.current = result.memory;
	}, [result]);

	return result.evaluation;
}
