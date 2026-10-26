# Technology acknowledgements

E&S Risk Management Core is the Community edition of E&S Review. We thank the maintainers and contributors supporting its evidence, assessment and monitoring workflows. This page identifies scope and upstream terms; original licence and NOTICE texts remain authoritative for their respective components.

Application-owned Community source is licensed under [Apache-2.0](LICENSE). Third-party components retain their own terms. The application licence grants no rights to institutional publications, client documents, third-party trademarks or model weights.

## Default Community installation

The generated [package.json](package.json) and [package-lock.json](package-lock.json) define the exact installation. The default command omits development and optional packages. It needs Node.js, ExcelJS, jsdom and six vendored categori components, with no AWS account or Observable hosting dependency.

| Component | Contribution | Licence evidence |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | JavaScript runtime, HTTP service, hashes, test runner and SQLite interface. | [MIT-style core terms and incorporated third-party notices](https://github.com/nodejs/node/blob/v24.22.1/LICENSE); supplied by the operator or selected container base. |
| [SQLite](https://www.sqlite.org/) | Transactional local project, engagement and review records through `node:sqlite`. | [Public-domain dedication](https://www.sqlite.org/copyright.html); Node's wrapper and bundled notices remain separate. |
| [ExcelJS](https://github.com/exceljs/exceljs) | Spreadsheet inspection, generation and reporting. | [MIT](https://github.com/exceljs/exceljs/blob/v4.4.0/LICENSE); transitive packages retain their own terms. |
| [jsdom](https://github.com/jsdom/jsdom) | HTML/document processing and selected interface checks. | [MIT](https://github.com/jsdom/jsdom/blob/23.2.0/LICENSE.txt). |
| categori.se shared components | Authentication client, bounded connections/streams, app primitives, browser recovery, Studio and workspace contracts. | Six packages under [vendor/](vendor/) retain Apache-2.0 LICENSE/NOTICE files. The [workspace source manifest](vendor/workspace-contracts/SOURCE-MANIFEST.json) records the unverified matching upstream release and the local modifications. A public upstream alpha.11 match is not claimed; local categori.se modifications retain the existing package licence and notices. |

Available npm licence and notice texts are preserved in [software-notices.txt](src/data/software-notices.txt), with identities in [software-attributions.js](src/lib/software-attributions.js). These were generated for the broader application's production dependencies and may include packages omitted or optional here; the candidate lock determines its actual graph.

`buffers@0.1.1` is reached through `exceljs → unzipper → binary → buffers`. Its published package omits a licence field and standalone licence, so the generated package metadata retains **Not declared**. A separate [manual notice](third-party/buffers-0.1.1-NOTICE.txt) and [exact-tree evidence](third-party/buffers-0.1.1-provenance.json) preserve the upstream MIT/X11 declaration: all six locked npm files were compared with licensed commit `1b745ee`; runtime/examples/tests match exactly, and package/README differences consist only of the added licence declarations. The dependency and its runtime bytes are unchanged. This resolves the missing metadata for that exact tree without inventing a new grant.

## Optional local processing tools

The source includes the native parser and [pinned Python requirements](server/client-template-runtime-requirements.txt). It bundles no interpreter, wheels, Office/PDF/OCR/spatial executable or font binary. Operators install needed capabilities and retain the actual distribution's licences, notices and source information when redistributing an image.

| Tool | Optional use | Upstream terms and scope |
| --- | --- | --- |
| [Python](https://www.python.org/) | Native parsing and population. | [PSF licence and incorporated notices](https://docs.python.org/3/license.html). |
| [lxml](https://lxml.de/) | XML and Office-package structures. | [BSD-style terms plus libxml2/libxslt notices](https://lxml.de/copyright.html). |
| [pypdf](https://pypdf.readthedocs.io/) | PDF inspection and manipulation. | [BSD-3-Clause](https://github.com/py-pdf/pypdf/blob/6.21.2/LICENSE). |
| [Pillow](https://python-pillow.github.io/) | Image handling. | [MIT-CMU and incorporated notices](https://pillow.readthedocs.io/en/stable/about.html#license). |
| [LibreOffice](https://www.libreoffice.org/) | Office recalculation and PDF conversion. | [MPL-2.0, Apache heritage and version-specific third-party terms](https://www.libreoffice.org/licenses/); preserve the complete installed licence information. |
| [Poppler](https://poppler.freedesktop.org/) | PDF text, metadata and rasterization. | [Upstream source/licensing](https://gitlab.freedesktop.org/poppler/poppler); GPL-family and component terms depend on the installed package. |
| [Tesseract](https://tesseract-ocr.github.io/tessdoc/) | Explicit OCR of selected pages. | [Apache-2.0](https://github.com/tesseract-ocr/tesseract/blob/main/LICENSE); language data and linked components retain their notices. |
| [GDAL/OGR](https://gdal.org/) | Selected geospatial conversions. | [MIT and file/dependency-specific terms](https://gdal.org/en/stable/license.html); drivers and binary dependencies need separate review. |
| [fontconfig](https://www.freedesktop.org/wiki/Software/fontconfig/), [DejaVu](https://dejavu-fonts.github.io/), [Liberation](https://github.com/liberationfonts/liberation-fonts), [Noto](https://notofonts.github.io/) | Font discovery and rendering when selected by the operator. | Preserve each installed release's exact terms. System-font names in CSS do not bundle those fonts; the minimal source package ships no font binaries. |

Record actual tool/font versions and examine generated documents. Their presence supplies no hosted-rendering or professional acceptance.

## Optional adapters and development tools

| Component | Scope | Attribution and terms |
| --- | --- | --- |
| [AWS SDK for JavaScript v3](https://github.com/aws/aws-sdk-js-v3) | Optional customer Cognito, DynamoDB, S3 and Lambda adapters; omitted by default. | [Apache-2.0](https://github.com/aws/aws-sdk-js-v3/blob/main/LICENSE). Accounts, cloud-service terms/costs and IAM are separate; no credential/private native function is configured here. |
| [esbuild](https://esbuild.github.io/) | Source-closure preparation and optional authenticated bundle build. | [MIT](https://github.com/evanw/esbuild/blob/main/LICENSE.md); optional in the generated profile. |
| [Observable Framework](https://github.com/observablehq/framework) | Broader E&S Review static-site/publication development; absent from the default Community dependency graph. | [ISC](https://github.com/observablehq/framework/blob/main/LICENSE); Observable hosting is not required locally. |
| [Lucide](https://lucide.dev/) | Broader interface icon tooling; absent from this profile's npm runtime dependencies. | [ISC and retained Feather-derived notices](https://lucide.dev/license). |
| [GitHub Actions](https://docs.github.com/en/actions), [Chromium](https://www.chromium.org/), [Playwright](https://playwright.dev/) | Release automation and selected upstream browser checks; no browser is bundled here. | [Chromium core/component notices](https://chromium.googlesource.com/chromium/src/+/main/LICENSE), [Playwright Apache-2.0](https://github.com/microsoft/playwright/blob/main/LICENSE); Actions and hosted services retain their terms. |
| [Alpine Linux](https://alpinelinux.org/), [Node official container images](https://github.com/nodejs/docker-node) | Optional minimal Linux base, with project data mounted separately. | Each included OS/runtime package retains its terms. The minimal base contains no separate Office/Python/font toolchain. |

Institution names and standards references acknowledge their publishers; they imply no sponsorship, official template status or permission to redistribute an original. The Community Resource Library starts empty, so operators supply only content they may retain and process.
