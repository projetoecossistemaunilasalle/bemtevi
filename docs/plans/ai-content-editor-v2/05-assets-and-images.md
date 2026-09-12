# Assets And Images

V2 preserves embedded image data URLs in the editorial payload; no object store or application backend. Catalog/external references already supported by the content model remain supported without server-side URL fetching.

The exact ImageSlot/ImageValue union, payload mapping, generic-operation protections, decoder rules and archive image schema are in [14-contracts.md](14-contracts.md). All dashboard/MCP/file clients use that contract and normal generation CAS. No arbitrary local image path tool, URL downloader, implicit block creation, or auto-publication.

## Limits

New uploaded images: PNG/JPEG/WebP only, at most 1 MiB decoded, dimensions 1..4096 each, at most 16,000,000 pixels, strict base64 and matching container signature. Reject animation, malformed/truncated containers and unsupported formats. SQL validates bounded container headers independently of TypeScript; this does not claim a full codec or malware scan.

Unchanged existing images are grandfathered, so a title edit does not reject a preexisting catalog/SVG/GIF image. Returned archives cannot introduce GIF/SVG. Oversize or invalid changes leave draft unchanged.

Total draft payload <=5 MiB in both compact JSON and PostgreSQL JSONB text. No silent truncation. Existing browser upload conversion remains, followed by shared validation.

## File Archive Bounds

Import ZIP <=8 MiB compressed, <=12 MiB actual uncompressed total, <=64 entries including directory entries, <=100:1 per-entry actual expansion ratio. Check declared sizes before inflation and actual bytes while inflating. Reject unsupported/duplicate/unsafe paths, encryption, symlinks, ZIP64, CRC/size mismatches and unexpected entries as specified in 14. Apply all operations/images atomically, never partially.

Export may include unchanged legacy image formats for context only. Scoped exports retain a complete reconciliation base in Neon. Future object-storage migration is out of scope.
