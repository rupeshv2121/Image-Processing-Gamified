# ImageLab: Image Enhancement using Different Spatial Domain Filters
### An Interactive MATLAB-Based Image Processing and Learning Laboratory

---

## Abstract

Image enhancement improves the visual quality of an image or prepares it for further analysis. This
project presents **ImageLab**, an interactive laboratory in which the most important *spatial-domain*
enhancement techniques are implemented in MATLAB and can be explored visually. ImageLab includes
linear smoothing filters (mean, weighted mean, Gaussian), non-linear order-statistic filters (median,
minimum, maximum, midpoint, rank and alpha-trimmed mean), sharpening filters (Laplacian, Sobel,
Prewitt, unsharp masking, high-boost) and histogram processing (equalisation, CLAHE, contrast
stretching, gamma and log transforms). Supporting modules cover noise models, correlation and
convolution, edge detection, segmentation and colour processing.

Every major algorithm is implemented twice: with the MATLAB Image Processing Toolbox, and manually with
loops and matrix operations. Unit tests verify that both versions produce identical results. Filters are
compared quantitatively with MSE, PSNR, SSIM and processing time. For example, on salt-and-pepper
noise the 3×3 median filter clearly outperforms the mean filter, while averaging filters perform best
on Gaussian noise. An experiment module, quizzes and report generation make the tool suitable for
teaching.

---

## 1. Introduction

Digital images are often degraded by noise, poor contrast or blur, caused by the sensor, the lighting or
the transmission channel. *Image enhancement* processes an image so that the result is more suitable than
the original for a specific application. Enhancement techniques fall into two families: **spatial-domain**
methods, which operate directly on the pixels, and frequency-domain methods, which operate on the
Fourier transform. This project concentrates on spatial-domain methods, which are intuitive, local and
computationally simple.

In the spatial domain an operator T is applied to a neighbourhood of every pixel:

    g(x, y) = T[ f(x, y) ]

If the neighbourhood is a single pixel, T is an intensity transformation (for example histogram
equalisation). If it is a small window, T is a spatial filter defined by a kernel (mask).

## 2. Problem Statement

Students often use image-processing functions such as `imfilter`, `medfilt2` or `histeq` as black boxes,
without understanding the computation behind them. They also find it hard to judge *which* filter to use
for *which* degradation. The project therefore aims to build an interactive MATLAB-based laboratory that:

* implements spatial enhancement filters both with the toolbox and from first principles,
* shows each step visually (for example, the kernel moving during correlation and convolution),
* compares filters objectively on controlled degradations, and
* supports learning through experiments, quizzes and reports.

## 3. Objectives

1. Implement linear and non-linear spatial filters in MATLAB, each in a toolbox and a manual version.
2. Model common noise types (Gaussian, salt & pepper, speckle, Poisson) and measure the restoration
   quality with MSE, PSNR and SSIM.
3. Demonstrate correlation, convolution and the role of kernel flipping step by step.
4. Implement histogram processing: histogram, equalisation, CLAHE, contrast stretching, gamma and log.
5. Implement sharpening, edge detection, thresholding/segmentation and colour enhancement.
6. Provide an interactive interface, 13 experiments, a quiz system and automatic report generation.
7. Verify the implementations with automated unit tests.

## 4. Methodology

1. **Image acquisition** — images are read with `imread` and converted to double in [0, 1].
2. **Degradation** — noise is added with `imnoise` or the equivalent manual models.
3. **Enhancement / restoration** — the selected spatial filter or intensity transformation is applied.
4. **Evaluation** — the result is compared with the clean original using MSE, PSNR and SSIM, and the
   processing time is measured.
5. **Comparison** — several filters are run on the same degraded image and ranked (tables and bar charts).
6. **Verification** — manual implementations are checked against MATLAB built-ins (`conv2`, `filter2`,
   toolbox functions) with `matlab.unittest`.

**System design.** All processing is in MATLAB functions organised by topic (`algorithms/`, `noise/`,
`histogram/`, `metrics/`, `segmentation/`, `color/`). A dispatcher function (`ilab_dispatch.m`) exposes
them to an interactive web interface through the MATLAB Engine API. The interface only displays the
images that MATLAB produces.

## 5. Algorithms

