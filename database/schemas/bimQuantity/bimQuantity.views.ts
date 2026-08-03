import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
export const bimQuantitySheetView: ViewConfig = {
    model: "bimquantities", viewType: "sheet", accessModel: "bimquantities", apiUrl: "/api/realEstate/bimQuantity",
    header: {titleField: "name", subtitleKey: "bimQuantity", showCloseButton: true},
    nodes: [{render: "#SheetGroup", props: {title: "overview"}, children: [{render: "#SheetGrid", props: {columns: 3}, children: [
        {render: "#SmallInfoCard", permissions: {read: "name"}, field: {name: "name", widget: "#SmallInfoCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "bimModel"}, dependent: "bimModel", field: {name: "bimModel.title", widget: "#SmallInfoCard", label: "bimModel", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "ifcElementType"}, dependent: "ifcElementType", field: {name: "ifcElementType", widget: "#SmallInfoCard", label: "ifcElementType", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "classificationCode"}, dependent: "classificationCode", field: {name: "classificationCode", widget: "#SmallInfoCard", label: "classificationCode", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "quantity"}, dependent: "quantity", field: {name: "quantity", widget: "#SmallInfoCard", label: "quantity", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "unitOfMeasure"}, dependent: "unitOfMeasure", field: {name: "unitOfMeasure", widget: "#SmallInfoCard", label: "unitOfMeasure", widgetProps: {icon: "#IconLabel"}}},
        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
    ]}]},
        lifecycleSheetGroup,
    ],
};
const formNodes: ViewConfig["nodes"] = [{render: "#TitleWithCollapse", props: {title: "generalInfo"}, children: [{render: "#FormGrid", props: {columns: 2}, children: [
    {render: "#Field", field: {name: "bimModel", widget: "#ApiSelect", label: "form.bimModelLabel", placeholder: "form.bimModelPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/bimModel/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
    {render: "#Field", field: {name: "ifcElementType", widget: "#Input", label: "form.ifcElementTypeLabel", placeholder: "form.ifcElementTypePlaceholder"}},
    {render: "#Field", field: {name: "classificationCode", widget: "#Input", label: "form.classificationCodeLabel", placeholder: "form.classificationCodePlaceholder"}},
    {render: "#Field", field: {name: "quantity", widget: "#Input", label: "form.quantityLabel", placeholder: "form.quantityPlaceholder", widgetProps: {type: "number", step: "0.01"}}},
    {render: "#Field", field: {name: "unitOfMeasure", widget: "#Input", label: "form.unitOfMeasureLabel", placeholder: "form.unitOfMeasurePlaceholder"}},
    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
]}]}];
export const bimQuantityCreateFormView: ViewConfig = {model: "bimquantities", viewType: "form", viewMode: "create", accessModel: "bimquantities", apiUrl: "/api/realEstate/bimQuantity", method: "PUT", nodes: formNodes};
export const bimQuantityEditFormView: ViewConfig = {model: "bimquantities", viewType: "form", viewMode: "edit", accessModel: "bimquantities", apiUrl: "/api/realEstate/bimQuantity", method: "PATCH", nodes: formNodes};
export const bimQuantityViews: ViewConfig[] = [bimQuantitySheetView, bimQuantityCreateFormView, bimQuantityEditFormView];
