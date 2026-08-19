/**
 * Media backing the seeded stories; binary lives in ../hierarchy/media/.
 *
 * GENERATED from the live database by the Phase 2 export — regenerate rather than
 * hand-editing, unless you are deliberately curating the shipped defaults.
 */
import type {HierarchyMediaSeedRow} from "../hierarchy/types";

export const storyMediaSeed: readonly HierarchyMediaSeedRow[] = [
    {
        "mediaId": "6a503410d2892db79d54b554",
        "fileName": "floor-plan-B0-01 Floor -1-floor-[-1].png",
        "assetFile": "6a503410d2892db79d54b554.png",
        "mimeType": "image/png",
        "extension": "png",
        "fileSize": 103387,
        "type": "image"
    }
];

/** storyId → Media._id */
export const storyMainImageByStoryId: Readonly<Record<string, string>> = {
    "6a75f3031f81586ed20a389c": "6a503410d2892db79d54b554",
    "6a75f3031f81586ed20a389d": "6a503410d2892db79d54b554",
    "6a75f3031f81586ed20a389e": "6a503410d2892db79d54b554"
};
