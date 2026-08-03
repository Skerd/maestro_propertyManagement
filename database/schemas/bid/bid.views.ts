import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const bidSheetView: ViewConfig = {
    model: "bids",
    viewType: "sheet",
    accessModel: "bids",
    apiUrl: "/api/realEstate/bid",
    header: {titleField: "name", subtitleKey: "bid", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#SmallInfoCard", permissions: {read: "name"}, field: {name: "name", widget: "#SmallInfoCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "tender"}, dependent: "tender", field: {name: "tender.title", widget: "#SmallInfoCard", label: "tender", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "constructorRef"}, dependent: "constructorRef", field: {name: "constructorRef.name", widget: "#SmallInfoCard", label: "constructorRef", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "total"}, dependent: "total", field: {name: "total", widget: "#SmallInfoCard", label: "total", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "submittedAt"}, dependent: "submittedAt", field: {name: "submittedAt", widget: "#SmallInfoCard", label: "submittedAt", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "coveringNotes"}, dependent: "coveringNotes", field: {name: "coveringNotes", widget: "#SmallInfoCard", label: "coveringNotes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "status"}, field: {name: "status", widget: "#SmallInfoCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                    {render: "#Field", field: {name: "tender", widget: "#ApiSelect", label: "form.tenderLabel", placeholder: "form.tenderPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/tender/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "tenderInvitation", widget: "#ApiSelect", label: "form.tenderInvitationLabel", placeholder: "form.tenderInvitationPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/tenderInvitation/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "total", widget: "#Input", label: "form.totalLabel", placeholder: "form.totalPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "coveringNotes", widget: "#Textarea", label: "form.coveringNotesLabel", placeholder: "form.coveringNotesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const bidCreateFormView: ViewConfig = {
    model: "bids", viewType: "form", viewMode: "create", accessModel: "bids",
    apiUrl: "/api/realEstate/bid", method: "PUT", nodes: formNodes,
};

export const bidEditFormView: ViewConfig = {
    model: "bids", viewType: "form", viewMode: "edit", accessModel: "bids",
    apiUrl: "/api/realEstate/bid", method: "PATCH", nodes: formNodes,
};

export const bidViews: ViewConfig[] = [bidSheetView, bidCreateFormView, bidEditFormView];
