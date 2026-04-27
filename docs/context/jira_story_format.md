---
name: Jira User Story Format
description: Exact user story structure for the EDG platform Jira tickets
type: feedback
---

Use this exact format when generating and creating Jira user stories for the EDG project.

**Why:** User is a Senior PM and wants engineering-ready, high-clarity stories broken down by single capability per story.

**How to apply:** Every time user asks to create Jira stories, follow this structure strictly. Post to EDG project on solixjira.atlassian.net (cloudId: 40818818-e33a-4031-81ec-e93f0010c980).

---

## Core Principles
- Each story = single capability or action
- Independent, testable, implementation-ready
- No combining multiple capabilities into one story
- List assumptions explicitly if prototype details are incomplete

## Step 1: Identify Triggers FIRST
- User actions (click, create, edit, delete, assign, submit)
- System events (API success/failure, timeout)
- State conditions (empty state, duplicate data, no access)
- Permission scenarios (RBAC: admin, editor, viewer, unauthorized)

## Step 2: Story per major trigger

## Output Format per story:

### Story Title

#### 1. User Story
As a <user>, I want <action>, So that <value>.

#### 2. Problem / Context
- Why this capability is needed

#### 3. Scope
**In Scope:** ...
**Out of Scope:** ...

#### 4. Requirements
**Functional:** implementation-level behavior, system + user interactions
**UX Expectations:** loading, success, error, empty states

#### 5. Acceptance Criteria (Given/When/Then)
- Happy path
- Failure scenarios
- Edge cases
- RBAC scenarios

#### 6. Edge Cases
- Only meaningful, non-trivial cases

#### Optional sections (only if relevant):
- Dependencies
- Permissions / Roles
- Non-Functional Requirements
- Assumptions
- Open Questions
