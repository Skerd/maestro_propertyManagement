import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {maintenancePlanTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenancePlan/maintenancePlan.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
const planTypeOptions = maintenancePlanTypeValues.map((v) => ({value: v, label: v}));
export const maintenancePlanSheetView: ViewConfig = {
    model: "maintenanceplans", viewType: "sheet", accessModel: "maintenanceplans", apiUrl: "/api/realEstate/maintenancePlan",
    header: {titleField: "title", subtitleKey: "maintenancePlan", showCloseButton: true},
    nodes: [{render: "#SheetGroup", props: {title: "overview"}, children: [{render: "#SheetGrid", props: {columns: 3}, children: [
        {render: "#DisplayCard", permissions: {read: "name"}, field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "title"}, field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "asset"}, dependent: "asset", field: {name: "asset.title", widget: "#DisplayCard", label: "asset", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "planType"}, dependent: "planType", field: {name: "planType", widget: "#DisplayCard", label: "planType", widgetProps: {icon: "#IconLabel", languageKeyCategory: "planTypes"}}},
        {render: "#DisplayCard", permissions: {read: "intervalDays"}, dependent: "intervalDays", field: {name: "intervalDays", widget: "#DisplayCard", label: "intervalDays", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "nextDueAt"}, dependent: "nextDueAt", field: {name: "nextDueAt", widget: "#DisplayCard", label: "nextDueAt", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "responsibleParty"}, dependent: "responsibleParty", field: {name: "responsibleParty", widget: "#DisplayCard", label: "responsibleParty", widgetProps: {icon: "#IconLabel"}}},
        {render: "#DisplayCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
    ]}]},
        lifecycleSheetGroup,
    ],
};
const formNodes: ViewConfig["nodes"] = [{render: "#TitleWithCollapse", props: {title: "generalInfo"}, children: [{render: "#FormGrid", props: {columns: 2}, children: [
    {render: "#Field", field: {name: "asset", widget: "#ApiSelect", label: "form.assetLabel", placeholder: "form.assetPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/asset/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
    {render: "#Field", field: {name: "planType", widget: "#Select", label: "form.planTypeLabel", placeholder: "form.planTypePlaceholder", widgetProps: {options: planTypeOptions, className: "grow w-full"}}},
    {render: "#Field", field: {name: "intervalDays", widget: "#Input", label: "form.intervalDaysLabel", placeholder: "form.intervalDaysPlaceholder", widgetProps: {type: "number"}}},
    {render: "#Field", field: {name: "nextDueAt", widget: "#DateInput", label: "form.nextDueAtLabel", placeholder: "form.nextDueAtPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
    {render: "#Field", field: {name: "responsibleParty", widget: "#Input", label: "form.responsiblePartyLabel", placeholder: "form.responsiblePartyPlaceholder"}},
    {render: "#Field", field: {name: "active", widget: "#Switch", label: "form.activeLabel"}},
    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
]}]}];
export const maintenancePlanCreateFormView: ViewConfig = {model: "maintenanceplans", viewType: "form", viewMode: "create", accessModel: "maintenanceplans", apiUrl: "/api/realEstate/maintenancePlan", method: "PUT", nodes: formNodes};
export const maintenancePlanEditFormView: ViewConfig = {model: "maintenanceplans", viewType: "form", viewMode: "edit", accessModel: "maintenanceplans", apiUrl: "/api/realEstate/maintenancePlan", method: "PATCH", nodes: formNodes};
export const maintenancePlanViews: ViewConfig[] = [maintenancePlanSheetView, maintenancePlanCreateFormView, maintenancePlanEditFormView];
