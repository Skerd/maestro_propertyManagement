import {storyTypeService} from "../../../database/schemas/storyType/storyType.service";
import {storyService} from "../../../database/schemas/story/story.service";
import {createStoryTypeFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/storyType/createStoryType.form.validator";
import {editStoryTypeFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/storyType/editStoryType.form.validator";
import StoryType from "../../../database/schemas/storyType/storyType";
import {storyTypesToDTO, storyTypeToDTO} from "../../../utilities/mappers/storyType/storyTypeMapper.dto";
import {storyTypesToSelect} from "../../../utilities/mappers/storyType/storyTypeMapper.select";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {StoryTypeSchemaDef} from "armonia/src/modules/propertyManagement/api/realEstate/private/storyType/storyType.schema-def";

export const {router} = createCrudRouter({
    collectionName: "storytypes",
    model: StoryType,
    service: storyTypeService,
    entityName: "StoryType",
    createSchema: createStoryTypeFormSchema,
    editSchema: editStoryTypeFormSchema,
    toDTO: (doc) => storyTypeToDTO(doc),
    toDTOArray: (docs) => storyTypesToDTO(docs),
    toSelect: (docs) => storyTypesToSelect(docs),
    defaultSort: {sortOrder: 1, name: 1},
    selectSort: {sortOrder: 1, name: 1},
    selectSearchField: "name",
    buildCreateData: ({name, company, ...params}) => {
        return {
            ...buildCreateDataFromSchemaDef(StoryTypeSchemaDef)({name, company, ...params}),
            slug: `${company.name.toLowerCase().replace(/\s+/g, "")}_${name.toLowerCase().replace(/\s+/g, "")}`,
            sortOrder: params.sortOrder ?? 0,
        };
    },
    buildUpdateData: buildUpdateDataFromSchemaDef(StoryTypeSchemaDef, {}),
    beforeDelete: async ({session, logger, languageCode, company}, doc) => {
        const usedByStories = await storyService.exists(
            {storyType: doc._id, company: company._id},
            {session, logger},
        );
        if (usedByStories) {
            throw apiValidationException("story_type_in_use", "", null, languageCode);
        }
    },
});
