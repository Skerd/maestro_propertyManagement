import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
export const bimModelSheetView: ViewConfig = {
    model: "bimmodels", viewType: "sheet", accessModel: "bimmodels", apiUrl: "/api/realEstate/bimModel",
    header: {titleField: "title", subtitleKey: "bimModel", showCloseButton: true},
    nodes: [{render: "#SheetGroup", props: {title: "overview"}, children: [{render: "#SheetGrid", props: {columns: 3}, children: [
        {render: "#DisplayCard", permissions: {read: "name"}, field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "title"}, field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "project"}, dependent: "project", field: {name: "project.name", widget: "#DisplayCard", label: "project", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "version"}, dependent: "version", field: {name: "version", widget: "#DisplayCard", label: "version", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "elementCount"}, dependent: "elementCount", field: {name: "elementCount", widget: "#DisplayCard", label: "elementCount", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "importStatus"}, field: {name: "importStatus", widget: "#DisplayCard", label: "importStatus", widgetProps: {icon: "#CircleDot", languageKeyCategory: "importStatuses"}}},
    ]}]},
        lifecycleSheetGroup,
    ],
};
const formNodes: ViewConfig["nodes"] = [{render: "#TitleWithCollapse", props: {title: "generalInfo"}, children: [{render: "#FormGrid", props: {columns: 2}, children: [
    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
    {render: "#Field", field: {name: "version", widget: "#Input", label: "form.versionLabel", placeholder: "form.versionPlaceholder"}},
    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
]}]}];
export const bimModelCreateFormView: ViewConfig = {model: "bimmodels", viewType: "form", viewMode: "create", accessModel: "bimmodels", apiUrl: "/api/realEstate/bimModel", method: "PUT", nodes: formNodes};
export const bimModelEditFormView: ViewConfig = {model: "bimmodels", viewType: "form", viewMode: "edit", accessModel: "bimmodels", apiUrl: "/api/realEstate/bimModel", method: "PATCH", nodes: formNodes};
export const bimModelViews: ViewConfig[] = [bimModelSheetView, bimModelCreateFormView, bimModelEditFormView];
