import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const tenderInvitationSheetView: ViewConfig = {
    model: "tenderinvitations",
    viewType: "sheet",
    accessModel: "tenderinvitations",
    apiUrl: "/api/realEstate/tenderInvitation",
    header: {titleField: "name", subtitleKey: "tenderInvitation", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "tender"}, dependent: "tender", field: {name: "tender.title", widget: "#DisplayCard", label: "tender", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "constructorRef"}, dependent: "constructorRef", field: {name: "constructorRef.name", widget: "#DisplayCard", label: "constructorRef", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "invitedAt"}, dependent: "invitedAt", field: {name: "invitedAt", widget: "#DisplayCard", label: "invitedAt", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "respondedAt"}, dependent: "respondedAt", field: {name: "respondedAt", widget: "#DisplayCard", label: "respondedAt", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "portalAccessToken"}, dependent: "portalAccessToken", field: {name: "portalAccessToken", widget: "#DisplayCard", label: "portalAccessToken", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "invitedAt", widget: "#DateInput", label: "form.invitedAtLabel", placeholder: "form.invitedAtPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const tenderInvitationCreateFormView: ViewConfig = {
    model: "tenderinvitations", viewType: "form", viewMode: "create", accessModel: "tenderinvitations",
    apiUrl: "/api/realEstate/tenderInvitation", method: "PUT", nodes: formNodes,
};

export const tenderInvitationEditFormView: ViewConfig = {
    model: "tenderinvitations", viewType: "form", viewMode: "edit", accessModel: "tenderinvitations",
    apiUrl: "/api/realEstate/tenderInvitation", method: "PATCH", nodes: formNodes,
};

export const tenderInvitationViews: ViewConfig[] = [tenderInvitationSheetView, tenderInvitationCreateFormView, tenderInvitationEditFormView];
