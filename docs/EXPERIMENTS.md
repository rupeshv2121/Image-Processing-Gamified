# ImageLab — Experiments

The experiments are defined in `experiments/experimentCatalog.m` and executed by
`experiments/runExperiment.m`. In the UI, each experiment has tabs for Aim & Theory, Algorithm,
MATLAB Code (Toolbox / Manual / How it works / the real .m files), Input / Output, Observation &
Conclusion, Quiz and Report.

Run an experiment from MATLAB without the UI:

```matlab
ilab_setup
R = runExperiment(4, imread('peppers.png'));   % Experiment 4: Median filter
struct2table(R.metrics)
R.observations
```

| # | Title | Default image | Measured outputs |
|---|---|---|---|
| 1 | Digital Image Basics | peppers.png | size, channels; sampling 1/2, 1/4, 1/8; 1/2/4-bit quantisation and PSNR |
| 2 | Histogram Processing | lowcontrast.png | histeq, CLAHE, stretching; std and entropy; histogram charts |
| 3 | Mean Filter | peppers.png + Gaussian noise | 3/5/7 mean filters; PSNR/SSIM/time; manual vs toolbox difference and time |
| 4 | Median Filter | peppers.png + salt & pepper | median 3/5 vs mean 3; PSNR bar chart |
| 5 | Gaussian Filter | peppers.png + Gaussian noise | σ = 0.5, 1, 2; kernel; PSNR |
| 6 | Linear vs Non-Linear Filters | peppers.png + salt & pepper | mean, Gaussian, median, min, max; PSNR bar chart |
| 7 | Correlation | [1 2 3; 4 5 6; 7 8 9] ★ [1 0 −1]×3 | output matrix, centre value −6, check against filter2 |
| 8 | Convolution | magic(4) and [1..9] kernel | flipped kernel, check against conv2, correlation vs convolution with Sobel |
| 9 | Image Sharpening | peppers.png | Laplacian, unsharp, high-boost, Sobel; mean gradient |
| 10 | Noise Removal | peppers.png | 4 noise types × 4 filters; best filter per noise |
| 11 | Edge Detection | shapes.png | Roberts, Prewitt, Sobel, LoG, Canny; pixel count, density, time |
| 12 | Thresholding | unevenlight.png | global, Otsu, adaptive; regions; histogram |
| 13 | Color Enhancement | peppers.png | HSV channels, V equalisation, saturation boost, hue shift of RGB equalisation |

## Experiment format (for the lab record)

1. **Aim** — what the experiment shows.
2. **Theory** — the concept and formulas.
3. **Algorithm** — numbered steps.
4. **MATLAB Code** — the toolbox version and the manual version, with a line-by-line explanation.
5. **Input** — the image and parameters.
6. **Output** — the images produced by MATLAB.
7. **Observation** — generated from the measured numbers (e.g. "Best result: median 3x3 with PSNR 33.1 dB").
8. **Result** — the experiment was performed successfully; outputs are shown.
9. **Conclusion** — what was learned.
10. **Quiz** — five questions from the experiment's category.

## Reports

The *Report* tab (or the Reports page) calls `reports/generateReport.m`. The report contains the
experiment title, student names and roll numbers, input/output images, algorithm, MATLAB code,
kernel, parameters, metrics, observations, conclusion and quiz score. It is saved to
`reports/output/*.html`; print it to PDF from the browser.
