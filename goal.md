# New Compacted Pill Type: **Edge Peek**

Introduce a **new compacted pill mode** called **Edge Peek**. This is an additional compacted pill type and **must not replace or modify the existing Compacted Pill mode**. Users should be able to choose between the original Compacted Pill and the new Edge Peek mode from the settings.

## Overview

Edge Peek is a minimal, screen-edge-attached version of the compacted pill. Instead of displaying the entire pill, only a small portion of a circular handle remains visible outside the edge of the screen, making it feel like a native screen handle rather than a floating widget.

The goal is to reduce screen distraction while keeping tasks instantly accessible.

## Appearance

- Replace the compacted pill with a **circular edge handle**.
- Approximately **70–80% of the circle remains hidden beyond the screen edge**, with only **20–30% visible**.
- The visible portion should appear naturally attached to the monitor edge.
- The circle uses the application's existing design language:
  - Dark background
  - Rounded edges
  - Smooth shadows
  - Purple accent ring
- The center displays the current task count (for example, **3**).
- Optionally, a circular progress ring around the handle can indicate completed tasks.

## Docking

The Edge Peek handle can be docked to any side of the current monitor.

Supported positions:

- Left
- Right
- Top
- Bottom

When dragged near an edge, it should **magnetically snap** into place with a smooth spring animation.

The selected position should persist between application launches.

## Expand Behaviour

Clicking or double-clicking (depending on the user's configured interaction) expands the task panel.

Unlike the existing Compacted Pill, the Edge Peek handle **remains attached to the task panel** while it expands.

The task panel should slide naturally from the same edge where the handle is docked.

Examples:

- Left edge → panel slides toward the right.
- Right edge → panel slides toward the left.
- Top edge → panel slides downward.
- Bottom edge → panel slides upward.

The animation should feel like **pulling out a drawer** from the edge of the screen.

## Collapse Behaviour

Closing the task panel returns it back into the screen edge.

The panel should animate back into the handle, leaving only the small circular portion visible.

The transition should feel continuous rather than appearing/disappearing abruptly.

## Dragging

Users can drag the handle to reposition it.

During dragging:

- The handle temporarily detaches from the edge.
- It follows the cursor.
- When released near another screen edge, it snaps smoothly into place.

## Auto Hide

Optional setting:

**Auto Hide Edge Peek**

When enabled:

- The handle remains attached to the selected edge.
- Only a very small portion of the circle is visible while idle.
- Hovering near the edge slightly reveals the handle.
- Clicking expands the panel as normal.

Multiple Monitor Support

The Edge Peek handle belongs to the monitor where it is currently placed.

Its position should be remembered independently for each monitor configuration.

## Animations

Use smooth Framer Motion animations throughout:

- Magnetic snap
- Drawer-like expansion
- Drawer-like collapse
- Slight hover scale
- Gentle idle breathing animation
- Soft purple glow on hover

Animations should be subtle and premium, avoiding excessive motion.

## Design Goal

Edge Peek should feel like a **native desktop utility** rather than a floating application.

It should always remain accessible while occupying virtually no screen space, giving users the impression that it is physically attached to the edge of their monitor until they pull it open.  



Add Mobile compartible app that lets you add tasks when out of range of your laptop and when connected the tasks should naturally get imported to the app.

