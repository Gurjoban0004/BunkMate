# AI Assistant Rules & Guidelines

These rules are established to prevent destructive "rabbit holes" caused by misdiagnosing bugs or missing UI components in the **Presence** app.

## 1. Verify Conditional Logic Before Assuming Code Is Missing
If the user reports that a UI component, screen, or feature is "missing" or "deleted", **do not assume the code was actually removed.** 
- Check the parent components for conditional rendering logic.
- Consider edge cases like **weekends**, **holidays**, or "No Classes Today" states. (e.g., The Planner "Skip/Fix" tabs were hidden on weekends, which tricked the AI into thinking the redesign was deleted).
- Verify if `devMode`, `mockData`, or a specific `devDate` is altering the UI state before ripping out code.

## 2. No Blind `git` Restorations
Before running destructive commands like `git checkout <old-commit> -- <files>`, `git restore`, or `git reset --hard`, you MUST verify whether the missing functionality is a rendering issue in the current commit.
- Use `git log`, `grep_search`, or `view_file` to confirm the actual state of the files.
- Ask clarifying questions about the user's current device state (e.g., "What day of the week is it on your phone?").

## 3. Understand the Data Flow
The `AppContext.js` is the single source of truth. If data looks wrong, trace it from the context reducer down to the UI components. Changes to attendance maths in `utils/` often dictate what components become visible. Let data dictate UI rendering analysis.

## 4. Prioritize "Fix Forward"
When a bug is found, try to fix the logic in the current state (`fix forward`) rather than immediately attempting to revert to older versions of the codebase, which causes merge conflicts and losing recent UI polish.
