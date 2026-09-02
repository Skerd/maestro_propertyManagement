import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    CONSTRUCTOR_LONG_TEXT_MAX,
    CONSTRUCTOR_PHONE_MAX,
    CONSTRUCTOR_POSTAL_CODE_MAX,
    CONSTRUCTOR_SHORT_TEXT_MAX,
    CONSTRUCTOR_STREET_MAX,
    CONSTRUCTOR_URL_MAX,
    CONSTRUCTOR_VAT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructor/constructor.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const constructorSheetView: ViewConfig = {
    model: "constructors",
    viewType: "sheet",
    accessModel: "constructors",
    apiUrl: "/api/realEstate/constructor",
    header: {
        titleField: "name",
        subtitleKey: "constructor",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "name" },
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: { icon: "#Building2" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "vat" },
                            field: {
                                name: "vat",
                                widget: "#DisplayCard",
                                label: "vat",
                                widgetProps: { icon: "#Hash" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "phoneNumber" },
                            field: {
                                name: "phoneNumber",
                                widget: "#DisplayCard",
                                label: "phoneNumber",
                                widgetProps: { icon: "#Phone", type: "phoneNumber" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "email" },
                            field: {
                                name: "email",
                                widget: "#DisplayCard",
                                label: "email",
                                widgetProps: { icon: "#Mail", type: "email" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "website" },
                            field: {
                                name: "website",
                                widget: "#DisplayCard",
                                label: "website",
                                widgetProps: { icon: "#Globe", externalLink: true },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "partyType" },
                            field: {
                                name: "partyType",
                                widget: "#DisplayCard",
                                label: "partyType",
                                widgetProps: { icon: "#IconUsersGroup", languageKeyCategory: "partyTypes", type: "enum" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: { read: "trades" },
                            field: {
                                name: "trades",
                                widget: "#DisplayCard",
                                label: "trades",
                                widgetProps: { icon: "#Tools" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "insuranceExpiry",
                            permissions: { read: "insuranceExpiry" },
                            field: {
                                name: "insuranceExpiry",
                                widget: "#DisplayCard",
                                label: "insuranceExpiry",
                                widgetProps: { icon: "#Calendar", format: "date", type: "date" },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "performanceScore",
                            permissions: { read: "performanceScore" },
                            field: {
                                name: "performanceScore",
                                widget: "#DisplayCard",
                                label: "performanceScore",
                                widgetProps: { icon: "#Star", type: "number" },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: { columns: 1 },
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: { read: "description" },
                            field: {
                                name: "description",
                                widget: "#DisplayCard",
                                label: "description",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "constructor.sheet.addresses.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    props: {
                        title: "address",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    permissions: { read: "addresses" },
                    children: [
                        {
                            render: "div",
                            props: { className: "rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "addresses" },
                                    field: {
                                        name: "addresses",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#EmbeddedAddressCard",
                                            itemDataProp: "address",
                                            pageSize: 5,
                                            hideActions: true,
                                            listClassName: "max-h-auto",
                                            cardProps: { badgeAccessModel: "constructors" },
                                            compactRow: {
                                                icon: "#MapPin",
                                                label: "address",
                                                valuePath: ["city.name", "state.name", "country.name", "street", "postalCode"],
                                                joinSeparator: ", ",
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "logo" },
            permissions: { read: "logo" },
            children: [
                {
                    render: "div",
                    props: {
                        className: "max-w-[200px] aspect-square overflow-hidden rounded-lg",
                        style: { width: 200, height: 200, maxWidth: 200 },
                    },
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: { read: "logo" },
                            field: {
                                name: "logo",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    showThumbnails: false,
                                    allowFullScreen: false,
                                    coverAfterFirst: true,
                                    showPreviews: false,
                                    forcedAspectRatio: 1,
                                    className: "max-w-[200px] aspect-square overflow-hidden rounded-lg",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "edifices" },
            dependent: "edifices",
            dependentRuntimeOnly: true,
            children: [
                {
                    render: "div",
                    props: { className: "grid md:grid-cols-2 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ReferencesRender",
                            field: {
                                name: "edifices",
                                widget: "#ReferencesRender",
                                widgetProps: {
                                    cardWidget: "#EdificeCard",
                                    itemDataProp: "edifice",
                                    pageSize: 3,
                                    hideActions: true,
                                    listClassName: "max-h-auto"
                                },
                            },
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const constructorCreateFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: { maxLength: CONSTRUCTOR_SHORT_TEXT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "email",
                            widget: "#Input",
                            label: "form.emailLabel",
                            placeholder: "form.emailPlaceholder",
                            widgetProps: { type: "email", maxLength: 254 },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "phoneNumber",
                            widget: "#PhoneInput",
                            label: "form.phoneNumberLabel",
                            placeholder: "form.phoneNumberPlaceholder",
                            widgetProps: { defaultCountry: "AL", maxLength: CONSTRUCTOR_PHONE_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vat",
                            widget: "#Input",
                            label: "form.vatLabel",
                            placeholder: "form.vatPlaceholder",
                            required: true,
                            widgetProps: { maxLength: CONSTRUCTOR_VAT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "website",
                            widget: "#Input",
                            label: "form.websiteLabel",
                            placeholder: "form.websitePlaceholder",
                            widgetProps: { maxLength: CONSTRUCTOR_URL_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "partyType",
                            widget: "#SimpleSelect",
                            label: "form.partyTypeLabel",
                            placeholder: "form.partyTypePlaceholder",
                            widgetProps: {
                                options: [
                                    { value: "contractor", label: "form.partyTypeContractor" },
                                    { value: "architect", label: "form.partyTypeArchitect" },
                                    { value: "engineer", label: "form.partyTypeEngineer" },
                                    { value: "qs", label: "form.partyTypeQs" },
                                    { value: "pm", label: "form.partyTypePm" },
                                    { value: "surveyor", label: "form.partyTypeSurveyor" },
                                    { value: "other", label: "form.partyTypeOther" },
                                ],
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "trades",
                            widget: "#Input",
                            label: "form.tradesLabel",
                            placeholder: "form.tradesPlaceholder",
                            widgetProps: { maxLength: CONSTRUCTOR_SHORT_TEXT_MAX },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "insuranceExpiry",
                            widget: "#DateInput",
                            label: "form.insuranceExpiryLabel",
                            placeholder: "form.insuranceExpiryPlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "performanceScore",
                            widget: "#Input",
                            label: "form.performanceScoreLabel",
                            placeholder: "form.performanceScorePlaceholder",
                            widgetProps: { type: "number", min: 0, max: 100, step: "0.01" },
                        },
                    },
                    {
                        render: "div",
                        props: { className: "md:col-span-2 w-full space-y-1.5" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: { maxHeight: 250 },
                                        maxLength: CONSTRUCTOR_LONG_TEXT_MAX,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#Field",
        permissions: {write: "addresses"},
        field: {
            name: "addresses",
            widget: "#FormRepeater",
            widgetProps: {
                title: "howToReach",
                arrayField: "addresses",
                deleteField: "deleteAddresses",
                defaultItem: {
                    street: "",
                    postalCode: "",
                    city: "",
                    state: undefined,
                    country: "",
                    latitude: 41.3275,
                    longitude: 19.8189,
                },
                addLabel: "addAddress",
                removeLabel: "remove",
                rowTitleFields: ["street", "city", "state", "country", "postalCode"],
                rowTitlePlaceholder: "address",
                rowTemplate: [
                    {
                        render: "div",
                        props: {className: "grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"},
                        children: [
                            {
                                render: "div",
                                props: {className: "lg:col-span-2 space-y-6 min-w-0"},
                                children: [
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 3, className: "gap-6"},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "country",
                                                    widget: "#ApiSelect",
                                                    label: "form.countryLabel",
                                                    placeholder: "form.countryPlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/country/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        cascadeClearFormFields: ["state", "city"],
                                                    },
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "state",
                                                    widget: "#ApiSelect",
                                                    label: "form.stateLabel",
                                                    placeholder: "form.statePlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/state/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        postBodyFromFormFields: [{field: "country", paramName: "country"}],
                                                        enableWhenFormFieldsNonEmpty: ["country"],
                                                        cascadeClearFormFields: ["city"],
                                                    },
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "city",
                                                    widget: "#ApiSelect",
                                                    label: "form.cityLabel",
                                                    placeholder: "form.cityPlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/city/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        postBodyFromFormFields: [{field: "country", paramName: "country"}, {field: "state", paramName: "state"}],
                                                        enableWhenFormFieldsNonEmpty: ["country"],
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 2, className: "gap-6"},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {name: "street", widget: "#Input", label: "form.streetLabel", placeholder: "form.streetPlaceholder", widgetProps: { maxLength: CONSTRUCTOR_STREET_MAX }},
                                            },
                                            {
                                                render: "#Field",
                                                field: {name: "postalCode", widget: "#Input", label: "form.postalCodeLabel", placeholder: "form.postalCodePlaceholder", widgetProps: { maxLength: CONSTRUCTOR_POSTAL_CODE_MAX }},
                                            },
                                        ],
                                    },
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 2, className: "gap-6"},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "latitude",
                                                    widget: "#Input",
                                                    label: "form.latitudeLabel",
                                                    placeholder: "form.latitudePlaceholder",
                                                    widgetProps: {type: "number", step: "0.000001"},
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "longitude",
                                                    widget: "#Input",
                                                    label: "form.longitudeLabel",
                                                    placeholder: "form.longitudePlaceholder",
                                                    widgetProps: {type: "number", step: "0.000001"},
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                render: "div",
                                props: {className: "flex flex-col lg:col-span-1 w-full min-h-[220px] h-[220px] lg:h-full lg:min-h-[220px]"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "_map",
                                            widget: "#FormMapPinPicker",
                                            widgetProps: {latField: "latitude", lngField: "longitude", defaultLat: 41.3275, defaultLng: 19.8189},
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "logo" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "logo",
                    widget: "#MediaField",
                    label: "form.logoLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "single",
                    },
                },
            },
        ],
    },
];

const constructorEditFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: { maxLength: CONSTRUCTOR_SHORT_TEXT_MAX },
                        }, permissions: {read: "name", write: "name"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "email",
                            widget: "#Input",
                            label: "form.emailLabel",
                            placeholder: "form.emailPlaceholder",
                            widgetProps: { type: "email", maxLength: 254 },
                        }, permissions: {read: "email", write: "email"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "phoneNumber",
                            widget: "#PhoneInput",
                            label: "form.phoneNumberLabel",
                            placeholder: "form.phoneNumberPlaceholder",
                            widgetProps: { defaultCountry: "AL", maxLength: CONSTRUCTOR_PHONE_MAX },
                        }, permissions: {read: "phoneNumber", write: "phoneNumber"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vat",
                            widget: "#Input",
                            label: "form.vatLabel",
                            placeholder: "form.vatPlaceholder",
                            required: true,
                            widgetProps: { maxLength: CONSTRUCTOR_VAT_MAX },
                        }, permissions: {read: "vat", write: "vat"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "website",
                            widget: "#Input",
                            label: "form.websiteLabel",
                            placeholder: "form.websitePlaceholder",
                            widgetProps: { maxLength: CONSTRUCTOR_URL_MAX },
                        }, permissions: {read: "website", write: "website"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "partyType",
                            widget: "#SimpleSelect",
                            label: "form.partyTypeLabel",
                            placeholder: "form.partyTypePlaceholder",
                            widgetProps: {
                                options: [
                                    { value: "contractor", label: "form.partyTypeContractor" },
                                    { value: "architect", label: "form.partyTypeArchitect" },
                                    { value: "engineer", label: "form.partyTypeEngineer" },
                                    { value: "qs", label: "form.partyTypeQs" },
                                    { value: "pm", label: "form.partyTypePm" },
                                    { value: "surveyor", label: "form.partyTypeSurveyor" },
                                    { value: "other", label: "form.partyTypeOther" },
                                ],
                                className: "grow w-full",
                            },
                        }, permissions: {read: "partyType", write: "partyType"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "trades",
                            widget: "#Input",
                            label: "form.tradesLabel",
                            placeholder: "form.tradesPlaceholder",
                            widgetProps: { maxLength: CONSTRUCTOR_SHORT_TEXT_MAX },
                        }, permissions: {read: "trades", write: "trades"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "insuranceExpiry",
                            widget: "#DateInput",
                            label: "form.insuranceExpiryLabel",
                            placeholder: "form.insuranceExpiryPlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        }, permissions: {read: "insuranceExpiry", write: "insuranceExpiry"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "performanceScore",
                            widget: "#Input",
                            label: "form.performanceScoreLabel",
                            placeholder: "form.performanceScorePlaceholder",
                            widgetProps: { type: "number", min: 0, max: 100, step: "0.01" },
                        }, permissions: {read: "performanceScore", write: "performanceScore"},
                    },
                    {
                        render: "div",
                        props: { className: "md:col-span-2 w-full space-y-1.5" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: { maxHeight: 250 },
                                        maxLength: CONSTRUCTOR_LONG_TEXT_MAX,
                                    },
                                }, permissions: {read: "description", write: "description"},
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#Field",
        permissions: {write: "addresses", read: "addresses"},
        field: {
            name: "addresses",
            widget: "#FormRepeater",
            widgetProps: {
                title: "howToReach",
                arrayField: "addresses",
                deleteField: "deleteAddresses",
                defaultItem: {
                    street: "",
                    postalCode: "",
                    city: "",
                    state: undefined,
                    country: "",
                    latitude: 41.3275,
                    longitude: 19.8189,
                },
                addLabel: "addAddress",
                removeLabel: "remove",
                rowTitleFields: ["street", "city", "state", "country", "postalCode"],
                rowTitlePlaceholder: "address",
                rowTemplate: [
                    {
                        render: "div",
                        props: {className: "grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"},
                        children: [
                            {
                                render: "div",
                                props: {className: "lg:col-span-2 space-y-6 min-w-0"},
                                children: [
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 3, className: "gap-6"},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "country",
                                                    widget: "#ApiSelect",
                                                    label: "form.countryLabel",
                                                    placeholder: "form.countryPlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/country/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        cascadeClearFormFields: ["state", "city"],
                                                    },
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "state",
                                                    widget: "#ApiSelect",
                                                    label: "form.stateLabel",
                                                    placeholder: "form.statePlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/state/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        postBodyFromFormFields: [{field: "country", paramName: "country"}],
                                                        enableWhenFormFieldsNonEmpty: ["country"],
                                                        cascadeClearFormFields: ["city"],
                                                    },
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "city",
                                                    widget: "#ApiSelect",
                                                    label: "form.cityLabel",
                                                    placeholder: "form.cityPlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/city/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        postBodyFromFormFields: [{field: "country", paramName: "country"}, {field: "state", paramName: "state"}],
                                                        enableWhenFormFieldsNonEmpty: ["country"],
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 2, className: "gap-6"},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {name: "street", widget: "#Input", label: "form.streetLabel", placeholder: "form.streetPlaceholder", widgetProps: { maxLength: CONSTRUCTOR_STREET_MAX }},
                                            },
                                            {
                                                render: "#Field",
                                                field: {name: "postalCode", widget: "#Input", label: "form.postalCodeLabel", placeholder: "form.postalCodePlaceholder", widgetProps: { maxLength: CONSTRUCTOR_POSTAL_CODE_MAX }},
                                            },
                                        ],
                                    },
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 2, className: "gap-6"},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "latitude",
                                                    widget: "#Input",
                                                    label: "form.latitudeLabel",
                                                    placeholder: "form.latitudePlaceholder",
                                                    widgetProps: {type: "number", step: "0.000001"},
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "longitude",
                                                    widget: "#Input",
                                                    label: "form.longitudeLabel",
                                                    placeholder: "form.longitudePlaceholder",
                                                    widgetProps: {type: "number", step: "0.000001"},
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                render: "div",
                                props: {className: "flex flex-col lg:col-span-1 w-full min-h-[220px] h-[220px] lg:h-full lg:min-h-[220px]"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "_map",
                                            widget: "#FormMapPinPicker",
                                            widgetProps: {latField: "latitude", lngField: "longitude", defaultLat: 41.3275, defaultLng: 19.8189},
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "logo" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "logo",
                    widget: "#MediaField",
                    label: "form.logoLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "single",
                    },
                },
            },
        ],
    },
];


export const constructorCreateFormView: ViewConfig = {
    model: "constructors",
    viewType: "form",
    viewMode: "create",
    accessModel: "constructors",
    apiUrl: "/api/realEstate/constructor",
    method: "PUT",
    nodes: constructorCreateFormNode,
};

export const constructorEditFormView: ViewConfig = {
    model: "constructors",
    viewType: "form",
    viewMode: "edit",
    accessModel: "constructors",
    apiUrl: "/api/realEstate/constructor",
    method: "PATCH",
    nodes: constructorEditFormNode,
};

export const constructorViews: ViewConfig[] = [constructorSheetView, constructorCreateFormView, constructorEditFormView];
