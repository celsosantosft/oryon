# Corte PCP

## Operational Flow

- The cutting screen uses real active orders only. API failure must show a real error and never populate fake orders.
- It is mobile-first and designed for cutters using a dedicated cutting login.
- The interface inherits each installation theme: Atos uses the default blue theme and PD Fardamentos uses the monochrome theme. Do not hardcode one tenant color for every customer.
- Show sections only when active orders exist. Fabric names that differ operationally, such as DryFit Liso and DryFit Furadinho, stay in separate sections.
- Inside each fabric section, group orders by model/product. Different models such as Camisa, Raglan, Regata and Short must not mix.
- Moving an order out of a cutting status in the production Kanban must remove it from the active cutting queue.
- Completing one order advances only that order, updates Kanban and customer portal, and records who completed it and when.

## Order Presentation

- Show code, customer, model, fabric, color/variation, nonzero size grade, total pieces, urgency and delivery date.
- Do not display sizes whose quantity is zero or absent.
- Prioritize urgent and nearest-deadline orders.

## Cutting Plan Rules

- Table dimensions and each fabric width are configurable because tenants may use different equipment and materials.
- Marker pieces must not rotate because of the fabric grain.
- A basic shirt requires one front, one back and two sleeves.
- A marker may mix sizes. It must never leave requested pieces missing; controlled surplus is preferable and must be counted.
- Small remaining quantities may be assigned to an offcut or a short separate spread instead of forcing a wasteful full spread.
- A back piece may be converted to a front when the cutter is clearly instructed how many layers to transform.
- The printable PDF uses one A4 page per spread, with the complete drawing and production/surplus counts on that page.
