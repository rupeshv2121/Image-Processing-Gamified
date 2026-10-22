classdef ImageLabTests < matlab.unittest.TestCase
    %IMAGELABTESTS Unit tests for the ImageLab image-processing functions.
    %   Run with:  results = runtests('tests/ImageLabTests.m')
    %   or         run_tests   (from the project root)
    %
    %   Every manual (loop-based) implementation is checked against the fast /
    %   toolbox version or against a built-in MATLAB function.

    properties
        Img      % 40x50 grayscale test image
        ImgRGB   % 30x40 colour test image
    end

    methods (TestClassSetup)
        function addPaths(~)
            addpath(fileparts(fileparts(mfilename('fullpath'))));
            ilab_setup();
        end
    end

    methods (TestMethodSetup)
        function makeImages(tc)
            rng(42);
            [x, y] = meshgrid(linspace(0, 1, 50), linspace(0, 1, 40));
            tc.Img = 0.5 * x + 0.3 * y + 0.1 * rand(40, 50);
            tc.Img(10:20, 15:30) = 0.9;                    % bright square
            tc.ImgRGB = rand(30, 40, 3);
        end
    end

    methods (Test)
        % ---------------------------------------------------------- linear
        function meanFilterMatchesManual(tc)
            tc.verifyEqual(meanFilterManual(tc.Img, 3), meanFilter(tc.Img, 3), 'AbsTol', 1e-12);
            tc.verifyEqual(meanFilterManual(tc.ImgRGB, 5), meanFilter(tc.ImgRGB, 5), 'AbsTol', 1e-12);
        end

        function meanFilterOfConstantIsConstant(tc)
            tc.verifyEqual(meanFilter(0.3 * ones(20), 7), 0.3 * ones(20), 'AbsTol', 1e-12);
        end

        function gaussianKernelProperties(tc)
            G = gaussianKernel(7, 1.5);
            tc.verifyEqual(sum(G(:)), 1, 'AbsTol', 1e-12);
            tc.verifyEqual(G, rot90(G), 'AbsTol', 1e-15);   % rotationally symmetric
            [~, idx] = max(G(:));
            tc.verifyEqual(idx, 25);                        % peak at the centre
        end

        function gaussianFilterMatchesManual(tc)
            tc.verifyEqual(gaussianFilterManual(tc.Img, 5, 1), gaussianFilter(tc.Img, 5, 1), 'AbsTol', 1e-12);
        end

        function weightedKernelIsBinomial(tc)
            tc.verifyEqual(weightedMeanKernel(3), [1 2 1; 2 4 2; 1 2 1] / 16, 'AbsTol', 1e-15);
        end

        % ------------------------------------------------------ non-linear
        function medianFilterMatchesManual(tc)
            tc.verifyEqual(medianFilterManual(tc.Img, 3), medianFilter(tc.Img, 3), 'AbsTol', 1e-12);
            tc.verifyEqual(medianFilterManual(tc.ImgRGB, 5), medianFilter(tc.ImgRGB, 5), 'AbsTol', 1e-12);
        end

        function medianRemovesSingleImpulse(tc)
            I = 0.5 * ones(9);
            I(5, 5) = 1;                                    % one "salt" pixel
            tc.verifyEqual(medianFilter(I, 3), 0.5 * ones(9), 'AbsTol', 1e-12);
            tc.verifyGreaterThan(max(max(meanFilter(I, 3))), 0.5);   % mean only spreads it
        end

        function minMaxFilters(tc)
            I = magic(5) / 25;
            tc.verifyEqual(minFilter(I, 3), orderStatisticFilterManual(I, 3, 1), 'AbsTol', 1e-12);
            tc.verifyEqual(maxFilter(I, 3), orderStatisticFilterManual(I, 3, 9), 'AbsTol', 1e-12);
            tc.verifyTrue(all(minFilter(I, 3) <= I, 'all'));
            tc.verifyTrue(all(maxFilter(I, 3) >= I, 'all'));
        end

        function orderStatisticRankFiveIsMedian(tc)
            tc.verifyEqual(orderStatisticFilter(tc.Img, 3, 5), medianFilter(tc.Img, 3), 'AbsTol', 1e-12);
        end

        function midpointIsAverageOfMinMax(tc)
            I = tc.Img;
            tc.verifyEqual(midpointFilter(I, 3), (minFilter(I, 3) + maxFilter(I, 3)) / 2, 'AbsTol', 1e-12);
        end

        function invalidKernelSizeErrors(tc)
            tc.verifyError(@() meanFilter(tc.Img, 4), 'ImageLab:invalidKernelSize');
            tc.verifyError(@() medianFilter(tc.Img, -3), 'ImageLab:invalidKernelSize');
            tc.verifyError(@() orderStatisticFilter(tc.Img, 3, 10), 'ImageLab:invalidParameter');
        end

        % ----------------------------------------- correlation/convolution
        function correlationMatchesFilter2(tc)
            I = magic(6);
            K = [1 0 -1; 2 0 -2; 1 0 -1];
            tc.verifyEqual(manualCorrelation(I, K, 'same'), filter2(K, I, 'same'), 'AbsTol', 1e-10);
            tc.verifyEqual(manualCorrelation(I, K, 'valid'), filter2(K, I, 'valid'), 'AbsTol', 1e-10);
        end

        function convolutionMatchesConv2(tc)
            I = magic(6);
            K = [1 2 3; 4 5 6; 7 8 9];
            for shape = {'same', 'valid', 'full'}
                tc.verifyEqual(manualConvolution(I, K, shape{1}), conv2(I, K, shape{1}), 'AbsTol', 1e-10);
            end
        end

        function convolutionFlipsKernel(tc)
            [~, ~, flipped] = manualConvolution(magic(4), [1 2 3; 4 5 6; 7 8 9]);
            tc.verifyEqual(flipped, [9 8 7; 6 5 4; 3 2 1]);
        end

        function correlationStepsRecorded(tc)
            I = [1 2 3; 4 5 6; 7 8 9];
            K = [1 0 -1; 1 0 -1; 1 0 -1];
            [out, steps] = manualCorrelation(I, K, 'same');
            tc.verifyNumElements(steps, 9);
            tc.verifyEqual(steps(5).sum, out(2, 2));
            tc.verifyEqual(out(2, 2), (1 + 4 + 7) - (3 + 6 + 9));   % = -6
        end

        function filter2DMatchesManualLoop(tc)
            K = [0 -1 0; -1 5 -1; 0 -1 0];
            tc.verifyEqual(filter2D(tc.Img, K), manualFilterLoop(tc.Img, K), 'AbsTol', 1e-12);
        end

        % -------------------------------------------------- histogram
        function histogramCountsAllPixels(tc)
            counts = imhistManual(tc.Img);
            tc.verifyEqual(sum(counts), numel(tc.Img));
            tc.verifySize(counts, [256 1]);
        end

        function histogramEqualizationSpreadsLevels(tc)
            low = 0.4 + 0.1 * tc.Img;                       % low-contrast image
            J = histogramEqualizationManual(low);
            tc.verifyGreaterThan(max(J(:)) - min(J(:)), 0.9);
            tc.verifyEqual(max(J(:)), 1, 'AbsTol', 1e-12);
            % the mapping (CDF) is monotonic: pixel order is preserved
            [~, a] = sort(toUint8(low(:)));
            tc.verifyTrue(all(diff(J(a)) >= 0));
        end

        function histogramEqualizationToolboxMatchesShape(tc)
            J = histogramEqualization(tc.ImgRGB);
            tc.verifySize(J, size(tc.ImgRGB));
        end

        function pointTransforms(tc)
            tc.verifyEqual(gammaCorrection(0.25, 0.5), 0.5, 'AbsTol', 1e-12);
            tc.verifyEqual(logTransform([0 1], 10), [0 1], 'AbsTol', 1e-12);
            tc.verifyEqual(negativeTransform(0.2), 0.8, 'AbsTol', 1e-12);
            J = contrastStretch([0.4 0.5 0.6], 0.4, 0.6);
            tc.verifyEqual(J, [0 0.5 1], 'AbsTol', 1e-12);
        end

        function statisticsOfConstantImage(tc)
            s = imageStatistics(zeros(10));
            tc.verifyEqual(s.entropy, 0);
            tc.verifyEqual(s.variance, 0);
        end

        % -------------------------------------------------- noise
        function saltPepperDensity(tc)
            rng(1);
            J = addSaltPepperNoise(0.5 * ones(200), 0.1);
            changed = mean(J(:) ~= 0.5);
            tc.verifyEqual(changed, 0.1, 'AbsTol', 0.02);
            tc.verifyTrue(all(ismember(J(J ~= 0.5), [0 1])));
        end

        function gaussianNoiseVariance(tc)
            rng(2);
            J = addGaussianNoise(0.5 * ones(300), 0, 0.01);
            tc.verifyEqual(var(J(:)), 0.01, 'RelTol', 0.1);
        end

        % -------------------------------------------------- metrics
        function mseKnownValue(tc)
            tc.verifyEqual(calculateMSE(zeros(4), 0.5 * ones(4)), 0.25, 'AbsTol', 1e-12);
        end

        function psnrKnownValue(tc)
            tc.verifyEqual(calculatePSNR(zeros(4), 0.1 * ones(4)), 20, 'AbsTol', 1e-9);
            tc.verifyEqual(calculatePSNR(tc.Img, tc.Img), Inf);
        end

        function imageQualityHasMseAndPsnr(tc)
            q = imageQuality(tc.Img, tc.Img);
            tc.verifyEqual(fieldnames(q), {'mse'; 'psnr'});
            tc.verifyEqual(q.mse, 0);
        end

        function regionOutline(tc)
            BW = false(7); BW(2:6, 2:6) = true;
            B = extractBoundary(BW);
            ring = BW; ring(3:5, 3:5) = false;           % foreground with a background neighbour
            tc.verifyEqual(B, ring);
            tc.verifyEqual(extractBoundary(true(3)), logical([1 1 1; 1 0 1; 1 1 1]));   % image border = background
        end

        function cannyHysteresisKeepsOnlyConnectedWeakEdges(tc)
            % a strong step edge plus an isolated weak square
            I = zeros(40, 60);
            I(21:end, 5:30) = 1;                          % strong step
            I(5:10, 50:55) = 0.3;                         % weak and isolated
            strongOnly = cannyManual(I, 1, 0.4999, 0.5);  % low ≈ high: (almost) no hysteresis
            BW = cannyManual(I, 1, 0.1, 0.5);
            tc.verifyTrue(all(BW(strongOnly)));           % hysteresis only ADDS pixels
            tc.verifyTrue(any(BW(19:23, 15)));            % the strong edge is found
            tc.verifyFalse(any(BW(3:12, 48:57), 'all'));  % weak but not connected to a strong edge: dropped
            % on a real image the kept weak pixels all touch the strong set's growth
            [E, thr] = cannyManual(tc.Img, 1);
            tc.verifyEqual(cannyManual(tc.Img, 1, thr(1), thr(2)), E);
        end

        % -------------------------------------------------- edges
        function sobelOnVerticalStep(tc)
            I = [zeros(8, 4) ones(8, 4)];
            [mag, gx, gy] = sobelManual(I);
            tc.verifyEqual(max(abs(gy(:))), 0, 'AbsTol', 1e-12);       % no horizontal edge
            tc.verifyEqual(max(gx(:)), 4, 'AbsTol', 1e-12);            % 1+2+1
            tc.verifyEqual(find(mag(4, :) > 0), [4 5]);
        end

        function prewittOnHorizontalStep(tc)
            I = [zeros(4, 8); ones(4, 8)];
            [~, gx, gy] = prewittManual(I);
            tc.verifyEqual(max(abs(gx(:))), 0, 'AbsTol', 1e-12);
            tc.verifyEqual(max(gy(:)), 3, 'AbsTol', 1e-12);
        end

        function edgeDetectorsFindSquare(tc)
            I = zeros(40); I(10:30, 10:30) = 1;
            for m = {'roberts', 'prewitt', 'sobel', 'canny', 'log'}
                BW = edgeDetect(I, m{1});
                tc.verifyTrue(islogical(BW), m{1});
                tc.verifyGreaterThan(nnz(BW), 40, m{1});
                tc.verifyFalse(any(BW(20, 15:25)), [m{1} ' found edges inside the square']);
            end
        end

        function laplacianKernelMatchesFormula(tc)
            tc.verifyEqual(laplacianKernel(0), [0 1 0; 1 -4 1; 0 1 0], 'AbsTol', 1e-12);
            tc.verifyEqual(sum(sum(laplacianKernel(0.3))), 0, 'AbsTol', 1e-12);
        end

        function sharpeningIncreasesEdgeContrast(tc)
            I = [0.3 * ones(10, 5) 0.7 * ones(10, 5)];
            G = laplacianSharpen(I, 0, 1);
            tc.verifyLessThan(G(5, 5), 0.3);           % dark side darker
            tc.verifyGreaterThan(G(5, 6), 0.7);        % bright side brighter
        end

        % -------------------------------------------------- segmentation
        function otsuSeparatesTwoLevels(tc)
            I = 0.2 * ones(20); I(:, 11:20) = 0.8;
            [BW, level] = otsuThreshold(I);
            tc.verifyGreaterThan(level, 0.19);
            tc.verifyLessThan(level, 0.8);
            tc.verifyEqual(BW, I > 0.5);
        end

        function globalAndIterativeThreshold(tc)
            I = 0.2 * ones(20); I(:, 11:20) = 0.8;
            tc.verifyEqual(globalThreshold(I, 0.5), I > 0.5);
            [BW, T] = iterativeThreshold(I);
            tc.verifyEqual(T, 0.5, 'AbsTol', 1e-9);
            tc.verifyEqual(BW, I > 0.5);
        end

        function regionGrowingStaysInRegion(tc)
            I = zeros(20); I(5:10, 5:10) = 1;
            BW = regionGrowing(I, 7, 7, 0.1);
            tc.verifyEqual(nnz(BW), 36);
        end

        function labellingCountsComponents(tc)
            BW = false(10); BW(2:3, 2:3) = true; BW(7:8, 7:8) = true; BW(2, 9) = true;
            [L, n] = labelComponents(BW, 8);
            tc.verifyEqual(n, 3);
            props = regionProperties(L);
            tc.verifyEqual(sort([props.area]), [1 4 4]);
        end

        function splitAndMergeFindsTwoRegions(tc)
            I = zeros(64); I(:, 33:64) = 1;
            [~, ~, n] = splitAndMerge(I, 0.05, 4, 0.1);
            tc.verifyEqual(n, 2);
        end

        % -------------------------------------------------- colour
        function colourRoundTrips(tc)
            I = tc.ImgRGB;
            tc.verifyEqual(hsv2rgb(rgb2hsv(I)), I, 'AbsTol', 1e-9);
            tc.verifyEqual(1 - (1 - I), I, 'AbsTol', 1e-12);              % CMY
            [ch, names] = colorChannels(I, 'hsv');
            tc.verifyNumElements(ch, 3);
            tc.verifyError(@() colorChannels(I, 'ycbcr'), 'ImageLab:invalidParameter');
        end

        % -------------------------------------------------- fundamentals
        function quantizationLevels(tc)
            J = quantizeImage(tc.Img, 2);
            tc.verifyLessThanOrEqual(numel(unique(J)), 4);
        end

        function distances(tc)
            d = pixelDistances([0 0], [3 4]);
            tc.verifyEqual([d.euclidean d.cityBlock d.chessboard], [5 7 4]);
        end

        function mAdjacencyRemovesDoublePath(tc)
            V = [0 1 1; 0 1 0; 0 0 1];
            info = pixelNeighborhood(V, 2, 2, 1);
            tc.verifyEqual(size(info.adjacent8, 1), 3);    % (1,2) (1,3) (3,3)
            tc.verifyEqual(size(info.adjacentM, 1), 2);    % (1,3) dropped, (3,3) kept
        end

        % -------------------------------------------------- representation
        function chainCodeOfSquares(tc)
            tc.verifyEqual(chainCode(true(2)), [6 0 2 4]);
            BW = false(5); BW(2:4, 2:4) = true;
            [code, bnd, start] = chainCode(BW);
            tc.verifyEqual(code, [6 6 0 0 2 2 4 4]);
            tc.verifyEqual(size(bnd, 1), 8);
            tc.verifyEqual(start, [2 2]);
            tc.verifyEmpty(chainCode(logical([0 0; 0 1])));                % single pixel
            tc.verifyEqual(chainCode(logical(eye(3))), [7 7 3 3]);         % diagonal line
        end

        function chainCodeDescriptorsInvariance(tc)
            d = chainCodeDescriptors([6 6 0 0 2 2 4 4]);
            tc.verifyEqual(d.perimeter, 8);
            tc.verifyEqual(d.firstDifference, [2 0 2 0 2 0 2 0]);
            tc.verifyEqual(d.shapeNumber, [0 2 0 2 0 2 0 2]);
            rotated = chainCodeDescriptors(mod([6 6 0 0 2 2 4 4] + 2, 8));   % rotate 90 degrees
            tc.verifyEqual(rotated.firstDifference, d.firstDifference);
            shifted = chainCodeDescriptors([0 0 2 2 4 4 6 6]);              % other start point
            tc.verifyEqual(shifted.shapeNumber, d.shapeNumber);
            tc.verifyEqual(chainCodeDescriptors([7 7 3 3]).perimeter, 4 * sqrt(2), 'AbsTol', 1e-12);
        end

        % -------------------------------------------------- restoration
        function adaptiveMedianRemovesImpulses(tc)
            I = 0.5 * ones(40);
            N = addSaltPepperNoise(I, 0.25);
            J = adaptiveMedianFilter(N, 7);
            tc.verifyEqual(J, I, 'AbsTol', 1e-12);
        end

        function adaptiveMedianKeepsCleanDetail(tc)
            I = tc.Img;                                    % no impulses
            J = adaptiveMedianFilter(I, 5);
            M = medianFilter(I, 3);
            tc.verifyLessThan(mean(abs(J(:) - I(:))), mean(abs(M(:) - I(:))));
        end

        function adaptiveLocalFilterBehaviour(tc)
            tc.verifyEqual(adaptiveLocalFilter(0.4 * ones(20), 5), 0.4 * ones(20), 'AbsTol', 1e-12);
            tc.verifyEqual(adaptiveLocalFilter(tc.Img, 5, 1e-15), tc.Img, 'AbsTol', 1e-9);
            N = tc.Img + 0.05 * randn(size(tc.Img));
            tc.verifyLessThan(calculateMSE(adaptiveLocalFilter(N, 5), tc.Img), calculateMSE(N, tc.Img));
        end

        function noiseModelMoments(tc)
            % sample mean / variance of each PDF against the formula
            % (noise added to a mid-grey image far from the clipping limits)
            rng(3);
            I = 0.3 * ones(400);
            z = addRayleighNoise(I, 0, 0.01) - 0.3;
            tc.verifyEqual(mean(z(:)), sqrt(pi * 0.01 / 4), 'AbsTol', 2e-3);
            tc.verifyEqual(var(z(:)), 0.01 * (4 - pi) / 4, 'RelTol', 0.05);
            z = addErlangNoise(I, 20, 2) - 0.3;
            tc.verifyEqual(mean(z(:)), 2 / 20, 'AbsTol', 2e-3);
            tc.verifyEqual(var(z(:)), 2 / 400, 'RelTol', 0.05);
            z = addExponentialNoise(I, 20) - 0.3;
            tc.verifyEqual(mean(z(:)), 1 / 20, 'AbsTol', 2e-3);
            z = addUniformNoise(I, -0.1, 0.1) - 0.3;
            tc.verifyEqual(mean(z(:)), 0, 'AbsTol', 2e-3);
            tc.verifyEqual(var(z(:)), 0.2^2 / 12, 'RelTol', 0.05);
            tc.verifyGreaterThanOrEqual(min(z(:)), -0.1 - 1e-12);
            tc.verifyEqual(size(addNoise(tc.ImgRGB, 'erlang', struct('a', 10, 'b', 3))), size(tc.ImgRGB));
            tc.verifyError(@() addNoise(I, 'pink'), 'ImageLab:invalidParameter');
        end

        function meanFiltersMatchDefinitions(tc)
            I = 0.1 + 0.8 * tc.Img / max(tc.Img(:));
            W = neighborhoodStack(I, 3, 3, 'replicate');
            tc.verifyEqual(geometricMeanFilter(I, 3), prod(W, 3) .^ (1/9), 'AbsTol', 1e-10);
            tc.verifyEqual(harmonicMeanFilter(I, 3), 9 ./ sum(1 ./ W, 3), 'AbsTol', 1e-10);
            tc.verifyEqual(contraharmonicMeanFilter(I, 3, 1.5), sum(W .^ 2.5, 3) ./ sum(W .^ 1.5, 3), 'AbsTol', 1e-10);
            tc.verifyEqual(contraharmonicMeanFilter(I, 3, 0), meanFilter(I, 3), 'AbsTol', 1e-10);
            tc.verifyEqual(contraharmonicMeanFilter(I, 3, -1), harmonicMeanFilter(I, 3), 'AbsTol', 1e-10);
            % Q > 0 removes pepper, Q < 0 removes salt
            P = 0.5 * ones(30); P(15, 15) = 0;
            J = contraharmonicMeanFilter(P, 3, 2);
            tc.verifyEqual(J(15, 15), 0.5, 'AbsTol', 1e-6);
            S = 0.5 * ones(30); S(15, 15) = 1;
            J = contraharmonicMeanFilter(S, 3, -3);
            tc.verifyLessThan(abs(J(15, 15) - 0.5), 0.01);
        end

        function blurPSFsAreNormalised(tc)
            for h = {blurPSF('motion', 9, 0), blurPSF('motion', 15, 37), blurPSF('gaussian', 2), blurPSF('disk', 4), blurPSF('box', 5)}
                tc.verifyEqual(sum(h{1}(:)), 1, 'AbsTol', 1e-12);
                tc.verifyGreaterThanOrEqual(min(h{1}(:)), 0);
                tc.verifyEqual(h{1}, rot90(h{1}, 2), 'AbsTol', 1e-12);   % point-symmetric
            end
            h = blurPSF('motion', 9, 0);
            tc.verifyEqual(find(any(h, 2))', 5);                        % one horizontal row
            h = blurPSF('motion', 9, 90);
            tc.verifyEqual(find(any(h, 1)), 5);                         % one vertical column
            tc.verifyError(@() blurPSF('swirl'), 'ImageLab:invalidParameter');
        end

        function lpiDegradationIsLinear(tc)
            h = blurPSF('motion', 7, 30);
            a = blurImage(tc.Img, h); b = blurImage(tc.Img .^ 2, h);
            tc.verifyEqual(blurImage(2 * tc.Img + 3 * tc.Img .^ 2, h), 2 * a + 3 * b, 'AbsTol', 1e-12);
            tc.verifyEqual(degradeLPI(tc.Img, h, 0), min(max(a, 0), 1), 'AbsTol', 1e-12);
        end

        function deconvolutionImprovesBlurredImage(tc)
            rng(5);
            f = tc.Img;
            h = blurPSF('motion', 7, 0);
            g = degradeLPI(f, h, 1e-5);
            for m = {'inverse', 'wiener', 'cls', 'lucy'}
                [J, hist] = deconvolveImage(g, h, m{1}, 0.002, 8, f);
                tc.verifyGreaterThan(calculatePSNR(J, f), calculatePSNR(g, f), m{1});
                tc.verifyNumElements(hist, 8);
            end
            % a huge K makes the energy term dominate: the solution shrinks to 0
            J = deconvolveImage(g, h, 'wiener', 1e6, 5);
            tc.verifyLessThan(max(J(:)), 1e-3);
        end

        % -------------------------------------------------- intensity transformations
        function histogramMatchingFollowsTarget(tc)
            G = tc.Img;
            J = histogramMatching(G, targetHistogram('gaussian', 0.25, 0.05));
            tc.verifyEqual(mean(J(:)), 0.25, 'AbsTol', 0.03);
            % matching to a flat histogram = equalisation (same CDF mapping)
            [~, map] = histogramMatching(G, ones(256, 1));
            [~, mapEq] = histogramEqualizationManual(G);
            tc.verifyLessThanOrEqual(max(abs(map(:) - mapEq(:))), 1);
            % matching to its own histogram changes (almost) nothing
            tc.verifyLessThan(max(abs(histogramMatching(G, G) - toDouble(toUint8(G))), [], 'all'), 1.5 / 255);
            tc.verifyEqual(size(histogramMatching(tc.ImgRGB, targetHistogram('bimodal'))), size(tc.ImgRGB));
        end

        function piecewiseAndSlicing(tc)
            r = (0:0.1:1)';
            tc.verifyEqual(piecewiseLinear(r, 0.3, 0.3, 0.7, 0.7), r, 'AbsTol', 1e-12);       % identity
            tc.verifyEqual(piecewiseLinear(r, 0.5, 0, 0.5, 1), double(r >= 0.5), 'AbsTol', 1e-12);   % threshold
            tc.verifyEqual(piecewiseLinear(0.5, 0.3, 0, 0.7, 1), 0.5, 'AbsTol', 1e-12);
            J = grayLevelSlicing(r, 0.35, 0.65, 'binary');
            tc.verifyEqual(J, 0.1 + 0.9 * (r > 0.35 & r < 0.65), 'AbsTol', 1e-12);
            J = grayLevelSlicing(r, 0.35, 0.65, 'preserve');
            tc.verifyEqual(J, max(r, r > 0.35 & r < 0.65), 'AbsTol', 1e-12);
        end

        function bitPlanesRebuildImage(tc)
            [planes, R] = bitPlaneSlicing(tc.Img, 1:8);
            tc.verifyEqual(R, double(toUint8(tc.Img)) / 255, 'AbsTol', 1e-12);
            tc.verifyNumElements(planes, 8);
            tc.verifyClass(planes{8}, 'logical');
            tc.verifyEqual(planes{8}, toUint8(tc.Img) >= 128);
            [~, R2] = bitPlaneSlicing(tc.Img, [7 8]);
            tc.verifyLessThan(max(abs(R2(:) - R(:))), 64 / 255);
        end

        % -------------------------------------------------- colour models
        function hsiAndCmykModels(tc)
            X = tc.ImgRGB;
            tc.verifyEqual(hsiToRgb(rgbToHsi(X)), X, 'AbsTol', 1e-9);
            H = rgbToHsi(X);
            tc.verifyEqual(H(:,:,3), mean(X, 3), 'AbsTol', 1e-12);
            H = rgbToHsi(cat(3, 1, 0, 0));
            tc.verifyEqual(squeeze(H)', [0 1 1/3], 'AbsTol', 1e-9);              % pure red
            H = rgbToHsi(cat(3, 0, 0, 1));
            tc.verifyEqual(H(1), 240 / 360, 'AbsTol', 1e-9);                    % pure blue
            [K, C] = rgbToCmyk(X);
            tc.verifyEqual(C, 1 - X, 'AbsTol', 1e-12);
            tc.verifyEqual((1 - K(:,:,1:3)) .* (1 - K(:,:,4)), X, 'AbsTol', 1e-9);   % back to RGB
            [ch, names] = colorChannels(X, 'cmyk');
            tc.verifyNumElements(ch, 4);
            tc.verifyEqual(names{4}, 'Black (K)');
            tc.verifyEqual(colorEnhance(X, 'hsi', 3, 'gain', 1), X, 'AbsTol', 1e-9);
            tc.verifyEqual(colorEnhance(X, 'cmy', 1, 'gain', 1), X, 'AbsTol', 1e-12);
        end

        function pseudocolourMaps(tc)
            [J, colors, edges] = intensitySlicing(tc.Img, 4, 'hot');
            tc.verifyEqual(size(J), [size(tc.Img) 3]);
            tc.verifyEqual(size(colors), [4 3]);
            tc.verifyEqual(edges, [0 0.25 0.5 0.75 1]);
            tc.verifyLessThanOrEqual(size(unique(reshape(J, [], 3), 'rows'), 1), 4);
            [J, curves] = grayToColor(tc.Img, 1, [0 0 0]);
            tc.verifyEqual(J(:,:,1), J(:,:,3), 'AbsTol', 1e-12);                % equal phases -> grey
            tc.verifyEqual(size(curves), [256 3]);
            tc.verifyError(@() intensitySlicing(tc.Img, 4, 'rainbow'), 'ImageLab:invalidParameter');
        end

        % -------------------------------------------------- edge linking
        function houghFindsSyntheticLines(tc)
            B = false(100, 120);
            B(30, 10:110) = true;                       % horizontal: theta = -90
            B(5:95, 60) = true;                         % vertical: theta = 0
            [H, theta, rho] = houghTransform(B);
            tc.verifyEqual(sum(H(:, 1)), nnz(B));       % every pixel votes once per angle
            P = houghPeaks(H, 2);
            found = sort(theta(P(:, 2)));
            tc.verifyEqual(found, [-90 0]);
            L = houghLines(B, theta, rho, P, 5, 20);
            tc.verifyNumElements(L, 2);
            tc.verifyEqual(sort([L.length]), [90 100], 'AbsTol', 1e-9);
            % a gap longer than fillGap splits a line
            B(30, 50:54) = false;
            [H, theta, rho] = houghTransform(B);
            L = houghLines(B, theta, rho, houghPeaks(H, 1), 3, 10);
            tc.verifyNumElements(L, 2);
        end

        function localEdgeLinkingFillsGaps(tc)
            I = zeros(40, 60); I(21:end, :) = 1;        % one horizontal step edge
            [linked, cand] = localEdgeLinking(I, 0.3, 20, 5);
            tc.verifyTrue(all(any(linked(19:22, 3:end-2), 1)));
            I(:, 28:31) = 0.5 * I(:, 28:31) + 0.25;     % weaken the edge over 4 columns
            [linked, cand] = localEdgeLinking(I, 0.6, 20, 5);
            tc.verifyFalse(all(any(cand(19:22, 3:end-2), 1)));          % broken before linking
            tc.verifyTrue(all(any(linked(19:22, 3:end-2), 1)));         % bridged after
        end

        % -------------------------------------------------- description
        function boundaryDescriptorsOfASquare(tc)
            S = false(60); S(11:50, 11:50) = true;
            [~, bnd] = chainCode(S);
            r = boundarySignature(bnd);
            tc.verifyNumElements(r, 360);
            tc.verifyEqual(max(r) / min(r), sqrt(2), 'RelTol', 0.02);
            v = polygonApprox(bnd, 1.5);
            tc.verifyNumElements(v, 4);
            [~, rebuilt] = fourierDescriptors(bnd);
            tc.verifyEqual(rebuilt, bnd, 'AbsTol', 1e-9);
            [~, ~, inv] = fourierDescriptors(bnd);
            [~, b2] = chainCode(rot90(S));
            [~, ~, inv2] = fourierDescriptors(b2);
            tc.verifyEqual(inv2, inv, 'AbsTol', 1e-6);  % rotation / start point invariant
        end

        function momentsAreInvariant(tc)
            [X, Y] = meshgrid(1:90);
            E = hypot((X - 45) / 30, (Y - 45) / 12) <= 1;
            m = regionMoments(E);
            tc.verifyEqual(m.eccentricity, sqrt(1 - (12 / 30)^2), 'AbsTol', 0.01);
            tc.verifyEqual(m.orientation, 0, 'AbsTol', 0.5);
            m90 = regionMoments(rot90(E));
            tc.verifyEqual(abs(m90.orientation), 90, 'AbsTol', 0.5);
            tc.verifyEqual(m90.hu, m.hu, 'AbsTol', 1e-12);
            D = hypot(X - 45, Y - 45) <= 30;
            tc.verifyEqual(regionMoments(D).hu(1), 1 / (2 * pi), 'RelTol', 0.01);
        end

        function skeletonAndTexture(tc)
            S = false(30); S(6:25, 11:18) = true;       % 20 x 8 bar
            [K, n] = morphSkeleton(S, ones(3));
            tc.verifyTrue(all(K(S == 0) == 0));           % inside the region
            tc.verifyGreaterThan(nnz(K), 0);
            tc.verifyEqual(n, 3);                         % 8 px wide: 3 erosions survive
            tc.verifyTrue(any(morphSkeleton(true(9)), 'all'));   % touching the border still ends
            t = textureDescriptors(0.5 * ones(10));
            tc.verifyEqual([t.smoothness t.uniformity t.entropy], [0 1 0], 'AbsTol', 1e-12);
            t2 = textureDescriptors(tc.Img);
            tc.verifyGreaterThan(t2.entropy, 3);
        end

        function perceptionAndSpectrum(tc)
            d = perceptionDemo('machbands', 6);
            tc.verifyNumElements(unique(d.image), 6);
            k = 48;                                       % last pixel of the first band
            tc.verifyLessThan(d.perceived(k), d.actual(k));          % dark side of the step dips
            tc.verifyGreaterThan(d.perceived(k + 1), d.actual(k + 1));   % bright side overshoots
            tc.verifyEqual(d.perceived(24), d.actual(24), 'AbsTol', 0.01);   % flat inside a band
            d = perceptionDemo('simultaneous', 0.4);
            tc.verifyEqual(d.image(70, 70), d.image(70, 70 + 3 * 140));
            d = perceptionDemo('weber', 0.5, 0.05);
            tc.verifyEqual(d.weber, 0.1, 'AbsTol', 1e-12);
            rgb = wavelengthToRGB([450 530 650 900]);
            [~, dominant] = max(rgb(1:3, :), [], 2);
            tc.verifyEqual(dominant', [3 2 1]);                       % blue, green, red
            tc.verifyEqual(rgb(4, :), [0 0 0]);
        end

        % -------------------------------------------------- metrics
        function errorMapStatistics(tc)
            [H, E, s] = errorMap(tc.ImgRGB, tc.ImgRGB);
            tc.verifyEqual(size(H), size(tc.ImgRGB));
            tc.verifyEqual(max(E(:)), 0);
            tc.verifyEqual(s.changedPct, 0);
            B = tc.Img; B(1, 1) = B(1, 1) + 0.2;
            [~, E, s] = errorMap(B, tc.Img);
            tc.verifyEqual(s.maxError, 255 * 0.2, 'AbsTol', 1e-9);
            tc.verifyEqual(nnz(E), 1);
            tc.verifyError(@() errorMap(tc.Img, tc.ImgRGB), 'ImageLab:sizeMismatch');
        end

        % -------------------------------------------------- step-by-step animations
        function medianStepsMatchFilter(tc)
            A = magic(6);
            S = medianSteps(A, 3);
            tc.verifyEqual(numel(S.steps), 36);
            st = S.steps{8};
            tc.verifyEqual(st.sorted, sort(st.values));
            tc.verifyEqual(st.median, st.sorted(5));
            tc.verifyEqual(S.output.data, num2cell(reshape(medianFilterManual(A, 3).', 1, [])));
        end

        function histeqStepsKnownExample(tc)
            S = histeqSteps([0 0 1 1; 2 2 2 3], 4);
            tc.verifyEqual(S.counts, [2 2 3 1]);
            tc.verifyEqual(S.cdf, [0.25 0.5 0.875 1], 'AbsTol', 1e-12);
            tc.verifyEqual(S.mapping, [1 2 3 3]);
            tc.verifyError(@() histeqSteps([0 9], 8), 'ImageLab:invalidMatrix');
        end

        function regionGrowingStepsRecordQueue(tc)
            A = [10 12 50; 11 13 52; 90 14 15];
            S = regionGrowingSteps(A, 1, 1, 5, 4);
            tc.verifyEqual(S.events{1}.type, 'take');
            tc.verifyEqual(S.size, 6);                         % 10 12 11 13 14 15
            accepted = cellfun(@(e) strcmp(e.type, 'check') && e.accepted, S.events);
            tc.verifyEqual(nnz(accepted), 5);
            tc.verifyEqual(S.order.data{1}, 1);
        end

        % -------------------------------------------------- code lab
        function codeTaskSolutionsPassAndStartersFail(tc)
            ilab_store('init', fullfile(tempdir, 'ilab_test_images'));
            T = codeTasks('list');
            for k = 1:numel(T)
                t = T{k};
                I = codeTasks('input', t.id);
                full = codeTasks('get', t.id);
                r = runStudentCode(codeTasks('solution', t.id), I, struct('forbidden', {full.forbidden}));
                tc.verifyEmpty(r.error, t.id);
                g = codeTasks('grade', t.id, struct('out', r.outValue), I);
                tc.verifyTrue(g.passed, sprintf('%s: model solution must pass (%s)', t.id, g.message));
                r = runStudentCode(t.starter, I, struct());
                ws = struct(); if r.hasOut, ws.out = r.outValue; end
                tc.verifyFalse(codeTasks('grade', t.id, ws, I).passed, [t.id ': starter code must not pass']);
            end
        end

        function codeLabCapturesOutputErrorsAndFigures(tc)
            ilab_store('init', fullfile(tempdir, 'ilab_test_images'));
            r = runStudentCode(sprintf('x = 6 * 7\nfigure; plot(1:3)\nout = img;'), tc.Img);
            tc.verifyTrue(contains(r.output, '42'));
            tc.verifyNumElements(r.figures, 1);
            tc.verifyEqual(r.outValue, tc.Img);
            tc.verifyEqual(r.variables{1}.name, 'out');
            r = runStudentCode(sprintf('a = 1;\nb = [1 2 3];\nc = b(5);'), tc.Img);
            tc.verifyEqual(r.error.line, 3);
            r = runStudentCode(sprintf('a = 1;\nb = [1 2 3;\nc = 2'), tc.Img);
            tc.verifyNotEmpty(r.error);
            tc.verifyFalse(contains(r.error.message, 'ilab_code_'));
        end

        function codeLabBlocksDangerousCalls(tc)
            for bad = {'system(''dir'')', 'clear all', 'clear functions', '!dir', ...
                       'delete(''x.txt'')', 'eval(''1+1'')', 'cd ..', 'x = 1; save(''x.mat'')'}
                tc.verifyError(@() runStudentCode(bad{1}, tc.Img), 'ImageLab:codeBlocked', bad{1});
            end
            tc.verifyError(@() runStudentCode('out = conv2(img, ones(3)/9);', tc.Img, ...
                struct('forbidden', {{'conv2'}})), 'ImageLab:codeForbidden');
            % names inside strings and comments, or used as variables, are fine
            r = runStudentCode(sprintf('input = img;\n%% system(x)\ns = ''delete me'';\nt = s'';\nout = input;'), tc.Img);
            tc.verifyEmpty(r.error);
            tc.verifyFalse(contains(path, [filesep 'shims']));   % stand-ins removed again
        end
    end
end
