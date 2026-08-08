<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mandatory Production-Grade Implementation Standard

DiaPalace is a real business-critical system. It is not a prototype, mockup, visual demonstration, or UI-only exercise. Every change must be production-grade and system-wide.

## 1. Everything Must Work

Every visible element must have a real implementation behind it. This includes buttons, navigation, dropdowns, branch switching, forms, search, filters, sorting, pagination, modals, confirmations, save/edit/delete/deactivate actions, notifications, approvals, permissions, reports, inventory, sales, cash, audit actions, settings, and mobile interactions.

Do not create TODOs, placeholders, fake success messages, dead buttons, non-functional dropdowns, static notification counts, or mock data unless explicitly requested.

## 2. System-Wide Integration

Integrate every feature into the existing application. Do not implement isolated pages. A product change must propagate through inventory, sales, receipts, reports, audit, and notifications where applicable. A branch change must propagate through branch context, dashboard, sales, inventory, cash-up, reports, notifications, and audit. An employee change must propagate through roles, permissions, branch access, navigation, actions, audit, and notifications.

## 3. Frontend and Backend Agreement

Verify the complete flow for every action:

```text
User action -> frontend validation -> API/action -> authorization -> database operation
-> business rules -> related records -> audit event -> notification -> updated UI state
```

## 4. Never Fake Success

Only show success after the underlying operation succeeds. On failure, clearly state that no changes were made and provide a useful business-facing recovery message. Keep technical details in server/developer logs.

## 5. Defined Outcomes

Before implementing an action, define what it does, who can use it, what data changes, validation, success behavior, failure behavior, audit requirements, notification requirements, and affected modules.

## 6. Permissions at Every Level

Enforce permissions in the UI, routes, APIs, database operations, and server actions. Hiding a control is not authorization. Direct URLs and direct API calls must also be rejected for unauthorized users.

## 7. System-Wide Branch Context

Selected branch context must apply to every branch-dependent operation, including inventory, sales, cash-up, reports, and notifications. Users must not access or mutate branches outside their assignments through hidden routes or APIs.

## 8. Consistent State

Related records must remain synchronized. Never allow a completed sale without stock reduction, a deleted employee that still appears active, a renamed branch that reports under the old name, or a notification whose state contradicts inventory. Use transactional handling for multi-record business operations.

## 9. Preserve Business History

For business-critical records, prefer deactivate, archive, void, reverse, refund, or correct over destructive deletion. Preserve historical sales, payments, stock movements, and audit records.

## 10. Audit Sensitive Actions

Audit login/security events, employee and permission changes, branch changes, product and price changes, stock adjustments/transfers, sales, voids, refunds, discounts, price overrides, cash-up, variances, and business-setting changes. Each audit record must answer who, what, where, when, and why.

## 11. Real Notifications

Notifications must originate from actual business conditions and reference real recipients, branches, categories, severity, status, related entities, and actions. Never use static notification examples or counts.

## 12. Real Filters

Filters must affect the underlying query or data set. Combined filters for branch, module, user, date, category, status, and priority must all be honored. This applies to sales, inventory, reports, employees, audit, notifications, and branches.

## 13. Real Search

Search must query/filter actual data across all relevant fields, tolerate reasonable variations, and never return hardcoded examples.

## 14. Business-Friendly Errors

Never expose stack traces, SQL errors, API payloads, internal IDs, `undefined`, `null`, `localhost`, or `127.0.0.1` to business users. Present clear messages such as: "Unable to complete the sale. The stock could not be updated. No changes were made."

## 15. Loading and Duplicate Protection

Every asynchronous action must show a loading state, prevent duplicate submissions, and communicate progress such as Saving, Creating, Processing sale, Loading inventory, or Updating branch.

## 16. Intentional Empty States

Never leave a blank screen. Explain when there are no sales, inventory items, approvals, notifications, employees, or matching search results, and provide the next useful action where appropriate.

## 17. Risk-Appropriate Confirmation

Use confirmation and authorization for high-impact actions such as large refunds, stock adjustments, employee/branch deactivation, permission changes, price changes where appropriate, and business configuration changes. Explain the consequence.

## 18. End-to-End Testing

Test happy paths, invalid input, permission failures, unauthorized branch access, network/API failures, timeouts, duplicate actions, refresh/retry, empty states, large data sets, mobile, and desktop behavior.

## 19. Integration Testing

Test complete workflows, not isolated pages. For inventory, test product creation, opening stock, search, sale, automatic stock reduction, sales records, payment/cash updates, audit, notifications, and reporting together.

## 20. Do Not Break Existing Functionality

Before changing an existing component, understand its dependencies, routes, shared state, APIs, database relationships, permissions, and consumers. Make the smallest compatible change and reuse working systems.

## 21. No Isolated Features

For every change, identify affected modules. Employees affect roles, permissions, branch access, navigation, authentication, audit, and notifications. Branches affect users, permissions, inventory, sales, cash, reports, notifications, and audit. Products affect inventory, sales, search, reports, stock, and audit.

## 22. Production Readiness Checklist

Before marking a change complete, verify:

```text
No dead buttons or links
No fake actions or placeholder data
No broken routes
No unauthorized access
No technical debug in the UI
No inconsistent state
No duplicate submissions
No silent failures
No broken mobile or desktop behavior
No branch-context leakage
Audit trail works
Notifications work
Existing features still work
```

## 23. Final Rule

Every DiaPalace feature is a real production feature, not a visual task. The required standard is:

```text
UI -> Logic -> Permissions -> Database -> Related modules -> Audit
-> Notifications -> Error handling -> Responsive behavior -> Testing
```

Nothing is complete merely because it looks correct. It is complete only when the end-to-end business workflow works correctly.