### 5.1 Spatial correlation and convolution
Correlation: g(x,y) = Σ_s Σ_t w(s,t) f(x+s, y+t). Convolution is the same with the kernel rotated by
180°: g(x,y) = Σ_s Σ_t w(s,t) f(x−s, y−t). For symmetric kernels both operations give the same result.

### 5.2 Smoothing (linear) filters
* **Mean filter:** every weight is 1/k². It reduces random noise but blurs edges.
* **Weighted mean:** binomial weights, e.g. (1/16)[1 2 1; 2 4 2; 1 2 1].
* **Gaussian filter:** w(s,t) ∝ exp(−(s²+t²)/2σ²); σ controls the amount of smoothing.

### 5.3 Order-statistic (non-linear) filters
The neighbourhood is sorted, and the median (rank ⌈N/2⌉), minimum (rank 1), maximum (rank N), midpoint
or alpha-trimmed mean is taken. The median removes impulse noise because the extreme impulse values are
placed at the ends of the sorted window and are never selected.

### 5.4 Histogram processing
Equalisation: s_k = (L−1) Σ_{j≤k} p(r_j). CLAHE equalises tiles, clips each tile histogram at a limit and
interpolates bilinearly between tiles. Contrast stretching, gamma (s = c·r^γ) and log (s = c·log(1+r))
transformations are also implemented.

### 5.5 Sharpening
Laplacian: ∇²f ≈ [0 1 0; 1 −4 1; 0 1 0] ★ f, and the sharpened image is g = f − ∇²f. Unsharp masking:
g = f + k(f − f_blur); with k > 1 this is high-boost filtering. Gradient sharpening uses the Sobel or
Prewitt magnitude.

### 5.6 Edge detection and segmentation
Edges are found with Roberts, Prewitt and Sobel gradients, the LoG (zero crossings) and Canny (smoothing,
gradient, non-maximum suppression, hysteresis). Segmentation is done with global, iterative, Otsu and
adaptive thresholding, point and line detection, region growing, split-and-merge, connected-component
labelling and region properties.

### 5.7 Quality metrics
MSE = (1/MN) Σ (f − g)²; PSNR = 10 log₁₀(MAX²/MSE); SSIM compares local luminance, contrast and structure.

## 6. Implementation

* **Platform:** MATLAB R2026a; Image Processing Toolbox used when available. Without it, base-MATLAB
  implementations are used automatically.
* **Manual implementations:** `meanFilterManual`, `medianFilterManual`, `orderStatisticFilterManual`,
  `gaussianKernel`, `manualCorrelation`, `manualConvolution`, `laplacianKernel`, `sobelManual`,
  `prewittManual`, `robertsManual`, `cannyManual`, `histogramEqualizationManual`, `claheManual`,
  `otsuThreshold`, `regionGrowing`, `labelComponents`, `splitAndMerge`, `rgbToYCbCr`, `rgbToLab` and others.
* **Example (median filter, manual):**
```matlab
for i = 1:rows
    for j = 1:cols
        window = P(i:i+2*r, j:j+2*r);     % neighbourhood
        sortedWindow = sort(window(:));    % sort
        J(i,j) = sortedWindow(mid);        % middle value
    end
end
```
* **User interface:** dashboard, workspace with undo/redo, labs for every topic, a kernel playground,
  step-by-step correlation/convolution, 13 experiments with "View MATLAB Code", quizzes, a leaderboard
  and reports.
* **Testing:** 42 `matlab.unittest` tests (each manual implementation against its reference, known
  values, edge cases, error handling), run for both the toolbox and the manual code paths, plus an API
  smoke test that calls every operation.

## 7. Results

Measured in MATLAB R2026a on peppers.png (512×384, RGB), random seed 7, 3×3 filters (Gaussian 5×5,
σ = 1). The Filter Comparison lab and Experiments 3–6 and 10 reproduce these tables.

**Table 1 – Salt & pepper noise (density 0.05)**

| Filter | Type | PSNR (dB) | SSIM | Observation |
|---|---|---|---|---|
| Noisy image | — | 17.77 | 0.310 | many black/white dots |
| Mean | linear | 26.33 | 0.593 | dots smeared into grey blobs |
| Gaussian | linear | 27.22 | 0.651 | softer blur, dots still visible |
| **Median** | non-linear | **37.81** | **0.961** | dots removed, edges sharp |
| Min | non-linear | 14.67 | 0.319 | removes salt, enlarges pepper |
| Max | non-linear | 9.75 | 0.189 | removes pepper, enlarges salt |
| Midpoint | non-linear | 15.28 | 0.183 | the extremes *are* the noise → fails |

