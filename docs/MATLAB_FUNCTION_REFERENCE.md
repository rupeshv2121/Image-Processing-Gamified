# ImageLab — MATLAB Function Reference

All functions accept `uint8`, `uint16`, `logical` or `double` images (grayscale or RGB) and return
`double` images in [0, 1] unless stated otherwise. Run `ilab_setup` first to add the folders to the
path. `help <function>` shows the full description.

## core/
| Function | Description |
|---|---|
| `tf = hasIPT()` | True if the Image Processing Toolbox is installed (`ILAB_FORCE_MANUAL=1` disables it) |
| `D = toDouble(I)` | im2double equivalent |
| `G = toGray(I)` | rgb2gray equivalent (BT.601 weights) |
| `U = toUint8(I)` | double → uint8 with clipping |
| `J = scaleToUnit(I)` | rescale min..max to 0..1 for display |
| `P = padImage(I, pr, pc, mode)` | padarray equivalent: zero / replicate / symmetric |
| `S = neighborhoodStack(I, kh, kw, mode)` | all neighbourhoods as an h×w×(kh·kw) array |
| `J = applyPerChannel(fn, I)` | apply a 2-D operation to every channel |
| `J = applyToLuminance(fn, I)` | apply an operation to the V channel of HSV |
| `J = filter2D(I, K, padMode)` | fast correlation (imfilter or conv2) |
| `J = manualFilterLoop(I, K, padMode)` | correlation with explicit loops |
| `J = resizeImage(I, rows, cols)` | bilinear resize |
| `validateKernel(K)`, `validateKernelSize(k)` | input checks with `ImageLab:invalidKernel*` errors |

## algorithms/
| Function | Description |
|---|---|
| `meanFilter(I,k)` / `meanFilterManual(I,k)` | box filter, toolbox / loops |
| `weightedMeanKernel(k)`, `weightedMeanFilter(I,k)` | binomial weighted average |
| `gaussianKernel(k,sigma)` | manual Gaussian kernel (= fspecial('gaussian')) |
| `gaussianFilter(I,k,sigma)` / `gaussianFilterManual` | Gaussian smoothing |
| `medianFilter(I,k)` / `medianFilterManual(I,k)` | median, medfilt2 / loops + sort |
| `orderStatisticFilter(I,k,rank)` / `orderStatisticFilterManual` | rank filter, ordfilt2 / loops |
| `minFilter`, `maxFilter`, `midpointFilter`, `alphaTrimmedMeanFilter(I,k,d)` | order statistics |
| `[out,steps] = manualCorrelation(I,K,shape,padMode)` | correlation with steps |
| `[out,steps,Kf] = manualConvolution(I,K,shape,padMode)` | convolution (flipped kernel) |
| `[K,desc] = kernelPresets(name,k)` | mean, weighted, gaussian, sobelx/y, prewittx/y, laplacian(8), sharpen, emboss, identity, pointdetect |
| `laplacianKernel(alpha)` | = fspecial('laplacian', alpha) |
| `[G,L,K] = laplacianSharpen(I,alpha,strength,useEight)` | Laplacian sharpening |
| `[G,mask] = unsharpMask(I,sigma,amount)` | unsharp masking |
| `[G,mask] = highBoostFilter(I,boost,k)` | high-boost |
| `[G,mag] = gradientSharpen(I,operator,weight)` | Sobel / Prewitt sharpening |
| `[mag,gx,gy] = sobelManual(I)`, `prewittManual`, `robertsManual` | gradient operators |
| `gradientOperatorManual(I,Kx,Ky)` | generic loop gradient |
| `logKernel(k,sigma)`, `logEdgeManual(I,sigma,thresh)` | LoG |
| `[BW,thr,mag] = cannyManual(I,sigma,low,high)` | Canny |
| `[BW,thr,mag,impl] = edgeDetect(I,method,thresh,sigma)` | edge() with fallback |
| `[J,windowUsed] = adaptiveMedianFilter(I,Smax)` | adaptive median (stages A/B, window grows to Smax) |
| `[J,noiseVar] = adaptiveLocalFilter(I,k,noiseVar)` | adaptive local noise reduction, like wiener2 |
| `geometricMeanFilter(I,k)`, `harmonicMeanFilter(I,k)`, `contraharmonicMeanFilter(I,k,Q)` | mean filters for restoration |

## noise/
`addGaussianNoise(I,mean,var)`, `addSaltPepperNoise(I,density)`, `addRayleighNoise(I,a,b)`,
`addErlangNoise(I,a,b)`, `addExponentialNoise(I,a)`, `addUniformNoise(I,a,b)`, `addNoise(I,type,params)`.

