# Branch Merge Feature - Brainstorming

Brainstorming notes for implementing branch merge functionality in K-Base.

## Concept

Allow users to merge content from one conversation branch into another existing assistant message, creating a combined result while archiving the source branch.

## Basic Flow

1. User is on Branch B, viewing an assistant message
2. User wants to merge content from Branch A into this message
3. System creates a **new combined message** in Branch B
4. Branch A gets archived

## Key Issues

### 1. Context Coherence

Branch A's content might reference things that don't exist in Branch B's history.

Example:
- Branch A: "As I mentioned about the database schema above..."
- Branch B never discussed database schema

**Options:**
- Merge the entire conversation path (not just one message)
- Let LLM rewrite/adapt the merged content to fit new context
- Accept some incoherence (user's responsibility)

### 2. What Gets Merged?

| Option | Pros | Cons |
|--------|------|------|
| Single assistant message | Simple, surgical | Loses context of why that response exists |
| User prompt + assistant response pair | Preserves Q&A relationship | Still missing prior context |
| Entire branch from fork point | Complete context | Could be huge, duplicates content |
| User-selected range of messages | Flexible | Complex UI |

### 3. LLM Context After Merge

Currently the system walks `parent_id` to build context. After merge:

```
Original Branch B:          After Merge:

[user]                      [user]
   ↓                           ↓
[assistant] ← merge here    [assistant_merged] (new node, combines both)
   ↓                           ↓
[user]                      [user]
```

**Question:** Does the merged content become part of future LLM context?
- If yes: need a new node type or flag so context builder includes it
- If no: it's just for human reference (simpler but less useful)

### 4. Data Model Options

**Option A: New node inserted as child**
```
[assistant_original]
       ↓
[merged_content] ← new node type, contains Branch A content
       ↓
[next_user_message]
```
Problem: breaks the simple parent chain

**Option B: Merged content stored as metadata on existing node**
```python
# Add to Node model
merged_content: Optional[str]  # Content from other branch
merged_from_node_id: Optional[UUID]  # Provenance tracking
```
Simpler, but the original + merged are now one blob

**Option C: Create entirely new node, archive original**
```
[assistant_original] → status: archived
[assistant_merged] ← new node with combined content, same parent_id
```
Closest to the proposed flow

### 5. Node Status Considerations

Current statuses: `active`, `collapsed`, `abandoned`, `merged`

The `merged` status exists but needs clarification:
- Does `merged` mean "this was merged INTO something else" (source)?
- Or "this contains merged content" (target)?

Possible approach:
- `merged_source` - the original that got absorbed
- Keep existing nodes, add `merged_from_id` field for provenance

### 6. UI/UX Questions

- **Initiation**: How does user trigger merge? Drag-and-drop? Menu on collapsed branch cards?
- **Visual distinction**: Different background color? Icon? Expandable "merged from Branch A" section?
- **Undo**: Can you restore archived branch and delete merged node?

### 7. Edge Cases

- Merge into a node that has children → do children follow the merged node?
- What about side chats and notes on the source branch?
- Merge a branch that has sub-branches?
- Prevent circular merges?

## Recommended MVP Approach

1. **Merge = copy content** from source assistant message into a new "merged" section on target
2. **New node type**: `merged_content` as a child of the target assistant message (similar to how notes work)
3. **Source branch**: mark with status `merged_source`, keep intact but hidden from main view
4. **Context building**: optionally include merged content (user toggle?)

This avoids restructuring the tree while still capturing the content.

## Open Questions

- Should merged content influence future LLM responses?
- How to handle conflicts if both branches evolved significantly?
- Should there be an AI-assisted merge that rewrites content for coherence?

---

*Created: 2026-01-04*
