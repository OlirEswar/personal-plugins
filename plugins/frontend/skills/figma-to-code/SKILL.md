---
name: figma-to-code
description: Implement UI from a Figma design using the Figma MCP server - pull design context, variables and screenshots for a frame, map them onto the project's existing components and tokens, and verify the result visually against the design. Use when the user shares a Figma link or node, or asks to build something "from the design/mockup".
argument-hint: "<figma url or node>"
---

# Figma → code

**Setup:** the `figma` MCP server is remote (`https://mcp.figma.com/mcp`). Authenticate once with `/mcp` → figma. If it isn't connected, ask the user for a screenshot and work from that instead.

## Workflow
1. **Fetch context** for the selected node or link:
   - `get_design_context`: structure and styling for the frame. Ask for the project's framework, such as React + Tailwind.
   - `get_variable_defs`: the Figma variables (colors, spacing, type) used in the frame.
   - `get_screenshot`: the visual reference used to verify the result later.
   - `get_code_connect_map`, if available: Figma components that already map to code components.
   For large frames, fetch the child nodes separately instead of one huge payload.
2. **Map, don't transcribe.** Figma output is a reference, not the code to ship.
   - Each Figma variable maps to an existing token. If the token is missing, add it to the design system (`design-system` skill) rather than hard-coding the value.
   - Figma components map to existing code components, found through Code Connect or by searching `components/`. Don't recreate a Button.
   - Absolute positioning becomes flex or grid with gap. Fixed widths become fluid with max-widths. Define the responsive behavior the frame doesn't show, and ask if a mobile frame exists.
   - Download real assets (icons as SVG, images) instead of using placeholders, and use the project's icon library when it has the same icon.
3. **Implement** with semantic HTML and accessibility (the `accessibility` skill), including states the static design omits: hover, focus, loading, empty, error.
4. **Verify visually.** Screenshot the implementation at the frame's width and compare it with the Figma screenshot side by side, checking spacing, type sizes, colors, alignment, and radii. Iterate until it matches within a couple of pixels. Then run the `design-review` breakpoints.
5. **Report** any deviations that were intentional, such as tokens snapped to the scale or accessibility fixes, so the designer knows.
