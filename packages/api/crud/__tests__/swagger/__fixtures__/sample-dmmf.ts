/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures intentionally model the loose DMMF shape used by the parser */
export const sampleDmmf: any = {
    datamodel: {
        enums: [],
        models: [
            {
                fields: [
                    {
                        hasDefaultValue: true,
                        isList: false,
                        isRequired: true,
                        kind: "scalar",
                        name: "id",
                        type: "Int",
                    },
                    {
                        hasDefaultValue: false,
                        isList: false,
                        isRequired: true,
                        kind: "scalar",
                        name: "email",
                        type: "String",
                    },
                    {
                        hasDefaultValue: false,
                        isList: false,
                        isRequired: false,
                        kind: "scalar",
                        name: "name",
                        type: "String",
                    },
                ],
                name: "User",
            },
        ],
        types: [],
    },
    mappingsMap: {
        User: { plural: "users" },
    },
    mutationType: {
        fieldMap: {
            createOneUser: {
                args: [
                    {
                        inputTypes: [
                            {
                                kind: "object",
                                type: {
                                    fields: [
                                        {
                                            inputTypes: [{ kind: "scalar", type: "String" }],
                                            isNullable: false,
                                            isRequired: true,
                                            name: "email",
                                        },
                                        {
                                            inputTypes: [
                                                { kind: "scalar", type: "String" },
                                                { kind: "scalar", type: "Null" },
                                            ],
                                            isNullable: true,
                                            isRequired: false,
                                            name: "name",
                                        },
                                    ],
                                    name: "UserCreateInput",
                                },
                            },
                        ],
                    },
                ],
            },
            updateOneUser: {
                args: [
                    {
                        inputTypes: [
                            {
                                kind: "object",
                                type: {
                                    fields: [
                                        {
                                            inputTypes: [{ kind: "scalar", type: "String" }],
                                            isNullable: false,
                                            isRequired: false,
                                            name: "email",
                                        },
                                    ],
                                    name: "UserUpdateInput",
                                },
                            },
                        ],
                    },
                ],
            },
        },
    },
};
