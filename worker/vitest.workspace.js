import { defineWorkspace } from "vitest/config";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// Two projects:
//   unit    — pure-JS modules (personas, auth) run fast in Node.
//   workers — modules needing the Cloudflare runtime (HTMLRewriter, KV via
//             cloudflare:test) run in workerd. We define bindings inline via
//             miniflare rather than reading wrangler.jsonc, so the production
//             AI / PDF service / rate-limit bindings (which the local test
//             runtime can't boot) are not required. Only CHAT_KV is needed by
//             the tests. compatibilityDate is pinned to what the bundled local
//             runtime supports; HTMLRewriter and KV are long-standing features.
export default defineWorkspace([
    {
        test: {
            name: "unit",
            include: ["test/personas.test.js", "test/auth.test.js", "test/chat-log.test.js"],
            environment: "node",
        },
    },
    defineWorkersConfig({
        test: {
            name: "workers",
            include: ["test/**/*.test.js"],
            exclude: ["test/personas.test.js", "test/auth.test.js", "test/chat-log.test.js"],
            poolOptions: {
                workers: {
                    miniflare: {
                        compatibilityDate: "2024-12-30",
                        compatibilityFlags: ["nodejs_compat"],
                        kvNamespaces: ["CHAT_KV"],
                    },
                },
            },
        },
    }),
]);
