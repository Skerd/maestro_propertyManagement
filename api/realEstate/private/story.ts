import {ObjectId} from "mongodb";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {StorySchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/story.schema-def";
import {createStoryFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/createStory.form.validator";
import {editStoryFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/editStory.form.validator";
import {storyFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/story/story.form.validator";
import Story from "../../../database/schemas/story/story";
import {storyService} from "../../../database/schemas/story/story.service";
import {storyToDTO, storiesToDTO} from "../../../utilities/mappers/story/storyMapper.dto";
import {storiesToSelect} from "../../../utilities/mappers/story/storyMapper.select";

const mediaUpload = mediaUploadMW({
    fields: {mainImage: 1, imageGallery: 20, videoGallery: 10},
    maxFileSize: 250 * 1024 * 1024,
});

const dateTransform = (v: unknown) => (v ? new Date(v as string) : undefined);

function ensurePublishedAt(data: Record<string, any>) {
    if (data.published === true && !data.publishedAt) {
        data.publishedAt = new Date();
    }
    return data;
}

export const {router} = createCrudRouter({
    collectionName: "stories",
    model: Story,
    service: storyService,
    entityName: "Story",
    listSchema: storyFormSchema,
    createSchema: createStoryFormSchema,
    editSchema: editStoryFormSchema,
    toDTO: storyToDTO,
    toDTOArray: storiesToDTO,
    toSelect: storiesToSelect,
    defaultSort: {sortOrder: 1, publishedAt: -1, createdAt: -1},
    selectSort: {title: 1},
    selectSearchField: "title",
    createMiddleware: [mediaUpload],
    editMiddleware: [mediaUpload],
    extraListFilter: async ({project, edifice, unit}: any) => {
        const filter: Record<string, any> = {};
        if (project && project !== "" && ObjectId.isValid(String(project))) {
            filter.project = new ObjectId(String(project));
        }
        if (edifice && edifice !== "" && ObjectId.isValid(String(edifice))) {
            filter.edifice = new ObjectId(String(edifice));
        }
        if (unit && unit !== "" && ObjectId.isValid(String(unit))) {
            filter.unit = new ObjectId(String(unit));
        }
        return filter;
    },
    buildCreateData: async (params: any) => {
        const data = buildCreateDataFromSchemaDef(StorySchemaDef, {
            publishedAt: dateTransform,
        })(params);
        if (data.published === undefined) data.published = true;
        if (data.sortOrder === undefined) data.sortOrder = 0;
        return ensurePublishedAt(data);
    },
    buildUpdateData: async (params: any, writeFields) => {
        const data = buildUpdateDataFromSchemaDef(StorySchemaDef, {
            publishedAt: dateTransform,
        })(params, writeFields);
        return ensurePublishedAt(data);
    },
});
