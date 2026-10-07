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

## noise/
`addGaussianNoise(I,mean,var)`, `addSaltPepperNoise(I,density)`, `addSpeckleNoise(I,var)`,
`addPoissonNoise(I)`, `addNoise(I,type,params)`.

## histogram/
`imhistManual(I)`, `[J,map] = histogramEqualizationManual(G)`, `histogramEqualization(I)`,
`claheManual(G,tiles,clip)`, `clahe(I,tiles,clip)`, `[J,limits] = contrastStretch(I,low,high)`,
`gammaCorrection(I,gamma,c)`, `logTransform(I,k)`, `negativeTransform(I)`, `imageStatistics(I)`.

## metrics/
`calculateMSE(A,ref)`, `calculatePSNR(A,ref)`, `calculateSSIM(A,ref)`, `imageQuality(A,ref)`.

## segmentation/
`globalThreshold(I,T)`, `[BW,T,it] = iterativeThreshold(I)`, `[BW,level,eff] = otsuThreshold(I)`,
`[BW,localMean] = adaptiveThreshold(I,win,offset)`, `[BW,R] = pointDetection(I,T)`,
`[BW,R,K] = lineDetection(I,direction,T)`, `[BW,mean] = regionGrowing(I,r,c,tol,conn)`,
`[L,meanImage,n] = splitAndMerge(I,stdT,minBlock,mergeT)`, `[L,n] = labelComponents(BW,conn)`,
`regionProperties(L)`, `extractBoundary(BW)`.

## color/
`rgbToYCbCr`, `yCbCrToRgb`, `rgbToLab`, `labToRgb`, `[channels,names,converted] = colorChannels(I,space)`,
`colorEnhance(I,space,channel,operation,amount)`.

## fundamentals/
`[J,levels] = quantizeImage(I,bits)`, `[display,small] = sampleImage(I,factor)`,
`pixelDistances(p,q)`, `pixelNeighborhood(V,r,c,valueSet)`.

## quizzes/
`questionBank()`, `quizEngine(action,…)`, `leaderboardManager(action,entry)`,
`progressManager(action,…)`, `pipelineProblems()`, `applyBlock(I,block,params)`, `degradeImage(I,steps)`.

## experiments/ and reports/
`experimentCatalog()`, `runExperiment(n,I)`, `generateReport(R)`.

## api/
`ilab_dispatch(json)` (single UI entry point), `ilab_store(action,…)`, `ilab_runFilter(I,name,k,params,impl)`,
`ilab_mat(M)`, `ilab_barChart(values,labels,title,ylabel)`, `ilab_figure`, `ilab_saveFigure`,
`sampleImages(action,name)`, `generateSampleImages(force)`.

## Root
`ImageLab` (start), `ilab_setup` (paths), `run_tests` (unit tests), `ImageLab_Demonstration` (Live Script).
