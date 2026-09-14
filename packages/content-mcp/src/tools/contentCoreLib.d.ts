/// <reference lib="dom" />
// Types-only lib directive (MCP-02 change-control note): MCP-02 is the first
// consumer to typecheck `@bemtevi/content-core` under this project, and
// content-core's digest module uses the DOM-global type name `BufferSource`
// while this package's tsconfig compiles without the DOM lib. This directive
// adds the DOM *type declarations* to the program only — no runtime effect and
// no new imports. Owners may prefer to remove the DOM type-name dependency
// from content-core instead; recorded in the MCP-02 handoff.
