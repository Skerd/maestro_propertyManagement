import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const assetSheetView: ViewConfig = {
    model: "assets", viewType: "sheet", accessModel: "assets", apiUrl: "/api/realEstate/asset",
    header: {titleField: "title", subtitleKey: "asset", showCloseButton: true},
    nodes: [{render: "#SheetGroup", props: {title: "overview"}, children: [{render: "#SheetGrid", props: {columns: 3}, children: [
        {render: "#SmallInfoCard", permissions: {read: "name"}, field: {name: "name", widget: "#SmallInfoCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "title"}, field: {name: "title", widget: "#SmallInfoCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "edifice"}, dependent: "edifice", field: {name: "edifice.name", widget: "#SmallInfoCard", label: "edifice", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "category"}, dependent: "category", field: {name: "category", widget: "#SmallInfoCard", label: "category", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "manufacturer"}, dependent: "manufacturer", field: {name: "manufacturer", widget: "#SmallInfoCard", label: "manufacturer", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "serial"}, dependent: "serial", field: {name: "serial", widget: "#SmallInfoCard", label: "serial", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "installDate"}, dependent: "installDate", field: {name: "installDate", widget: "#SmallInfoCard", label: "installDate", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "lifecycleStatus"}, field: {name: "lifecycleStatus", widget: "#SmallInfoCard", label: "lifecycleStatus", widgetProps: {icon: "#CircleDot", languageKeyCategory: "lifecycleStatuses"}}},
    ]}]}],
};

const formNodes: ViewConfig["nodes"] = [{render: "#TitleWithCollapse", props: {title: "generalInfo"}, children: [{render: "#FormGrid", props: {columns: 2}, children: [
    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
    {render: "#Field", field: {name: "category", widget: "#Input", label: "form.categoryLabel", placeholder: "form.categoryPlaceholder"}},
    {render: "#Field", field: {name: "manufacturer", widget: "#Input", label: "form.manufacturerLabel", placeholder: "form.manufacturerPlaceholder"}},
    {render: "#Field", field: {name: "serial", widget: "#Input", label: "form.serialLabel", placeholder: "form.serialPlaceholder"}},
    {render: "#Field", field: {name: "installDate", widget: "#DateInput", label: "form.installDateLabel", placeholder: "form.installDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
    {render: "#Field", field: {name: "warranty", widget: "#ApiSelect", label: "form.warrantyLabel", placeholder: "form.warrantyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/warranty/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
]}]}];

export const assetCreateFormView: ViewConfig = {model: "assets", viewType: "form", viewMode: "create", accessModel: "assets", apiUrl: "/api/realEstate/asset", method: "PUT", nodes: formNodes};
export const assetEditFormView: ViewConfig = {model: "assets", viewType: "form", viewMode: "edit", accessModel: "assets", apiUrl: "/api/realEstate/asset", method: "PATCH", nodes: formNodes};
export const assetViews: ViewConfig[] = [assetSheetView, assetCreateFormView, assetEditFormView];
