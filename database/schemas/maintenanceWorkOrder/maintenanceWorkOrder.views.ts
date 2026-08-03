import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {maintenanceWorkOrderTypeValues} from "armonia/src/modules/propertyManagement/api/realEstate/private/maintenanceWorkOrder/maintenanceWorkOrder.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
const typeOptions = maintenanceWorkOrderTypeValues.map((v) => ({value: v, label: v}));
export const maintenanceWorkOrderSheetView: ViewConfig = {
    model: "maintenanceworkorders", viewType: "sheet", accessModel: "maintenanceworkorders", apiUrl: "/api/realEstate/maintenanceWorkOrder",
    header: {titleField: "title", subtitleKey: "maintenanceWorkOrder", showCloseButton: true},
    nodes: [{render: "#SheetGroup", props: {title: "overview"}, children: [{render: "#SheetGrid", props: {columns: 3}, children: [
        {render: "#SmallInfoCard", permissions: {read: "name"}, field: {name: "name", widget: "#SmallInfoCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "title"}, field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "plan"}, dependent: "plan", field: {name: "plan.title", widget: "#SmallInfoCard", label: "plan", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "asset"}, dependent: "asset", field: {name: "asset.title", widget: "#SmallInfoCard", label: "asset", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "type"}, dependent: "type", field: {name: "type", widget: "#SmallInfoCard", label: "type", widgetProps: {icon: "#IconLabel", languageKeyCategory: "types"}}},
        {render: "#SmallInfoCard", permissions: {read: "assignee"}, dependent: "assignee", field: {name: "assignee.name", widget: "#SmallInfoCard", label: "assignee", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "costEstimate"}, dependent: "costEstimate", field: {name: "costEstimate", widget: "#SmallInfoCard", label: "costEstimate", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "actualCost"}, dependent: "actualCost", field: {name: "actualCost", widget: "#SmallInfoCard", label: "actualCost", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "dueDate"}, dependent: "dueDate", field: {name: "dueDate", widget: "#SmallInfoCard", label: "dueDate", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "status"}, field: {name: "status", widget: "#SmallInfoCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
    ]}]},
        lifecycleSheetGroup,
    ],
};
const formNodes: ViewConfig["nodes"] = [{render: "#TitleWithCollapse", props: {title: "generalInfo"}, children: [{render: "#FormGrid", props: {columns: 2}, children: [
    {render: "#Field", field: {name: "plan", widget: "#ApiSelect", label: "form.planLabel", placeholder: "form.planPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/maintenancePlan/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "asset", widget: "#ApiSelect", label: "form.assetLabel", placeholder: "form.assetPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/asset/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
    {render: "#Field", field: {name: "type", widget: "#Select", label: "form.typeLabel", placeholder: "form.typePlaceholder", widgetProps: {options: typeOptions, className: "grow w-full"}}},
    {render: "#Field", field: {name: "assignee", widget: "#ApiSelect", label: "form.assigneeLabel", placeholder: "form.assigneePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "costEstimate", widget: "#Input", label: "form.costEstimateLabel", placeholder: "form.costEstimatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
    {render: "#Field", field: {name: "actualCost", widget: "#Input", label: "form.actualCostLabel", placeholder: "form.actualCostPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "dueDate", widget: "#DateInput", label: "form.dueDateLabel", placeholder: "form.dueDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
]}]}];
export const maintenanceWorkOrderCreateFormView: ViewConfig = {model: "maintenanceworkorders", viewType: "form", viewMode: "create", accessModel: "maintenanceworkorders", apiUrl: "/api/realEstate/maintenanceWorkOrder", method: "PUT", nodes: formNodes};
export const maintenanceWorkOrderEditFormView: ViewConfig = {model: "maintenanceworkorders", viewType: "form", viewMode: "edit", accessModel: "maintenanceworkorders", apiUrl: "/api/realEstate/maintenanceWorkOrder", method: "PATCH", nodes: formNodes};
export const maintenanceWorkOrderViews: ViewConfig[] = [maintenanceWorkOrderSheetView, maintenanceWorkOrderCreateFormView, maintenanceWorkOrderEditFormView];
