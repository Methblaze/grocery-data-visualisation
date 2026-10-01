# Grocery Shopping Data Visualisation

Three weeks of grocery receipts from five people, laid out as the supermarket they were bought in. Each aisle is a category. Look at one person's store, where shading shows where their money went, or compare people aisle by aisle.

**Live:** https://methblaze.github.io/grocery-data-visualisation/

Built with D3 for the course Data Visualisation Design at the IT University of Copenhagen, spring 2024. The data was collected by the group from its own receipts between 20 March and 10 April 2024.

## What is in here

| File | What it is |
|---|---|
| `Updated2026.html` | The 2026 redesign. Same data, new interface, and a comparison mode the original did not have. The root URL opens this. |
| `Final.html` | The interactive prototype as submitted in 2024. |
| `alternative1.html`, `alternative2.html`, `alternative3.html`, `category.html`, `money.html` | The early non-interactive prototypes: pie and stacked bar charts tried before the floor plan. |
| `data.csv` | The raw receipt log. |
| `index.html` | Redirects to `Updated2026.html`. |

## The 2026 redesign

The 2024 version proved the idea, that a supermarket floor plan is a frame people already know, so they spend their attention on the numbers instead of on a legend. What it did not do was let anyone read those numbers. Each aisle had its own colour, twelve in total, encoding categories that position and labels already identified, and every figure sat behind a hover.

The redesign gives colour a job. Shading now runs light to dark by amount spent, so the store can be read at a glance. Amounts are printed on the aisles, totals sit in the header, the layout scales with the screen, and label contrast was checked rather than eyeballed.

A wiper button above the store sweeps between the two versions, redrawing the 2024 store exactly as it was submitted on top of the 2026 one, so the change can be seen on the same data in the same place.

It also adds a comparison mode. One bar per person inside every aisle, all on one scale across the whole store, so who spent more on what can be read directly. Identity is carried by colour, by a fixed row order and by an initial beside each bar, so nothing depends on colour alone.

## A note on the data

Three figures in the 2024 prototype did not match the group's own summary spreadsheet and were corrected in 2026: Jonathan's checkout total and savings, which duplicated another person's figures, and one category total that was off by a single digit. With those fixed, every person's aisles sum to their own total and the five totals sum to the combined figure. The corrections apply to both `Final.html` and `Updated2026.html`.

## Running it locally

The early prototypes load `data.csv` at runtime, which browsers block on `file://`. Serve the folder instead:

```
python3 -m http.server
```

then open http://localhost:8000.

## Credits

Data collection, analysis and the 2024 prototype by ITU group 17: Anna, Camille, Isabella, Jonathan and Nikoline.

2026 redesign by Jonathan Kjær.
