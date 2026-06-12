import { useStore } from "./useStore";

export const selectActiveScene = () =>
    useStore((state) =>
        state.ui.activeSceneId
            ? state.entities.scenes[state.ui.activeSceneId]
            : undefined
    );

export const selectSceneTokens = (sceneId: number) =>
    useStore((state) =>
        Object.values(state.entities.tokens).filter(
            (t) => t.sceneId === sceneId
        )
    );