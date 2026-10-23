// Exact 3.25.76 compatibility backport: colinhacks/zod#6653 (v3) and #6652 (v4).
// Keep actual npm identity, all public runtime formats, and fresh audit findings.
export const zodSecurityCorrection = {
  "name": "zod",
  "version": "3.25.76",
  "advisory": "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
  "integrity": "sha512-gzUt/qt81nXsFGKIFcC3YnfEAx5NkunCfnDlvuBSSFS02bcXu4Lmea0AFIUwbLWxWPx3d9p8S5QoaujKcNQxcQ==",
  "variants": [
    {
      "version": "4.6.7",
      "integrity": "sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==",
      "files": [
        {
          "path": "v3/types.js",
          "sha256": "d7214e1dacf9e6e70c9ca80247717b4be13b240510428fef132b7da3260d1a32",
          "replacements": [
            [
              "message: def.exactLength.message,\n                });\n                status.dirty();",
              "message: def.exactLength.message,\n                });\n                if (tooBig) return INVALID;\n                status.dirty();",
              1
            ],
            [
              "message: def.maxLength.message,\n                });\n                status.dirty();",
              "message: def.maxLength.message,\n                });\n                return INVALID;",
              1
            ],
            [
              "message: def.maxSize.message,\n                });\n                status.dirty();",
              "message: def.maxSize.message,\n                });\n                return INVALID;",
              1
            ]
          ]
        },
        {
          "path": "v3/types.cjs",
          "sha256": "7a2f06d88e280bdd198c60e0d292ed7f1e3993e877be4415de07e6abc7746dd1",
          "replacements": [
            [
              "message: def.exactLength.message,\n                });\n                status.dirty();",
              "message: def.exactLength.message,\n                });\n                if (tooBig) return parseUtil_js_1.INVALID;\n                status.dirty();",
              1
            ],
            [
              "message: def.maxLength.message,\n                });\n                status.dirty();",
              "message: def.maxLength.message,\n                });\n                return parseUtil_js_1.INVALID;",
              1
            ],
            [
              "message: def.maxSize.message,\n                });\n                status.dirty();",
              "message: def.maxSize.message,\n                });\n                return parseUtil_js_1.INVALID;",
              1
            ]
          ]
        },
        {
          "path": "src/v3/types.ts",
          "sha256": "73b9529564a34fc028a5a62c17e09148747b737039b78b124e84254cb886411a",
          "replacements": [
            [
              "message: def.exactLength.message,\n        });\n        status.dirty();",
              "message: def.exactLength.message,\n        });\n        if (tooBig) return INVALID;\n        status.dirty();",
              1
            ],
            [
              "message: def.maxLength.message,\n        });\n        status.dirty();",
              "message: def.maxLength.message,\n        });\n        return INVALID;",
              1
            ],
            [
              "message: def.maxSize.message,\n        });\n        status.dirty();",
              "message: def.maxSize.message,\n        });\n        return INVALID;",
              1
            ]
          ]
        }
      ],
      "unmodifiedFiles": [
        {
          "path": "v4/core/schemas.js",
          "sha256": "0ee56e8afbae28eeb1060a162ad7e56f0675ee6fb83f0ae56bea2e088f6cdbc0"
        },
        {
          "path": "v4/core/schemas.cjs",
          "sha256": "7e35563b275bcc457a6d8ae0f5e1354b3c499ddd38401439f16bed1b8f357e41"
        },
        {
          "path": "src/v4/core/schemas.ts",
          "sha256": "9a495df5c8e614f1435f8f79618e768e9f3e5a2bc76d784b2c060f51c8e0312e"
        },
        {
          "path": "v4/core/util.js",
          "sha256": "bb08133b11b478c8e715038fff26ebea204d7fd5443fba31fe138b142d202efb"
        },
        {
          "path": "v4/core/util.cjs",
          "sha256": "c7fd0ee0303e7344463692d0936d59c982ed28bb1b73dbd97d2b887ae15d80f1"
        },
        {
          "path": "src/v4/core/util.ts",
          "sha256": "e0ce7d4abc5e43373c59db83cad29f918edf6965df1bb8e54157a4f04d224863"
        },
        {
          "path": "v4/core/compile.js",
          "sha256": "53fcf24821f50ecf42492ab7101abe8a50ead8286a53567d71648fe5ca346b99"
        },
        {
          "path": "v4/core/compile.cjs",
          "sha256": "53920c324ac3709a099d2b608398699a6160211738c9ced6473065d9509b7b61"
        },
        {
          "path": "src/v4/core/compile.ts",
          "sha256": "6c2a8810813117e864a95dd1e8512af7ce53e6b4b02d1f0dbc1dfa78850afff0"
        }
      ]
    }
  ],
  "files": [
    {
      "path": "v3/types.js",
      "sha256": "9763a2938f0e7f983363ef4bf6530e7583e3f2d54f8a4a6684efad58febc6e8e",
      "replacements": [
        [
          "message: def.exactLength.message,\n                });\n                status.dirty();",
          "message: def.exactLength.message,\n                });\n                if (tooBig) return INVALID;\n                status.dirty();",
          1
        ],
        [
          "message: def.maxLength.message,\n                });\n                status.dirty();",
          "message: def.maxLength.message,\n                });\n                return INVALID;",
          1
        ],
        [
          "message: def.maxSize.message,\n                });\n                status.dirty();",
          "message: def.maxSize.message,\n                });\n                return INVALID;",
          1
        ]
      ]
    },
    {
      "path": "v3/types.cjs",
      "sha256": "06487cc05ed45c5dd29789bf0aa75734d1ce06592a7f2665ba4ca90a68e8a3e1",
      "replacements": [
        [
          "message: def.exactLength.message,\n                });\n                status.dirty();",
          "message: def.exactLength.message,\n                });\n                if (tooBig) return parseUtil_js_1.INVALID;\n                status.dirty();",
          1
        ],
        [
          "message: def.maxLength.message,\n                });\n                status.dirty();",
          "message: def.maxLength.message,\n                });\n                return parseUtil_js_1.INVALID;",
          1
        ],
        [
          "message: def.maxSize.message,\n                });\n                status.dirty();",
          "message: def.maxSize.message,\n                });\n                return parseUtil_js_1.INVALID;",
          1
        ]
      ]
    },
    {
      "path": "src/v3/types.ts",
      "sha256": "70309a0877c35d036842e291fe7c8a4439d5db49411d233f8a22bf8a59c41419",
      "replacements": [
        [
          "message: def.exactLength.message,\n        });\n        status.dirty();",
          "message: def.exactLength.message,\n        });\n        if (tooBig) return INVALID;\n        status.dirty();",
          1
        ],
        [
          "message: def.maxLength.message,\n        });\n        status.dirty();",
          "message: def.maxLength.message,\n        });\n        return INVALID;",
          1
        ],
        [
          "message: def.maxSize.message,\n        });\n        status.dirty();",
          "message: def.maxSize.message,\n        });\n        return INVALID;",
          1
        ]
      ]
    },
    {
      "path": "v4/core/schemas.js",
      "sha256": "d466582c022b08a3f9eb1a65d5970d8ca25064d73a5a838d76414ae36440a76b",
      "replacements": [
        [
          "function handleArrayResult(",
          "// Backport of the leading-size gate in colinhacks/zod#6652.\n// This older v4 runner performs checks after parse, so defer a run wrapper\n// until construction completes; an early failure must not run later checks.\nfunction capSize(inst, size) {\n    const caps = [];\n    for (const ch of inst._zod.def.checks ?? []) {\n        const d = ch._zod.def;\n        if (!/_(length|size)$|_equals$/.test(d.check)) break;\n        const max = d.maximum ?? d.length ?? d.size;\n        if (max >= 0) caps.push([max, ch]);\n    }\n    if (!caps.length) return;\n    (inst._zod.deferred ??= []).push(() => {\n        const run = inst._zod.run;\n        inst._zod.run = (payload, ctx) => {\n            const n = size(payload.value);\n            for (const [max, ch] of caps) {\n                if (n > max && ch._zod.def.when?.(payload)) {\n                    const start = payload.issues.length;\n                    ch._zod.check(payload);\n                    payload.issues[start].continue = false;\n                    return payload;\n                }\n            }\n            return run(payload, ctx);\n        };\n    });\n}\n\nfunction handleArrayResult(",
          1
        ],
        [
          "return payload; //handleArrayResultsAsync(parseResults, final);\n    };\n});",
          "return payload; //handleArrayResultsAsync(parseResults, final);\n    };\n    capSize(inst, (input) => Array.isArray(input) ? input.length : -1);\n});",
          1
        ],
        [
          "return payload;\n    };\n});\nfunction handleMapResult(",
          "return payload;\n    };\n    capSize(inst, (input) => input instanceof Map ? input.size : -1);\n});\nfunction handleMapResult(",
          1
        ],
        [
          "return payload;\n    };\n});\nfunction handleSetResult(",
          "return payload;\n    };\n    capSize(inst, (input) => input instanceof Set ? input.size : -1);\n});\nfunction handleSetResult(",
          1
        ]
      ]
    },
    {
      "path": "v4/core/schemas.cjs",
      "sha256": "f5d17a7db487c943c9d07cc624010ebb6d93683eabd14339846f4912cc88b51f",
      "replacements": [
        [
          "function handleArrayResult(",
          "// Backport of the leading-size gate in colinhacks/zod#6652.\n// This older v4 runner performs checks after parse, so defer a run wrapper\n// until construction completes; an early failure must not run later checks.\nfunction capSize(inst, size) {\n    const caps = [];\n    for (const ch of inst._zod.def.checks ?? []) {\n        const d = ch._zod.def;\n        if (!/_(length|size)$|_equals$/.test(d.check)) break;\n        const max = d.maximum ?? d.length ?? d.size;\n        if (max >= 0) caps.push([max, ch]);\n    }\n    if (!caps.length) return;\n    (inst._zod.deferred ??= []).push(() => {\n        const run = inst._zod.run;\n        inst._zod.run = (payload, ctx) => {\n            const n = size(payload.value);\n            for (const [max, ch] of caps) {\n                if (n > max && ch._zod.def.when?.(payload)) {\n                    const start = payload.issues.length;\n                    ch._zod.check(payload);\n                    payload.issues[start].continue = false;\n                    return payload;\n                }\n            }\n            return run(payload, ctx);\n        };\n    });\n}\n\nfunction handleArrayResult(",
          1
        ],
        [
          "return payload; //handleArrayResultsAsync(parseResults, final);\n    };\n});",
          "return payload; //handleArrayResultsAsync(parseResults, final);\n    };\n    capSize(inst, (input) => Array.isArray(input) ? input.length : -1);\n});",
          1
        ],
        [
          "return payload;\n    };\n});\nfunction handleMapResult(",
          "return payload;\n    };\n    capSize(inst, (input) => input instanceof Map ? input.size : -1);\n});\nfunction handleMapResult(",
          1
        ],
        [
          "return payload;\n    };\n});\nfunction handleSetResult(",
          "return payload;\n    };\n    capSize(inst, (input) => input instanceof Set ? input.size : -1);\n});\nfunction handleSetResult(",
          1
        ]
      ]
    },
    {
      "path": "src/v4/core/schemas.ts",
      "sha256": "5910d2a181b6570189730578df0ff7c90bd7b2cda6ae1064026d236a47fb687d",
      "replacements": [
        [
          "function handleArrayResult(",
          "// Backport of the leading-size gate in colinhacks/zod#6652.\n// This older v4 runner performs checks after parse, so defer a run wrapper\n// until construction completes; an early failure must not run later checks.\nfunction capSize(inst: $ZodType, size: (input: unknown) => number): void {\n    const caps: [number, checks.$ZodCheck<never>][] = [];\n    for (const ch of inst._zod.def.checks ?? []) {\n        const d = ch._zod.def as any;\n        if (!/_(length|size)$|_equals$/.test(d.check)) break;\n        const max = d.maximum ?? d.length ?? d.size;\n        if (max >= 0) caps.push([max, ch]);\n    }\n    if (!caps.length) return;\n    (inst._zod.deferred ??= []).push(() => {\n        const run = inst._zod.run;\n        inst._zod.run = (payload, ctx) => {\n            const n = size(payload.value);\n            for (const [max, ch] of caps) {\n                if (n > max && ch._zod.def.when?.(payload)) {\n                    const start = payload.issues.length;\n                    ch._zod.check(payload as ParsePayload<never>);\n                    payload.issues[start].continue = false;\n                    return payload;\n                }\n            }\n            return run(payload, ctx);\n        };\n    });\n}\n\nfunction handleArrayResult(",
          1
        ],
        [
          "return payload; //handleArrayResultsAsync(parseResults, final);\n  };\n});",
          "return payload; //handleArrayResultsAsync(parseResults, final);\n  };\n  capSize(inst, (input) => Array.isArray(input) ? input.length : -1);\n});",
          1
        ],
        [
          "return payload;\n  };\n});\n\nfunction handleMapResult(",
          "return payload;\n  };\n  capSize(inst, (input) => input instanceof Map ? input.size : -1);\n});\n\nfunction handleMapResult(",
          1
        ],
        [
          "return payload;\n  };\n});\n\nfunction handleSetResult(",
          "return payload;\n  };\n  capSize(inst, (input) => input instanceof Set ? input.size : -1);\n});\n\nfunction handleSetResult(",
          1
        ]
      ]
    }
  ]
};
