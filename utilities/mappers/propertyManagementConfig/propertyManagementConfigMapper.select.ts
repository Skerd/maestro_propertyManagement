import type {IPropertyManagementConfig} from "../../../database/schemas/propertyManagementConfig/propertyManagementConfig";

export function propertyManagementConfigsToSelect(docs: IPropertyManagementConfig[]) {
    return docs.map((doc) => ({
        value: doc._id.toString(),
        label: "Sales & Handover",
    }));
}
