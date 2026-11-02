# Grocery Shopping Data Visualisation

Three weeks of grocery receipts from five people, laid out as the supermarket they were bought in. Each aisle is a category. Look at one person's store, where shading shows where their money went, or compare people aisle by aisle.

**Live:** https://methblaze.github.io/grocery-data-visualisation/

Built with D3 for the course Data Visualisation Design at the IT University of Copenhagen, spring 2024. The data was collected by the group from its own receipts between 20 March and 10 April 2024.

## What is in here

| File | What it is |
|---|---|
| `Updated2026.html` | The 2026 redesign. Same data, new interface, and a comparison mode the original did not have. The root URL opens this. |
| `store/` | The 3D store: the same shop as a supermarket you can walk through. Built from `store-app/`. |
| `Final.html` | The interactive prototype as submitted in 2024. |
| `alternative1.html`, `alternative2.html`, `alternative3.html`, `category.html`, `money.html` | The early non-interactive prototypes: pie and stacked bar charts tried before the floor plan. |
| `data.csv` | The raw receipt log. |
| `index.html` | Redirects to `Updated2026.html`. |

## The 2026 redesign

The 2024 version proved the idea, that a supermarket floor plan is a frame people already know, so they spend their attention on the numbers instead of on a legend. What it did not do was let anyone read those numbers. Each aisle had its own colour, twelve in total, encoding categories that position and labels already identified, and every figure sat behind a hover.

The redesign gives colour a job. Shading now runs light to dark by amount spent, so the store can be read at a glance. Amounts are printed on the aisles, totals sit in the header, the layout scales with the screen, and label contrast was checked rather than eyeballed.

A wiper button above the store sweeps between the two versions, redrawing the 2024 store exactly as it was submitted on top of the 2026 one, so the change can be seen on the same data in the same place.

It also adds a comparison mode. One bar per person inside every aisle, all on one scale across the whole store, so who spent more on what can be read directly. Identity is carried by colour, by a fixed row order and by an initial beside each bar, so nothing depends on colour alone.

## The 3D store

**Live:** https://methblaze.github.io/grocery-data-visualisation/store/

The floor plan, built as a supermarket you can walk through: coolers and shelves along the back wall, four islands in the middle, drinks and sweets on the right, the checkout at the front. Every unit on every receipt line in `data.csv` is a product on its aisle's shelves, grouped by shopper.

- **Pick a shopper** and their products light up and slide forward, while everyone else's fade. The sign above each aisle shows what they spent there, and a bar above the fixture fills as far as that amount reaches, on one scale for all five people, so the aisles read as a bar chart from across the shop. Arriving at an aisle sends their items from it into your basket, and the checkout shows what they paid and saved.
- **Guided or free.** The guided walk stops in front of every aisle: arrow keys, the scroll wheel, the buttons or the aisle list move you on, and dragging looks around. Free walk is WASD or the arrow keys, or the on-screen pad on a touch screen, and the shelves stop you.
- **The numbers** on the signs, in the basket and at the checkout are the corrected totals the 2026 version shows. The products are the receipt lines. The two do not match exactly (the receipt lines add up to 5.537,55 DKK, the corrected total is 5.423,10 DKK), so wherever they differ for a shopper the store shows both rather than picking one.
- Hover or tap a product for its receipt line. Each aisle's panel lists the shopper's lines, and screen readers hear each aisle as you arrive. With reduced motion, the walk jumps from aisle to aisle and nothing flies.

Every packaged product is shaped in code from its receipt line (a carton for milk, a tin for tuna, a bag for crisps) and printed with the item's own name and unit price; no brand packaging is copied. Produce and bread use real scanned models where one matches the item, all CC0 from [Poly Haven](https://polyhaven.com), compressed into `store-app/public/models/`:

| Model | Author | Used for |
|---|---|---|
| Bananas | Alexander Shulha | Bananer, Øko bananer |
| Food Ginger 01, Food Lime 01, Food Avocado 01, Food Kiwi 01 | Oliver Harries | Ingefær, Lime, Avocado, Kiwi |
| Pears Asian 01 | Amal Kumar | Pærer |
| Yellow Onion | Kuutti Siitonen | Øko løg, and Rødløg tinted red |
| Lemon | Kuutti Siitonen | Appelsiner, tinted orange |
| Sweet Potato | Jan Martens | Kartofler, tinted paler |
| Croissant | Greg Zaal, Dario Barresi | Crodots |
| Plastic Crate 02 | Fabi_G | The produce crates |

Built with React Three Fiber (three.js), React Spring and zustand in `store-app/`. To work on it:

```
cd store-app
npm install
npm run dev     # http://localhost:5173/grocery-data-visualisation/store/
npm test        # checks the totals against Updated2026.html and that they add up
npm run build   # writes ../store, which GitHub Pages serves
```

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
