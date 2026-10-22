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
| Matching | z = G⁻¹(T(r)): equalise the input and the desired histogram, invert the second CDF | `histogramMatching.m`, `targetHistogram.m` (histeq with hgram) |
| Contrast stretching | s = (r − low)/(high − low), limits = 1st/99th percentile | `contrastStretch.m` (imadjust) |
| Gamma | s = c·r^γ | `gammaCorrection.m` |
| Log | s = log(1 + k r)/log(1 + k) | `logTransform.m` |
| Negative | s = 1 − r | `negativeTransform.m` |
| Piecewise linear | (0,0) → (r₁,s₁) → (r₂,s₂) → (1,1); r₁ = r₂ gives a threshold | `piecewiseLinear.m` |
| Gray-level slicing | range [A, B] → bright, rest dark (binary) or unchanged (preserve) | `grayLevelSlicing.m` |
| Bit-plane slicing | plane k = bitget(G, k); rebuild from chosen planes Σ b_k 2^(k−1) | `bitPlaneSlicing.m` |
| Statistics | mean, variance, std, entropy −Σ p log₂ p | `imageStatistics.m` |

Colour images are equalised on the V channel of HSV (`core/applyToLuminance.m`) so that hues do not change.

## 6. Noise models and restoration

| Noise | Model | File |
|---|---|---|
| Gaussian | g = f + N(μ, σ²) | `addGaussianNoise.m` |
| Salt & pepper | r < d/2 → 0, d/2 ≤ r < d → 1 | `addSaltPepperNoise.m` |
| Rayleigh | z = a + √(−b ln(1 − U)); mean a + √(πb/4), variance b(4 − π)/4 | `addRayleighNoise.m` |
| Erlang (gamma) | z = −(1/a) Σ_{i=1..b} ln U_i; mean b/a, variance b/a² | `addErlangNoise.m` |
| Exponential | z = −ln(1 − U)/a; mean 1/a, variance 1/a² | `addExponentialNoise.m` |
| Uniform | z = a + (b − a)U; mean (a + b)/2, variance (b − a)²/12 | `addUniformNoise.m` |

Mean filters for restoration (box sums with `filter2D`): geometric exp(mean(log g)), harmonic
k²/Σ(1/g), contraharmonic Σg^(Q+1)/Σg^Q (Q > 0 removes pepper, Q < 0 salt) —
`geometricMeanFilter.m`, `harmonicMeanFilter.m`, `contraharmonicMeanFilter.m`.

**Linear, position-invariant degradation** g = h ★ f + η (`degradeLPI.m`, `blurImage.m`). PSFs
(`blurPSF.m`): motion (bilinear-sampled line of length L at angle θ), Gaussian (atmospheric turbulence),
disk (out of focus), box. Restoration (`deconvolveImage.m`) solves (H′H + λR′R) f = H′g by conjugate
gradients using only convolutions — no Fourier transform:

| Method | λ, R | Converges to |
|---|---|---|
| Inverse | λ = 0 | F = G / H |
| Wiener | λ = K, R = I | F = H*G / (\|H\|² + K) |
| Constrained least squares | λ = γ, R = Laplacian | F = H*G / (\|H\|² + γ\|P\|²) |
| Richardson–Lucy | f ← f · (h′ ★ (g / (h ★ f))) | maximum-likelihood estimate |

## 7. Quality metrics

* MSE = mean((A − ref)²)
* PSNR = 10 log₁₀(1 / MSE) dB (Inf for identical images)

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
| Canny | Gaussian → Sobel gradient → non-maximum suppression → double threshold (70th percentile, 0.4×) → hysteresis (edge tracking from the strong pixels into 8-neighbouring weak pixels) | `cannyManual.m` |
| Hough transform | every edge pixel votes for ρ = x cos θ + y sin θ, θ ∈ [−90°, 90°); peaks with neighbourhood suppression; segments along each peak line, gaps ≤ fillGap bridged | `houghTransform.m`, `houghPeaks.m`, `houghLines.m` |
| Local edge linking | Sobel magnitude > T_M and angle within ±T_A of 90° (rows) or 0° (columns); gaps ≤ K filled | `localEdgeLinking.m` |

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
| Region description | area, centroid, bounding box, perimeter, equivalent diameter | `regionProperties.m` |
| Region outline | foreground pixels that have a background 8-neighbour | `extractBoundary.m` |

## 10b. Representation and description

| Descriptor | Method | File |
|---|---|---|
| Chain code | Moore-neighbour tracing, Freeman directions; first difference, shape number | `chainCode.m`, `chainCodeDescriptors.m` |
| Signature | distance from the centroid per degree (farthest point; empty angles interpolated) | `boundarySignature.m` |
| Polygonal approximation | splitting: farthest pair, then recursive farthest-from-chord vertices while > tol | `polygonApprox.m` |
| Fourier descriptors | DFT of x + jy; rebuild from the P lowest frequencies; \|a(u)\|/\|a(1)\| invariants | `fourierDescriptors.m` |
| Skeleton | S(A) = ∪ₖ (A ⊖ kB) − (A ⊖ kB) ∘ B | `morphSkeleton.m` |
| Moments | η_pq, Hu's φ₁…φ₇, orientation, axes and eccentricity from second moments | `regionMoments.m` |
| Texture | mean, σ, R = 1 − 1/(1 + σ²), μ₃, uniformity, entropy of the region histogram | `textureDescriptors.m` |

## 11. Colour

* HSV — MATLAB's `rgb2hsv` / `hsv2rgb` (base MATLAB)
* HSI (Gonzalez & Woods, sector formulas) — `rgbToHsi.m`, `hsiToRgb.m`
* CMY = 1 − RGB, CMYK with K = min(C, M, Y) — `rgbToCmyk.m`
* Per-channel gain / equalisation / gamma — `colorEnhance.m`
* Pseudocolour: intensity slicing with a colour map — `intensitySlicing.m`; three phase-shifted sinusoids
  R, G, B = \|sin(2πf r + φ)\| — `grayToColor.m`

## 12. Fundamentals

* Sampling: `I(1:f:end, 1:f:end)` with `repelem` for display — `sampleImage.m`
* Quantisation: `floor(I·2^k)/(2^k − 1)` — `quantizeImage.m`
* N4 / ND / N8, 4- / 8- / m-adjacency and distance maps — `pixelNeighborhood.m`, `pixelDistances.m`
* Perception: Mach bands with a difference-of-Gaussians (lateral inhibition) model, simultaneous
  contrast, Weber ratio ΔI/I — `perceptionDemo.m`
* Spectrum: colour of a wavelength (380–780 nm), ν = c/λ, E = hν — `wavelengthToRGB.m`
