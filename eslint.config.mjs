import nx from "@nx/eslint-plugin";
import { baseConfig as sharedBaseConfig } from "./packages/eslint-config/src/base.mjs";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    ...sharedBaseConfig,
    {
      "ignores": [
        "**/dist",
        "**/out-tsc",
        "**/vitest.config.*.timestamp*"
      ]
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx"
        ],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [
                        "^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$"
                    ],
                    depConstraints: [
                        // See docs/ARCHITECTURE.md §3.2 for the full rationale.
                        // web/mobile must never import api code, and vice versa.
                        {
                            sourceTag: "scope:web",
                            onlyDependOnLibsWithTags: ["scope:web", "scope:shared"]
                        },
                        {
                            sourceTag: "scope:mobile",
                            onlyDependOnLibsWithTags: ["scope:mobile", "scope:shared"]
                        },
                        {
                            sourceTag: "scope:api",
                            onlyDependOnLibsWithTags: ["scope:api", "scope:shared"]
                        },
                        // Shared packages depend only on other shared packages —
                        // never on an app — which is what makes them genuinely shared.
                        {
                            sourceTag: "scope:shared",
                            onlyDependOnLibsWithTags: ["scope:shared"]
                        },
                        // Apps may depend on shared feature/util libs; a util lib
                        // (e.g. types, validation) may not depend on a feature lib
                        // (e.g. api-client) — dependencies only flow util -> feature -> app.
                        {
                            sourceTag: "type:app",
                            onlyDependOnLibsWithTags: ["type:feature", "type:util"]
                        },
                        {
                            sourceTag: "type:feature",
                            onlyDependOnLibsWithTags: ["type:util"]
                        },
                        {
                            sourceTag: "type:util",
                            onlyDependOnLibsWithTags: ["type:util"]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs"
        ],
        // Override or add rules here
        rules: {}
    }
];
