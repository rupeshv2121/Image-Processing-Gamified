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

        function claheOutputRange(tc)
            J = claheManual(tc.Img, [4 4], 0.02);
            tc.verifySize(J, size(tc.Img));
            tc.verifyGreaterThanOrEqual(min(J(:)), 0);
            tc.verifyLessThanOrEqual(max(J(:)), 1);
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

        function speckleAndPoissonRanges(tc)
            J = addSpeckleNoise(tc.Img, 0.04);
            P = addPoissonNoise(tc.Img);
            tc.verifyTrue(all(J(:) >= 0 & J(:) <= 1));
            tc.verifyTrue(all(P(:) >= 0 & P(:) <= 1));
            tc.verifyEqual(mean(P(:)), mean(tc.Img(:)), 'AbsTol', 0.02);
        end

        % -------------------------------------------------- metrics
        function mseKnownValue(tc)
            tc.verifyEqual(calculateMSE(zeros(4), 0.5 * ones(4)), 0.25, 'AbsTol', 1e-12);
        end

        function psnrKnownValue(tc)
            tc.verifyEqual(calculatePSNR(zeros(4), 0.1 * ones(4)), 20, 'AbsTol', 1e-9);
            tc.verifyEqual(calculatePSNR(tc.Img, tc.Img), Inf);
        end

        function ssimProperties(tc)
            tc.verifyEqual(calculateSSIM(tc.Img, tc.Img), 1, 'AbsTol', 1e-9);
            rng(3);
            noisy = addGaussianNoise(tc.Img, 0, 0.02);
            tc.verifyLessThan(calculateSSIM(noisy, tc.Img), 0.9);
            tc.verifyError(@() calculateSSIM(tc.Img, tc.ImgRGB), 'ImageLab:sizeMismatch');
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
            tc.verifyEqual(yCbCrToRgb(rgbToYCbCr(I)), I, 'AbsTol', 1e-9);
            tc.verifyEqual(labToRgb(rgbToLab(I)), I, 'AbsTol', 1e-6);
            Lab = rgbToLab(ones(1, 1, 3));
            tc.verifyEqual(squeeze(Lab)', [100 0 0], 'AbsTol', 1e-3);   % white
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
    end
end
