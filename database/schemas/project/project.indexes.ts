import {Schema} from "mongoose";

/**
 * Real Estate Project Indexes
 *
 * Complements ownershipPlugin ({ company: 1, _id: 1 }) and soft-delete (deletedAt).
 * Default reads add deletedAt: null via softDeletePlugin — include deletedAt in compounds
 * so list/count/sort and media lookups use index scans instead of filtering many rows.
 */
export function applyProjectIndexes(ProjectSchema: Schema): void {
    // POST /project — company-scoped table, default sort createdAt desc
    ProjectSchema.index({ company: 1, deletedAt: 1, createdAt: -1 });

    // POST /project/select — company + sort { name: 1 }
    ProjectSchema.index({ company: 1, deletedAt: 1, name: 1 });

    // Media access (company + mainImage | imageGallery | videoGallery)
    ProjectSchema.index({ company: 1, deletedAt: 1, mainImage: 1 });
    ProjectSchema.index({ company: 1, deletedAt: 1, imageGallery: 1 });
    ProjectSchema.index({ company: 1, deletedAt: 1, videoGallery: 1 });
}
