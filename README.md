# Pothen

Project website for **Pothen: Can Vision-Language Models Tell Where a Cultural Object Comes From?**

Live site: <https://carolyn-jiang.github.io/Pothen/>

Dataset: <https://huggingface.co/datasets/Carolyn-Jiang/Metadata-Inference>

## Run and publish

This is a buildless static website. Serve the repository root over HTTP; no dependency installation or build step is required.

```sh
python3 -m http.server 8000
```

GitHub Pages should publish `main` from `/ (root)`. `.nojekyll` prevents Jekyll preprocessing. The paper download lives at `assets/Pothen.pdf`.

## Interaction

- Collection: text search, region/type/museum filters, grid and horizontal views, a user-started pausable tour, random discovery, and a record dialog. Left/right arrow keys navigate objects and Escape closes the dialog.
- Leaderboard: metric sorting in either direction, model search, overall/field views, downloadable JSON, and per-model profiles. Rows can be activated with Enter or Space.
- The layout supports small screens, visible keyboard focus, native dialog focus handling, and reduced-motion preferences. Automatic motion is never started on page load.

## Data provenance

The leaderboard in `data/leaderboard.json` copies the current stored **full-run DS-J** point estimates from the [dataset card](https://huggingface.co/datasets/Carolyn-Jiang/Metadata-Inference/blob/main/README.md) and 95% confidence intervals from the paper's `tab:overall` table. The nine endpoints attempted 750 objects each. Accuracy denominators include valid outputs only. Candidate-stage judge comparisons and legacy results are not mixed into this table. Sorting is exploratory; overlapping confidence intervals do not establish a definitive model ranking.

The gallery is an explicitly labelled **44-object curated selection** covering all 15 available region–type cells of the 750-object benchmark. It contains actual benchmark objects, with released reference alternatives and original museum object/image URLs retained in `data/gallery.json`. Source archive: [exp_data.zip](https://huggingface.co/datasets/Carolyn-Jiang/Metadata-Inference/resolve/main/exp_data.zip); references: [reference_labels.json](https://huggingface.co/datasets/Carolyn-Jiang/Metadata-Inference/blob/main/reference_labels.json). Images were cached as thumbnails (maximum dimension 700 px) without generative modification. One non-CC0 candidate was excluded. Unicode-normalized matching reconciles the decomposed/macron spelling of the Tantō object ID with its released reference entry.

Each gallery record preserves the image rights evidence and the archive-relative metadata path. “Not recorded” denotes an empty released reference array; explicit unknown-maker references remain explicit labels. Geographic regions are sampling strata, not substitutes for the museum-recorded culture field. Data was checked on 18 November 2026.

## Third-party assets

- Displayed Met object images: [Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access), public domain / [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The selected metadata records mark `isPublicDomain: true`.
- Displayed Getty object images: [Getty Open Content](https://www.getty.edu/projects/open-content-program/), with explicit CC0 statements in the selected IIIF manifests. Getty descriptive/IIIF metadata remains attributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), subject to object-level rights statements. Image and metadata licenses are stated separately on the website.
- The self-hosted wordmark font is **TeX Gyre Chorus Medium Italic**, matching the paper's title font. See `assets/FONT-LICENSE.txt` for its GUST Font License. No external font service or analytics is used.

Original museum photographs retain their source colours. Their rights and source links are accessible in every object dialog and in the page footer.