## restoration/
`h = blurPSF(type,…)` (motion, gaussian, disk, box), `blurImage(f,h)`, `[g,blurred] = degradeLPI(f,h,noiseVar)`,
`[f,history] = deconvolveImage(g,h,method,lambda,iterations,ref)` (inverse, wiener, cls, lucy — spatial domain).

## histogram/
`imhistManual(I)`, `[J,map] = histogramEqualizationManual(G)`, `histogramEqualization(I)`,
`[J,map] = histogramMatching(I,target)`, `targetHistogram(shape,m,s)`, `[J,limits] = contrastStretch(I,low,high)`,
`piecewiseLinear(I,r1,s1,r2,s2)`, `grayLevelSlicing(I,a,b,mode,level)`, `[planes,R] = bitPlaneSlicing(I,keep)`,
`gammaCorrection(I,gamma,c)`, `logTransform(I,k)`, `negativeTransform(I)`, `imageStatistics(I)`.
`clahe` / `claheManual` remain only for the Pipeline game.

## metrics/
`calculateMSE(A,ref)`, `calculatePSNR(A,ref)`, `imageQuality(A,ref)` (`calculateSSIM` is used only for game scores),
`[H,E,stats] = errorMap(A,ref)` (|A − ref| as a turbo heat map with statistics).

## segmentation/
`globalThreshold(I,T)`, `[BW,T,it] = iterativeThreshold(I)`, `[BW,level,eff] = otsuThreshold(I)`,
`[BW,localMean] = adaptiveThreshold(I,win,offset)`, `[BW,R] = pointDetection(I,T)`,
`[BW,R,K] = lineDetection(I,direction,T)`, `[BW,mean] = regionGrowing(I,r,c,tol,conn)`,
`[L,meanImage,n] = splitAndMerge(I,stdT,minBlock,mergeT)`, `regionProperties(L)`, `extractBoundary(BW)`,
`[H,theta,rho] = houghTransform(BW)`, `houghPeaks(H,n,T)`, `houghLines(BW,theta,rho,peaks,fillGap,minLength)`,
`[linked,candidates,M] = localEdgeLinking(I,TM,TA,K)`,
`[code,boundary,start] = chainCode(BW)` (Freeman 8-direction, Moore tracing), `chainCodeDescriptors(code)`
(first difference, shape number, perimeter), `boundarySignature(boundary,centroid)`, `polygonApprox(boundary,tol)`,
`[a,rebuilt,invariant] = fourierDescriptors(boundary,P)`, `[S,K] = morphSkeleton(A,B)`, `regionMoments(BW)`,
`textureDescriptors(G,mask)`. `labelComponents` is an internal helper that finds the separate regions.

## steps/
`medianSteps(A,k)`, `histeqSteps(A,L)`, `regionGrowingSteps(A,r,c,tol,conn)` —
every intermediate step on a small matrix (≤ 12×12) for the animations; each checks itself against the real implementation.

## color/
`rgbToHsi`, `hsiToRgb`, `[CMYK,CMY] = rgbToCmyk(I)`, `[channels,names,converted] = colorChannels(I,space)`
(rgb, hsv, hsi, cmy, cmyk, gray), `colorEnhance(I,space,channel,operation,amount)`,
`[J,colors,edges] = intensitySlicing(I,n,map)`, `[J,curves] = grayToColor(I,frequency,phases)`.

## fundamentals/
`[J,levels] = quantizeImage(I,bits)`, `[display,small] = sampleImage(I,factor)`,
`pixelDistances(p,q)`, `pixelNeighborhood(V,r,c,valueSet)`, `perceptionDemo(kind,…)` (machbands,
simultaneous, weber), `wavelengthToRGB(lambda)`.

## games/
`applyBlock(I,block,params)`, `degradeImage(I,steps)` — the image work of the pipeline, daily and
challenge games. Quizzes, progress, profiles, the leaderboard and the classroom are not MATLAB code;
they live in the Python backend (`backend/imagelab/services/`).

## experiments/ and reports/
`experimentCatalog()`, `runExperiment(n,I)`, `generateReport(R)`, `generateReportPdf(R,file)`.

## api/
`ilab_dispatch(json)` (single UI entry point), `ilab_store(action,…)`, `ilab_runFilter(I,name,k,params,impl)`,
`ilab_mat(M)`, `ilab_barChart(values,labels,title,ylabel)`, `ilab_figure`, `ilab_saveFigure`,
`sampleImages(action,name)`, `generateSampleImages(force)`.

## Root
`ImageLab` (start), `ilab_setup` (paths), `run_tests` (unit tests), `ImageLab_Demonstration` (Live Script).
