# ImageLab — Algorithms

Every algorithm is a MATLAB function. "Toolbox" means the Image Processing Toolbox call that is used
when the toolbox is installed. "Manual" means the ImageLab implementation in base MATLAB. All images are
handled as `double` in [0, 1].

## 1. Linear spatial filtering (correlation)

For a kernel w of size (2a+1)×(2b+1):

    g(x, y) = Σ_{s=-a..a} Σ_{t=-b..b} w(s, t) · f(x+s, y+t)

* Toolbox: `imfilter(I, w, 'replicate')`
* Fast manual: pad the image (`padImage`), then `conv2(P, rot90(w,2), 'valid')` → `core/filter2D.m`
* Loop manual: for each pixel take the window, multiply by w and sum → `core/manualFilterLoop.m`

Borders are padded with `zero`, `replicate` or `symmetric` (`core/padImage.m`).

## 2. Smoothing filters (linear)

| Filter | Kernel | File |
|---|---|---|
| Mean (box) | all weights 1/k² | `meanFilter.m`, `meanFilterManual.m` |
| Weighted mean | outer product of binomial coefficients, e.g. [1 2 1; 2 4 2; 1 2 1]/16 | `weightedMeanKernel.m` |
| Gaussian | exp(−(x²+y²)/2σ²), normalised to sum 1 | `gaussianKernel.m`, `gaussianFilter.m`, `gaussianFilterManual.m` |

**Mean filter (manual):**
```matlab
P = padImage(I, r, r, 'replicate');
for i = 1:rows
    for j = 1:cols
        window = P(i:i+2*r, j:j+2*r);
        J(i,j) = sum(window(:)) / k^2;
    end
end
```

## 3. Order-statistic (non-linear) filters

Sort the k×k window; output = element at position *rank*.

| Filter | Rank (N = k²) | Toolbox |
|---|---|---|
| Minimum | 1 | `ordfilt2(I,1,true(k))` |
| Median | ⌈N/2⌉ | `medfilt2(I,[k k])` |
| Maximum | N | `ordfilt2(I,N,true(k))` |
| Midpoint | (min + max)/2 | — |
| Alpha-trimmed mean | mean of ranks d/2+1 … N−d/2 | — |

Without loops, `core/neighborhoodStack.m` builds an h×w×k² array of all neighbourhoods so that
`median(S,3)`, `min(S,[],3)` or `sort(S,3)` filter the whole image at once.

**Why the median removes salt & pepper noise:** impulses are extreme values (0 or 1). After sorting
they sit at the ends of the list, so the middle element is a genuine neighbourhood value. The mean filter
instead spreads every impulse into a grey blob. Because the median is always an existing value, it
also keeps edges sharp.

## 4. Correlation and convolution

* `manualCorrelation(I, K, shape, padMode)` returns the result and every step (window, products, sum).
* `manualConvolution` = `manualCorrelation(I, rot90(K,2), …)`.
* Verified against `filter2(K, I, shape)` (correlation) and `conv2(I, K, shape)` (convolution) for
  `same`, `valid` and `full`.

## 5. Histogram processing

| Method | Formula | Files |
|---|---|---|
| Histogram | h(r_k) = n_k (accumarray) | `imhistManual.m` |
| Equalisation | s_k = round(255 · Σ_{j≤k} n_j/MN) | `histogramEqualizationManual.m`, `histogramEqualization.m` (histeq) |
| CLAHE | tile histograms, clip at limit, redistribute, CDF per tile, bilinear interpolation | `claheManual.m`, `clahe.m` (adapthisteq) |
| Contrast stretching | s = (r − low)/(high − low), limits = 1st/99th percentile | `contrastStretch.m` (imadjust) |
| Gamma | s = c·r^γ | `gammaCorrection.m` |
| Log | s = log(1 + k r)/log(1 + k) | `logTransform.m` |
| Negative | s = 1 − r | `negativeTransform.m` |
| Statistics | mean, variance, std, entropy −Σ p log₂ p | `imageStatistics.m` |

Colour images are equalised on the V channel of HSV (`core/applyToLuminance.m`) so that hues do not change.

## 6. Noise models

