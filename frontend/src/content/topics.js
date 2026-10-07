// Theory notes for the Learn module. Each topic links to the lab where it can be tried in MATLAB.

export const TOPICS = [
  // ---------------------------------------------------------------- Unit I
  {
    id: 'digital-image', unit: 'Unit I', title: 'Digital Image Fundamentals', lab: 'workspace', category: 'Fundamentals',
    summary: 'What a digital image is and how it is stored in MATLAB.',
    body: [
      'An image is a two-dimensional function f(x, y) whose value at (x, y) is the intensity (grey level). When x, y and the intensity are all finite and discrete, it is a DIGITAL image — a matrix of numbers called pixels.',
      'In MATLAB a grayscale image is an M×N matrix (uint8: 0–255, or double: 0–1) and a colour image is an M×N×3 array (R, G, B planes). imread reads a file into such a matrix; imshow displays it.',
      'The fundamental steps of image processing are: acquisition → enhancement → restoration → colour processing → segmentation → representation & description → recognition.',
    ],
    formula: 'f(x, y),  x = 0..M−1,  y = 0..N−1,   values 0..L−1 with L = 2^k',
  },
  {
    id: 'perception', unit: 'Unit I', title: 'Visual Perception, Brightness Adaptation & Discrimination', lab: 'histogram', category: 'Fundamentals',
    summary: 'How the human eye perceives brightness — and why enhancement is subjective.',
    body: [
      'The retina contains cones (6–7 million, colour, bright light, concentrated in the fovea) and rods (75–150 million, low light, no colour).',
      'Brightness adaptation: the eye covers an enormous range of light intensities (about 10^10) but not at once — it adapts to the current level and then only distinguishes a much smaller range around it.',
      'Brightness discrimination is measured by the Weber ratio ΔI/I: the just-noticeable change in intensity relative to the background. A small Weber ratio means good discrimination.',
      'Perceived brightness is not a simple function of intensity: Mach bands (overshoot at edges) and simultaneous contrast (a grey square looks darker on a bright background) show the visual system emphasises edges and relative contrast.',
    ],
    formula: 'Weber ratio = ΔI_c / I',
  },
  {
    id: 'spectrum', unit: 'Unit I', title: 'Light and the Electromagnetic Spectrum', lab: 'color', category: 'Fundamentals',
    summary: 'Visible light, wavelengths and imaging modalities.',
    body: [
      'Light is electromagnetic radiation. The spectrum ranges from gamma rays and X-rays (short wavelength, high energy) through ultraviolet, visible light (≈ 400–700 nm: violet → red), infrared and microwaves to radio waves.',
      'Images can be formed in every band: gamma (nuclear medicine), X-ray (CT), UV (fluorescence microscopy), visible, IR (thermal imaging), microwave (radar), radio (MRI, astronomy).',
      'Achromatic (monochrome) light is described only by its intensity; chromatic light by radiance, luminance and brightness.',
    ],
    formula: 'λ = c / ν,     E = h·ν',
  },
  {
    id: 'sampling', unit: 'Unit I', title: 'Image Sensing, Sampling and Quantisation', lab: 'fundamentals', category: 'Fundamentals',
    summary: 'Digitisation = sampling the coordinates + quantising the amplitude.',
    body: [
      'Sensors (single sensor, line/strip sensors, 2-D arrays such as CCD/CMOS) convert light into a continuous voltage signal.',
      'SAMPLING digitises the coordinates: it decides the number of pixels (spatial resolution). Too few samples cause pixelation / checkerboard patterns and aliasing.',
      'QUANTISATION digitises the amplitude: it decides the number of grey levels L = 2^k (intensity resolution). Too few levels cause false contouring in smooth regions.',
      'Storage: an M×N image with k bits per pixel needs b = M·N·k bits.',
    ],
    formula: 'b = M × N × k bits,     L = 2^k grey levels',
  },
  {
    id: 'pixels', unit: 'Unit I', title: 'Basic Relationships Between Pixels', lab: 'fundamentals', category: 'Fundamentals',
    summary: 'Neighbours, adjacency, connectivity, regions and distance measures.',
    body: [
      'N4(p): the four horizontal/vertical neighbours of p = (x, y): (x±1, y), (x, y±1). ND(p): the four diagonal neighbours. N8(p) = N4(p) ∪ ND(p).',
      'Adjacency for a set of values V: 4-adjacent if q ∈ N4(p); 8-adjacent if q ∈ N8(p); m-adjacent if q ∈ N4(p), or q ∈ ND(p) and N4(p) ∩ N4(q) has no pixels from V. m-adjacency removes the ambiguous multiple paths of 8-adjacency.',
      'A path connects pixels through a sequence of adjacent pixels; connected pixels form connected components (regions); the boundary of a region is the set of its pixels that have background neighbours.',
      'Distances: Euclidean De, city-block D4 (diamond-shaped neighbourhoods), chessboard D8 (square neighbourhoods).',
    ],
    formula: 'De = √((x−s)² + (y−t)²)    D4 = |x−s| + |y−t|    D8 = max(|x−s|, |y−t|)',
  },
  {
    id: 'matlab', unit: 'Unit I', title: 'MATLAB: Vectors, Matrices, Functions & Plotting', lab: 'docs', category: 'Fundamentals',
    summary: 'The MATLAB essentials used throughout ImageLab.',
    body: [
      'Vectors and matrices: v = [1 2 3]; A = [1 2; 3 4]; A(2,1) indexes row 2, column 1; A(:) turns a matrix into a column vector; A(1:2:end, :) takes every second row (used for sampling).',
      'Element-wise operators .* ./ .^ work pixel by pixel (e.g. window .* kernel in correlation); * is matrix multiplication.',
      'Functions are written in .m files: function J = meanFilter(I, k) ... end. Every algorithm in ImageLab is such a function (folder algorithms/).',
      'Graph plotting: plot(x, y), bar(values) (used in the filter comparison), imhist / histogram, subplot and imshow for image montages.',
      'Vectorisation (whole-matrix operations) is much faster than loops; ImageLab shows both: the loop version to explain the algorithm, the vectorised/toolbox version for speed.',
    ],
    formula: "J = sum(window(:) .* K(:));      bar([psnr1 psnr2 psnr3])",
  },
  // ---------------------------------------------------------------- Unit II
  {
    id: 'enhancement', unit: 'Unit II', title: 'What is Image Enhancement?', lab: 'histogram', category: 'Spatial Filters',
    summary: 'Processing an image so the result is more suitable for a specific application.',
    body: [
      'Image enhancement manipulates an image so that it is more suitable than the original for a specific purpose — for a human viewer or for further automatic processing. It is problem-oriented and largely subjective: there is no universal "best" enhancement.',
      'Enhancement methods work either in the SPATIAL domain (directly on pixels — this project) or in the frequency domain (on the Fourier transform — not covered here).',
      'Typical goals: increase contrast (histogram processing), remove noise (smoothing filters), highlight detail and edges (sharpening filters).',
    ],
    formula: 'g(x, y) = T[ f(x, y) ]',
  },
  {
    id: 'spatial', unit: 'Unit II', title: 'What is Spatial Domain Processing?', lab: 'kernel', category: 'Spatial Filters',
    summary: 'Point operations and neighbourhood (mask) operations on pixels.',
    body: [
      'Spatial domain = the image plane itself. The general form is g(x, y) = T[f(x, y)], where T is an operator defined over a neighbourhood of (x, y).',
      'If the neighbourhood is a single pixel (1×1), T is an intensity / point transformation s = T(r): negatives, log, gamma, contrast stretching, histogram equalisation.',
      'If the neighbourhood is larger (3×3, 5×5 …), T is a spatial FILTER (mask, kernel, template, window). The kernel slides over every pixel and computes a new value from the neighbourhood.',
      'Borders need padding (zero, replicate, symmetric) because the kernel extends outside the image there.',
    ],
    formula: 'g(x, y) = Σ_{s=−a..a} Σ_{t=−b..b} w(s, t) · f(x+s, y+t)',
  },
  {
    id: 'histogram', unit: 'Unit II', title: 'Histogram Processing', lab: 'histogram', category: 'Histogram',
    summary: 'Histograms, equalisation, CLAHE and contrast stretching.',
    body: [
      'The histogram h(r_k) = n_k counts the pixels with grey level r_k; p(r_k) = n_k / MN is the normalised histogram (an estimate of the probability of each level). Dark, bright, low-contrast and high-contrast images have characteristic histograms.',
      'Histogram EQUALISATION maps r_k → s_k = (L−1) Σ_{j≤k} p(r_j): the scaled cumulative distribution function. It spreads the grey levels over the whole range, increasing contrast automatically (histeq).',
      'Histogram MATCHING (specification) maps the image to a desired histogram shape instead of a flat one.',
      'Local / adaptive equalisation works on small neighbourhoods; CLAHE adds a clip limit so noise in flat regions is not over-amplified (adapthisteq).',
      'Histogram statistics: the mean measures average brightness, the variance/standard deviation measures contrast, the entropy the information content.',
    ],
    formula: 's_k = (L − 1) · Σ_{j=0..k} n_j / MN',
  },
  {
    id: 'correlation', unit: 'Unit II', title: 'What is Correlation?', lab: 'correlation', category: 'Correlation',
    summary: 'Sliding a kernel over the image and summing the products — without flipping.',
    body: [
      'Correlation moves the kernel w over the image f. At each position the overlapping values are multiplied element by element and the products are summed; the sum becomes the output pixel at the kernel centre.',
      'The kernel is used AS IT IS (not flipped). imfilter and filter2 perform correlation by default.',
      'Correlating an image with a unit impulse yields a 180°-rotated copy of the kernel.',
      'Correlation is also used for TEMPLATE MATCHING: the output is largest where the image region looks most like the kernel. (corr2 is different: it returns one correlation coefficient between two images.)',
    ],
    formula: '(w ☆ f)(x, y) = Σ_s Σ_t w(s, t) · f(x + s, y + t)',
  },
  {
    id: 'convolution', unit: 'Unit II', title: 'What is Convolution? (vs Correlation)', lab: 'correlation', category: 'Convolution',
    summary: 'Correlation with the kernel rotated by 180°.',
    body: [
      'Convolution is identical to correlation except that the kernel is first rotated by 180° (flipped horizontally AND vertically): rot90(w, 2).',
      'Difference: correlation = no flipping; convolution = flipping. For symmetric kernels (mean, Gaussian, Laplacian) the results are identical; for asymmetric kernels (Sobel, Prewitt) the result changes sign/direction.',
      'Convolving an image with a unit impulse reproduces the kernel itself — that is why the kernel of a linear system is called its impulse response.',
      'Convolution is commutative and associative, so several linear filters can be combined into a single kernel. conv2 performs 2-D convolution; full output size is (M+m−1)×(N+n−1).',
    ],
    formula: '(w ★ f)(x, y) = Σ_s Σ_t w(s, t) · f(x − s, y − t)',
  },
  {
    id: 'linear', unit: 'Unit II', title: 'Linear Filters & Smoothing', lab: 'filters', category: 'Linear Filters',
    summary: 'Filters whose output is a weighted sum of the neighbourhood.',
    body: [
      'A LINEAR filter computes a weighted sum (sum of products) of the neighbourhood; it obeys superposition: T[a·f + b·g] = a·T[f] + b·T[g]. Every linear spatial filter is a correlation/convolution with a kernel.',
      'SMOOTHING (low-pass) filters reduce noise and small detail by averaging: the box/mean filter (all weights 1/k²), the weighted mean (e.g. [1 2 1; 2 4 2; 1 2 1]/16) and the Gaussian (weights exp(−r²/2σ²)).',
      'Smoothing removes zero-mean random noise because the noise values average out, but it also blurs edges. Larger kernels / larger σ blur more.',
      'Smoothing kernels have weights summing to 1 so the average brightness is preserved.',
    ],
    formula: 'Mean: g = (1/k²) Σ f      Gaussian: w(s,t) ∝ exp(−(s² + t²) / 2σ²)',
  },
  {
    id: 'nonlinear', unit: 'Unit II', title: 'Non-Linear & Order-Statistic Filters', lab: 'filters', category: 'Non-Linear Filters',
    summary: 'Filters based on ranking (sorting) the neighbourhood.',
    body: [
      'A NON-LINEAR filter cannot be written as a weighted sum. Order-statistic filters SORT the neighbourhood values and pick one of them by rank.',
      'Median (rank ⌈N/2⌉), minimum (rank 1), maximum (rank N), midpoint ((min+max)/2), alpha-trimmed mean. In MATLAB: medfilt2 and ordfilt2.',
      'WHY THE MEDIAN REMOVES SALT & PEPPER NOISE: impulses are extreme values (0 or 255). After sorting they are at the ends of the list, so the middle value is (almost always) a genuine neighbourhood value — the impulse is discarded instead of being averaged into its neighbours. Because the output is always an existing value, edges stay sharp.',
      'Min filter removes salt (white) noise; max filter removes pepper (black) noise.',
    ],
    formula: 'median: sort(window(:)) → element ⌈N/2⌉',
  },
  {
    id: 'sharpening', unit: 'Unit II', title: 'What is Sharpening?', lab: 'sharpening', category: 'Sharpening',
    summary: 'Highlighting intensity transitions with derivatives.',
    body: [
      'Sharpening highlights fine detail and edges. Since averaging (integration) blurs, sharpening uses DERIVATIVES (differentiation).',
      'Second derivative — the Laplacian ∇²f = ∂²f/∂x² + ∂²f/∂y² ≈ [0 1 0; 1 −4 1; 0 1 0]. It is zero in flat areas and strong at edges and points. Sharpened image: g = f − ∇²f (when the kernel centre is negative).',
      'First derivative — the gradient magnitude |∇f| = √(gx² + gy²) using Sobel or Prewitt kernels; used for edge enhancement and detection.',
      'Unsharp masking: mask = f − blur(f), g = f + k·mask. k > 1 is high-boost filtering.',
      'Sharpening amplifies noise too — smooth first if the image is noisy.',
    ],
    formula: 'g(x, y) = f(x, y) − ∇²f(x, y)       g = f + k (f − f_blur)',
  },
  // ---------------------------------------------------------------- Unit III
  {
    id: 'degradation', unit: 'Unit III', title: 'Image Degradation & Noise Models', lab: 'noise', category: 'Noise',
    summary: 'The degradation/restoration model and the common noise types.',
    body: [
      'Degradation model: g(x, y) = h(x, y) ★ f(x, y) + η(x, y). h is the degradation function (e.g. blur), η is additive noise. If h is linear and position-invariant (LPI), the degradation is a convolution.',
      'Noise models: Gaussian (sensor/electronic noise), Rayleigh, Erlang (gamma), exponential, uniform, impulse / salt-and-pepper (faulty switching, transmission), speckle (multiplicative — ultrasound, radar), Poisson (photon counting, variance = mean).',
      'The noise parameters can be estimated from the histogram of a flat region of the image.',
    ],
    formula: 'g(x, y) = h(x, y) ★ f(x, y) + η(x, y)',
  },
  {
    id: 'restoration', unit: 'Unit III', title: 'Restoration in the Presence of Noise', lab: 'compare', category: 'Noise',
    summary: 'Recovering the original image using knowledge of the degradation.',
    body: [
      'Image RESTORATION tries to recover the original image using a model of the degradation — it is objective (measured with MSE / PSNR / SSIM), whereas enhancement is subjective.',
      'When noise is the only degradation (h = identity), restoration is done with spatial filters matched to the noise: arithmetic/geometric mean or Gaussian for Gaussian noise; median for impulse noise; max/min for pepper/salt; midpoint for uniform/Gaussian noise; alpha-trimmed mean for mixed noise; adaptive filters adjust to local statistics.',
      'Quality measures: MSE = mean squared error; PSNR = 10 log10(MAX²/MSE) dB; SSIM compares luminance, contrast and structure (1 = identical).',
    ],
    formula: 'PSNR = 10 · log10(MAX² / MSE)',
  },
  {
    id: 'colour', unit: 'Unit III', title: 'Colour Fundamentals, Models & Enhancement', lab: 'color', category: 'Color Processing',
    summary: 'RGB, CMY, HSV/HSI, YCbCr, Lab and colour transformations.',
    body: [
      'Colour is described by hue (dominant wavelength), saturation (purity) and brightness. The eye has three types of cones (≈ red, green, blue) — hence trichromatic colour models.',
      'RGB: additive, used by displays. CMY(K): subtractive, used in printing (C = 1 − R …). HSV/HSI: separates colour (hue, saturation) from intensity — intuitive for humans. YCbCr: luma + chroma, used in JPEG/video. CIE L*a*b*: perceptually uniform.',
      'Colour transformation: process each channel or the intensity component. For enhancement, equalise the intensity (V, Y or L) only — equalising R, G and B separately changes their ratios and shifts the hues. Saturation scaling makes colours more or less vivid.',
    ],
    formula: 'Y = 0.299R + 0.587G + 0.114B      V = max(R, G, B)',
  },
  // ---------------------------------------------------------------- Unit IV
  {
    id: 'edges', unit: 'Unit IV', title: 'What are Edges? Point, Line & Edge Detection', lab: 'edges', category: 'Edge Detection',
    summary: 'Detecting discontinuities with derivative masks.',
    body: [
      'An EDGE is a set of connected pixels where the intensity changes abruptly — the boundary between regions. Models: step, ramp and roof edges.',
      'Point detection: Laplacian-type mask [−1 −1 −1; −1 8 −1; −1 −1 −1], threshold |R| ≥ T. Line detection: directional masks for horizontal, vertical and ±45° lines.',
      'Edge detection with the gradient: Roberts (2×2), Prewitt and Sobel (3×3); magnitude √(gx² + gy²) and direction atan(gy/gx). Second-derivative methods: LoG (Marr-Hildreth) finds zero crossings.',
      'Canny: Gaussian smoothing → gradient → non-maximum suppression (thin edges) → double threshold and hysteresis (edge linking). It gives the best edges in practice.',
      'Edge linking & boundary detection connect edge pixels into meaningful boundaries (local processing by similarity of magnitude/direction, or global methods such as the Hough transform).',
    ],
    formula: '|∇f| = √(gx² + gy²),   α = atan(gy / gx)',
  },
  {
    id: 'threshold', unit: 'Unit IV', title: 'What is Thresholding?', lab: 'segmentation', category: 'Segmentation',
    summary: 'Separating objects from background by intensity.',
    body: [
      'Thresholding produces a binary image: g(x, y) = 1 if f(x, y) > T, else 0. It works when objects and background have distinct intensity ranges (bimodal histogram).',
      'Basic global thresholding: iterate T = (m1 + m2)/2 until it converges. Otsu\'s method chooses T that maximises the between-class variance σ²_B — optimal for two classes (graythresh).',
      'Variable / adaptive thresholding uses a different T for each pixel (e.g. the local mean) to handle uneven illumination.',
    ],
    formula: 'σ²_B(k) = [m_G·P1(k) − m(k)]² / (P1(k)·[1 − P1(k)])',
  },
  {
    id: 'regions', unit: 'Unit IV', title: 'Region-Based Segmentation, Representation & Description', lab: 'segmentation', category: 'Segmentation',
    summary: 'Region growing, splitting & merging, labelling and region descriptors.',
    body: [
      'Region growing starts from seed points and appends neighbouring pixels that satisfy a similarity predicate (e.g. |f − seed| ≤ T).',
      'Region splitting and merging: split any region that is not homogeneous into four quadrants (quadtree) and merge adjacent regions that are similar.',
      'Connected-component labelling (bwlabel) gives each region a number; regionprops measures descriptors.',
      'Representation: boundary (chain codes, polygonal approximation, signatures) or region (skeleton). Description: area, perimeter, compactness, centroid, bounding box, eccentricity, texture and moments.',
    ],
    formula: 'compactness = perimeter² / area',
  },
]

export const UNITS = ['Unit I', 'Unit II', 'Unit III', 'Unit IV']
