# ImageLab — User Guide

## 1. Starting ImageLab

| Method | How | Notes |
|---|---|---|
| From MATLAB | `cd` to the project folder, type `ImageLab` | Uses *your* MATLAB session for processing. Best for the demonstration. |
| Double-click | `start_imagelab.bat` | Starts a background MATLAB engine automatically. |
| MATLAB only | `ilab_setup`, then call any function | No user interface; see `ImageLab_Demonstration.mlx`. |

The browser opens at **http://localhost:8765**. The top bar shows whether MATLAB is connected and
whether the Image Processing Toolbox is installed. Without the toolbox, ImageLab uses its manual
base-MATLAB implementations automatically (identical results, verified by the unit tests).

First start takes 10–60 s (MATLAB start-up and graphics warm-up).

## 2. Loading an image

*Image Workspace → Load Image…* (PNG, JPG, TIF, BMP, GIF up to 25 MB) or click a sample image:

| Sample | Use it for |
|---|---|
| peppers.png | Main demo image (colour) |
| lowcontrast.png | Histogram equalisation, CLAHE |
| shapes.png | Edge detection, segmentation |
| gradient.png | Quantisation / false contouring |
| lines.png | Point and line detection |
| unevenlight.png | Adaptive thresholding |
| cameraman.tif, coins.png, pout.tif, saturn.png … | Available when the Image Processing Toolbox is installed |

Images larger than 640 px are resized so the manual loop implementations stay fast.

## 3. The workspace model

* The **Original** image is what you loaded. The **Processed** image is the current working image.
* Every lab processes the *current* image. Press **➜ Workspace** on any result to make it the new
  current image. **Undo / Redo / Reset** move through this history.
* **Save Result** downloads the current image as PNG.
* **Show Image Info** asks MATLAB for width, height, channels, class, data type and colour space.

## 4. The labs

* **Pixels & Sampling** — click the grid to set p, q or toggle pixels; view N4, ND, N8, 4-, 8- and
  m-adjacency, and the De / D4 / D8 distance maps. The second tab shows sampling and quantisation.
* **Histogram Lab** — choose a method, then press Apply. Both histograms are shown, with the
  transfer function in orange and mean / variance / std / entropy in a table.
* **Spatial Filters** — linear and non-linear tabs. Choose *MATLAB Toolbox*, *Manual loops* or
  *Compare both*, which shows both outputs, both run times and the maximum difference.
* **Correlation & Convolution** — enter a matrix and a kernel (fractions like 1/9 are allowed), then
  press Play or step with Next/Prev. Convolution first shows the kernel being flipped.
* **Kernel Playground** — edit any cell; with *Apply automatically* the result updates as you type.
  You can load presets, normalise the kernel and save kernels (`data/kernels.mat`).
* **Sharpening Lab** — Laplacian (α, strength, 8-neighbour), Sobel/Prewitt, unsharp, high-boost.
* **Noise Lab** — adds noise to the current image and shows the original, noisy and difference images
  with MSE / PSNR / SSIM.
* **Filter Comparison** — adds noise to the *original* (fixed seed), runs the selected filters and
  ranks them. The bar charts are drawn by MATLAB (`bar`).
* **Edge Detection** — tick the detectors; automatic or manual threshold; optional manual Sobel /
  Prewitt gx, gy and |∇f| images.
* **Segmentation** — the global threshold slider re-segments live; for region growing, click the
  image to place the seed. A region table lists area, centroid, bounding box and perimeter.
* **Color Processing** — split into RGB / HSV / YCbCr / L\*a\*b\* channels; enhance one channel.

Every lab has a **</> View MATLAB Code** button that shows the real `.m` files from the project.

## 5. Experiments and reports

*Experiments* lists 13 experiments. Each has tabs for Aim & Theory, Algorithm, MATLAB Code (Toolbox /
Manual / how it works / the actual .m files), Input / Output (runs in MATLAB), Observation &
Conclusion, Quiz and Report. Running an experiment marks it complete (+50 XP).

*Report*: enter student names and roll numbers, then press **Generate report**. MATLAB writes a
self-contained HTML file to `reports/output/`. Open it and use **Print → Save as PDF** for a PDF, or open
it in Word. A DOCX is also produced when MATLAB Report Generator is installed.

## 6. Quizzes and games

* **Rapid Fire Quiz** — 10 questions, 10 s each. Choose the difficulty and categories. Keys 1–4 / A–D
  answer and Enter moves to the next question. Enter your name to save the score to the leaderboard.
* **Kernel Quiz** — identify kernels generated from `kernelPresets.m`.
* **Guess the Filter** — MATLAB applies a random filter; guess which one.
* **Build the Pipeline** — pick a problem, add blocks in order and run them; the result is judged
  against the expected pipeline and measured with PSNR / SSIM.
* **Challenge Mode** — restore a degraded image before the timer ends. The score is based on PSNR gain,
  SSIM gain and time.
* **Classroom Mode** — large type for a projector; the class answers together and the teacher can
  reveal the answer early.

The leaderboard and progress are stored by MATLAB in `quizzes/leaderboard.mat` and `data/userProgress.mat`.

## 7. Troubleshooting

| Message | Fix |
|---|---|
| "Cannot reach the ImageLab server" | Start `start_imagelab.bat` or type `ImageLab` in MATLAB |
| "Could not start MATLAB through the MATLAB Engine API" | Run `setup_imagelab.bat`; the `matlabengine` version must match your MATLAB release |
| "No image loaded" | Load an image in the Workspace first |
| "Kernel size must be an odd integer…" | Kernels need odd sizes (3, 5, 7 …) so they have a centre |
| "This file is not a supported image" | Use PNG, JPG, TIF, BMP or GIF |
| Manual mode is slow | Expected: loops run pixel by pixel. Use *MATLAB Toolbox* mode for speed |
