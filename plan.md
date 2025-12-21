# Tess — Implementation Plan

## 1. Purpose & Scope

Tess is a browser-based DOCX inspection tool for exploring OPC packages at a structural and XML level. It is designed primarily as a personal development aid for DOCX tooling work, with the intention of open-sourcing it once the core feature set is stable.

The project deliberately prioritizes clarity, inspectability, and navigability over editing, rendering, or semantic interpretation.

## 2. Design Principles

These principles should guide all implementation decisions:

* Read-only by design: Tess never modifies files.
* DOCX-specific: No attempt to generalize to all OOXML formats.
* Explicit over clever: Prefer visible structure and manual navigation to abstraction.
* Low magic: Minimal hidden behavior; users should understand what they’re seeing.
* Composable UI: Panels and views are independent and loosely coupled.
* Personal workflow first: Optimization is for a single expert user, not beginners.

## 3. Non-Goals (Hard Constraints)

The following are explicitly out of scope and should not leak into implementation:

* Editing or saving modified DOCX files
* Rendering DOCX as formatted documents
* Content validation, summarization, or semantic analysis
* Handling multiple DOCX files simultaneously
* Heavy persistence or long-term state storage
* Legacy browser support

## 4. Core User Flow

1.	User opens Tess (empty state).
2.	User loads a DOCX file:
  * Drag-and-drop anywhere on the page, or
	* File picker button.
3.	Tess:
  * Loads the DOCX as an OPC package
	* Displays the package file tree
4.	User explores:
	* Opens XML files in tabs
	* Navigates via search or references
	* Inspects XML structure and related assets
5.	User replaces the file by dropping a new DOCX (full reset).

## 5. Functional Requirements

### 5.1 File Loading & Package Handling

* Accept .docx files only.
* Load ZIP contents entirely in memory.
* Extract:
  * File list (paths)
  * XML files as text
  * Binary assets tjat can be easily displayed (PNG, JPEG)
  * Maintain a canonical in-memory representation of the package.

No partial loading or streaming required.

### 5.2 Package Tree (Left Panel)
* Display full OPC package structure as a collapsible tree.
* Files are clickable:
  * XML → open in center panel tab
  * Images → open in right panel preview
* Clicking a file:
  * Opens it in a new tab, unless already open
	* Focuses existing tab if already open
	* No duplicate tabs for the same file.

Initial state after load:
* File tree visible
* No files auto-opened

### 5.3 XML Viewer (Center Panel)
* Tabbed interface for opened XML files
* Features:
  * Syntax highlighting (baseline XML)
  * Line numbers
  * Scrollable view
  * Collapse / expand XML elements
  * Tab behavior:
    * Closeable tabs
    * No empty tabs
    * No multiple views of the same file
    * Side-by-side tab view (split pane within center panel)

### 5.4 Context Panel (Right Panel)
* Collapsible panel
* Context-sensitive content:
  * Image preview when an image is selected
  * Future contextual info hooks
  * Hidden by default unless content is relevant

## 6. Navigation & Reference Resolution

### 6.1 Relationship Handling
* Parse all .rels files on load
* Build an in-memory relationship map:
  * Id → Target
* Track source file context

### 6.2 Clickable References
* Detect references in XML:
  * Relationship IDs
  * Known within-document references (e.g. comment IDs)
* Render references as clickable affordances
  * On click:
	  1.	Resolve target file
	  2.	Open or focus the file tab
	  3.	Navigate to the referenced element (if applicable)

Focus is on structural navigation, not full OOXML semantics.

## 7. Search

### 7.1 Local Search
* Search within the currently active file
* Highlight matches
* Navigate between results

## 7.2 Global Search (Grep-style)
* Search across all files in the package
* Results include:
  * File path
  * Line number
  * Snippet/context
* Clicking a result:
  * Opens/focuses file
  * Scrolls to match

Performance expectations assume typical DOCX sizes, not pathological cases.

## 8. Syntax Highlighting & Spotlight Modes

### 8.1 Baseline
* Standard XML syntax highlighting is always active.

### 8.2 Spotlight Modes (Experimental)

Implemented as optional overlays, not replacements:
* Namespace focus
* Highlight selected namespaces
* Dim all others
* Markup vs content
* Visually distinguish structure from text
* Element spotlight
* Highlight all instances of a selected element type
* Modes:
  * Toggleable
  * Mutually exclusive or combinable (to be determined experimentally)

These are expected to evolve; implementation should be modular and reversible.

## 9. State Management

### 9.1 Managed State
* Loaded package (ZIP + extracted contents)
* Open tabs and active tab
* UI state:
  * Panel widths
  * Collapsed XML nodes
  * Spotlight mode settings
  * Search state:
    * Query
    * Results
    * Active result index

### 9.2 Approach
* Lightweight pub/sub architecture
* Explicit events (e.g. FILE_OPENED, TAB_FOCUSED)
* Avoid implicit coupling between UI components

No persistence in v1 (no localStorage).

## 10. Architecture & Code Organization

### 10.1 Tech Stack
* Language: TypeScript (vanilla, no framework)
* Styling: Tailwind CSS
* Build: Vite
* Testing: Vitest

### 10.2 Libraries
* JSZip — ZIP / OPC handling
* DOMParser — XML parsing
* XMLSerializer — formatting / pretty-printing

### 10.3 Module Layout

```
src/
  core/
    zip-loader.ts
    xml-parser.ts
    relationships.ts
  ui/
    file-tree/
    tabs/
    xml-viewer/
    context-panel/
  state/
    pubsub.ts
    store.ts
  utils/
    search.ts
    highlighting.ts
```

Core logic must not depend on UI modules.

## 11. Phased Implementation Plan

### Phase 1 — Foundation
* Project scaffolding (Vite + TS + Tailwind)
* ZIP loading via JSZip
* File tree rendering
* Basic XML viewing in tabs

### Phase 2 — Navigation & Search
* XML syntax highlightin
* Line numbers
* Local search
* Global search across package

### Phase 3 — Relationships & References
* Parse .rels
* Reference detection
* Click-through navigation

### Phase 4 — UI Refinement
* Side-by-side tabs
* Context panel behavior
* Image previews

### Phase 5 — Spotlight Experiments
* Namespace and element highlighting
* Toggle UI
* Iteration based on usefulness

## 12. Distribution & Deployment
* Open source under MIT license
* GitHub repository
* Static hosting via Cloudflare Pages
* Modern browsers only:
  * Chrome
  * Firefox
  * Safari
  * Edge

## 13. Documentation Strategy
* Minimal README during early development
* Initial documentation covers:
  * What Tess is
  * Why inspect DOCX / OPC
  * Basic usage
* Target audience:
  * Developers working with DOCX and OOXML internals

## 14. Naming

Tess

Short for tessera (tile, tablet). Intentionally simple, neutral, and unencumbered by domain-specific meaning.

