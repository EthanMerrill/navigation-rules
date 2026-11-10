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
 *
 * `epoch` identifies the "run" of worlds the memory belongs to. When it changes
 * (a scenario was loaded), the step starts from empty memory so history from an
 * unrelated world cannot leak in, e.g. as a spurious Rule 15 "right of way
 * changed hands".
 */
export function useRulesEngine(world: WorldState, epoch = 0): RuleEvaluation {
	const memoryRef = useRef<{epoch: number; memory: EngineMemory | null}>({epoch, memory: null});

	const result = useMemo(() => {
		const stored = memoryRef.current;
		return step(world, stored.epoch === epoch ? stored.memory : null, performance.now());
	}, [world, epoch]);

	useEffect(() => {
		memoryRef.current = {epoch, memory: result.memory};
	}, [result, epoch]);

	return result.evaluation;
}