| Noise | Model | File |
|---|---|---|
| Gaussian | g = f + N(μ, σ²) | `addGaussianNoise.m` |
| Salt & pepper | r < d/2 → 0, d/2 ≤ r < d → 1 | `addSaltPepperNoise.m` |
| Speckle | g = f + n·f, n uniform with variance v | `addSpeckleNoise.m` |
| Poisson | g ~ Poisson(255 f)/255 (Knuth for small λ, normal approximation for large λ) | `addPoissonNoise.m` |

## 7. Quality metrics

* MSE = mean((A − ref)²)
* PSNR = 10 log₁₀(1 / MSE) dB (Inf for identical images)
* SSIM = ((2μxμy + C1)(2σxy + C2)) / ((μx² + μy² + C1)(σx² + σy² + C2)), 11×11 Gaussian window with
  σ = 1.5, C1 = 0.01², C2 = 0.03²; colour = mean over channels.

## 8. Sharpening

* Laplacian kernel (manual = `fspecial('laplacian', α)`):
  `K = 4/(α+1) · [α/4 (1−α)/4 α/4; (1−α)/4 −1 (1−α)/4; α/4 (1−α)/4 α/4]`; sharpened g = f − c·(K ★ f).
* Gradient sharpening: g = f + w·|∇f| with Sobel or Prewitt.
* Unsharp masking: mask = f − Gaussian(f); g = f + k·mask.
* High-boost: mask = f − mean(f); g = f + k·mask with k > 1.

## 9. Edge detection

| Detector | Method | File |
|---|---|---|
| Roberts | 2×2 diagonal differences | `robertsManual.m` |
| Prewitt | [−1 0 1] × 3 rows, magnitude √(gx² + gy²) | `prewittManual.m` |
| Sobel | [−1 0 1; −2 0 2; −1 0 1] | `sobelManual.m` |
| Thresholding | automatic threshold √(4·mean(|∇f|²)) and thinning, as in `edge` | `edgeDetect.m` |
| LoG | LoG kernel, zero crossings with \|jump\| > 0.75·mean\|R\| | `logKernel.m`, `logEdgeManual.m` |
| Canny | Gaussian → Sobel gradient → non-maximum suppression → double threshold (70th percentile, 0.4×) → hysteresis via connected components | `cannyManual.m` |

## 10. Segmentation

| Method | Idea | File |
|---|---|---|
| Global | g = f > T | `globalThreshold.m` |
| Iterative | T = (m₁ + m₂)/2 until convergence | `iterativeThreshold.m` |
| Otsu | maximise σ²_B(k) = (μ_T ω(k) − μ(k))² / (ω(k)(1 − ω(k))) | `otsuThreshold.m` |
| Adaptive | f > local mean − C | `adaptiveThreshold.m` |
| Point detection | \|[−1 −1 −1; −1 8 −1; −1 −1 −1] ★ f\| ≥ T·max | `pointDetection.m` |
| Line detection | horizontal / vertical / ±45° masks | `lineDetection.m` |
| Region growing | BFS from the seed, \|f − f(seed)\| ≤ tol | `regionGrowing.m` |
| Split & merge | quadtree split while std > limit, union-find merge of similar neighbours | `splitAndMerge.m` |
| Labelling | BFS flood fill (= bwlabel) | `labelComponents.m` |
| Region description | area, centroid, bounding box, perimeter, equivalent diameter | `regionProperties.m` |
| Boundary | A − erode(A) | `extractBoundary.m` |

## 11. Colour

* YCbCr (BT.601) and its inverse — `rgbToYCbCr.m`, `yCbCrToRgb.m`
* CIE L\*a\*b\* (sRGB, D65) and its inverse — `rgbToLab.m`, `labToRgb.m`
* HSV — MATLAB's `rgb2hsv` / `hsv2rgb` (base MATLAB)
* Per-channel gain / equalisation / gamma — `colorEnhance.m`

## 12. Fundamentals

* Sampling: `I(1:f:end, 1:f:end)` with `repelem` for display — `sampleImage.m`
* Quantisation: `floor(I·2^k)/(2^k − 1)` — `quantizeImage.m`
* N4 / ND / N8, 4- / 8- / m-adjacency and distance maps — `pixelNeighborhood.m`, `pixelDistances.m`