**Table 2 – Gaussian noise (variance 0.01)**

| Filter | PSNR (dB) | SSIM |
|---|---|---|
| Noisy image | 20.48 | 0.228 |
| Mean | 28.65 | 0.643 |
| **Gaussian** | **29.39** | **0.705** |
| Median | 27.37 | 0.558 |
| Midpoint | 25.85 | 0.537 |
| Min / Max | 16.40 / 15.71 | 0.292 / 0.368 |

**Other results**
* Manual and toolbox implementations differ by 0 (identical results). On a 512×384 grayscale image
  the loop versions took 585 ms (mean) and 846 ms (median) versus 6.5 ms and 35 ms for the
  vectorised versions.
* Histogram equalisation of the low-contrast image raised the standard deviation from 11.6 to 70.1 grey levels.
* Canny produced thin, connected edges. Roberts responded most strongly to noise.
* Adaptive thresholding segmented objects under uneven lighting where Otsu's global threshold failed.
* Equalising R, G and B separately shifted the hues; equalising only V kept the colours natural.

## 8. Applications

* Medical imaging: denoising X-ray, CT and ultrasound (speckle) images; contrast enhancement.
* Photography and smartphones: noise reduction, sharpening, local contrast (CLAHE-like) enhancement.
* Remote sensing: contrast stretching of satellite images; edge-based feature extraction.
* Industrial inspection: thresholding and edge detection to find defects.
* Document processing: binarisation with adaptive thresholds.
* Education: an interactive way to teach spatial filtering.

## 9. Future Scope

* Frequency-domain filtering (deliberately excluded here) for comparison with spatial methods.
* Adaptive and edge-preserving filters: adaptive median, bilateral, non-local means.
* Restoration of blur: Wiener and constrained least-squares filtering.
* Morphological processing and advanced segmentation (watershed, active contours).
* Real-time camera input and multi-user (networked) classroom quizzes.
* Deep-learning denoisers compared with classical filters.

## 10. Conclusion

ImageLab shows that spatial-domain filters are simple yet effective enhancement tools when the filter
matches the degradation. Linear averaging filters (mean, Gaussian) reduce zero-mean Gaussian noise but
blur edges. The non-linear median filter removes impulse noise while preserving edges. Derivative-based
filters (Laplacian, Sobel, unsharp masking) sharpen detail but amplify noise, and histogram processing
improves contrast automatically. Implementing each algorithm both with the MATLAB toolbox and manually,
and verifying that the results are identical, demonstrates an understanding of how each operation works
rather than just how to call it. The interactive labs, experiments and quizzes make the concepts easy to
demonstrate and learn.

## 11. References

1. R. C. Gonzalez and R. E. Woods, *Digital Image Processing*, 4th ed., Pearson, 2018.
2. R. C. Gonzalez, R. E. Woods and S. L. Eddins, *Digital Image Processing Using MATLAB*, 3rd ed., Gatesmark, 2020.
3. A. K. Jain, *Fundamentals of Digital Image Processing*, Prentice Hall, 1989.
4. J. Canny, "A Computational Approach to Edge Detection," *IEEE Trans. PAMI*, vol. 8, no. 6, pp. 679–698, 1986.
5. N. Otsu, "A Threshold Selection Method from Gray-Level Histograms," *IEEE Trans. SMC*, vol. 9, no. 1, pp. 62–66, 1979.
6. K. Zuiderveld, "Contrast Limited Adaptive Histogram Equalization," in *Graphics Gems IV*, Academic Press, 1994.
7. Z. Wang, A. C. Bovik, H. R. Sheikh and E. P. Simoncelli, "Image Quality Assessment: From Error Visibility to Structural Similarity," *IEEE Trans. Image Processing*, vol. 13, no. 4, pp. 600–612, 2004.
8. D. Marr and E. Hildreth, "Theory of Edge Detection," *Proc. Royal Society of London B*, vol. 207, pp. 187–217, 1980.
9. MathWorks, *Image Processing Toolbox User's Guide* and *MATLAB Documentation*.
