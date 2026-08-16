import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const bidLineSheetView: ViewConfig = {
    model: "bidlines",
    viewType: "sheet",
    accessModel: "bidlines",
    apiUrl: "/api/realEstate/bidLine",
    header: {titleField: "name", subtitleKey: "bidLine", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "name"}, field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "bid"}, dependent: "bid", field: {name: "bid.name", widget: "#DisplayCard", label: "bid", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "specificationItem"}, dependent: "specificationItem", field: {name: "specificationItem.title", widget: "#DisplayCard", label: "specificationItem", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "title"}, dependent: "title", field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "quantity"}, dependent: "quantity", field: {name: "quantity", widget: "#DisplayCard", label: "quantity", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "unitPrice"}, dependent: "unitPrice", field: {name: "unitPrice", widget: "#DisplayCard", label: "unitPrice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "lineTotal"}, dependent: "lineTotal", field: {name: "lineTotal", widget: "#DisplayCard", label: "lineTotal", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#DisplayCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "alternativeNote"}, dependent: "alternativeNote", field: {name: "alternativeNote", widget: "#DisplayCard", label: "alternativeNote", widgetProps: {icon: "#IconLabel"}}},
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const formNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {render: "#Field", field: {name: "bid", widget: "#ApiSelect", label: "form.bidLabel", placeholder: "form.bidPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/bid/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "specificationItem", widget: "#ApiSelect", label: "form.specificationItemLabel", placeholder: "form.specificationItemPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/specificationItem/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder"}},
                    {render: "#Field", field: {name: "quantity", widget: "#Input", label: "form.quantityLabel", placeholder: "form.quantityPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "unitPrice", widget: "#Input", label: "form.unitPriceLabel", placeholder: "form.unitPricePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "sortIndex", widget: "#Input", label: "form.sortIndexLabel", placeholder: "form.sortIndexPlaceholder", widgetProps: {type: "number"}}},
                    {render: "#Field", field: {name: "alternativeNote", widget: "#Textarea", label: "form.alternativeNoteLabel", placeholder: "form.alternativeNotePlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const bidLineCreateFormView: ViewConfig = {
    model: "bidlines", viewType: "form", viewMode: "create", accessModel: "bidlines",
    apiUrl: "/api/realEstate/bidLine", method: "PUT", nodes: formNodes,
};

export const bidLineEditFormView: ViewConfig = {
    model: "bidlines", viewType: "form", viewMode: "edit", accessModel: "bidlines",
    apiUrl: "/api/realEstate/bidLine", method: "PATCH", nodes: formNodes,
};

export const bidLineViews: ViewConfig[] = [bidLineSheetView, bidLineCreateFormView, bidLineEditFormView];
