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

        % -------------------------------------------------- morphology
        function structuringElementShapes(tc)
            tc.verifyEqual(structuringElement('square', 3), true(3));
            tc.verifyEqual(structuringElement('cross', 3), logical([0 1 0; 1 1 1; 0 1 0]));
            tc.verifyEqual(structuringElement('diamond', 5), logical([0 0 1 0 0; 0 1 1 1 0; 1 1 1 1 1; 0 1 1 1 0; 0 0 1 0 0]));
            tc.verifyEqual(structuringElement('disk', 5), logical([0 1 1 1 0; 1 1 1 1 1; 1 1 1 1 1; 1 1 1 1 1; 0 1 1 1 0]));
            tc.verifyEqual(structuringElement('hline', 3), logical([0 0 0; 1 1 1; 0 0 0]));
            tc.verifyError(@() validateSE(zeros(3)), 'ImageLab:invalidSE');
            tc.verifyError(@() validateSE(ones(2)), 'ImageLab:invalidSE');
        end

        function erodeDilateMatchManual(tc)
            SE = logical([0 1 0; 1 1 1; 0 1 1]);           % asymmetric on purpose
            BW = tc.Img > 0.6;
            tc.verifyEqual(erodeImage(BW, SE), morphologyManual(BW, SE, 'erode'));
            tc.verifyEqual(dilateImage(BW, SE), morphologyManual(BW, SE, 'dilate'));
            tc.verifyEqual(erodeImage(tc.Img, SE), morphologyManual(tc.Img, SE, 'erode'), 'AbsTol', 1e-12);
            tc.verifyEqual(dilateImage(tc.ImgRGB, SE), morphologyManual(tc.ImgRGB, SE, 'dilate'), 'AbsTol', 1e-12);
            tc.verifyClass(erodeImage(BW, SE), 'logical');
        end

        function grayErosionIsMinFilter(tc)
            E = erodeImage(tc.Img, true(3));
            M = minFilter(tc.Img, 3);                       % borders are padded differently
            tc.verifyEqual(E(2:end-1, 2:end-1), M(2:end-1, 2:end-1), 'AbsTol', 1e-12);
        end

        function erosionDilationDuality(tc)
            SE = structuringElement('disk', 5);
            BW = tc.Img > 0.55;
            tc.verifyEqual(erodeImage(BW, SE), ~dilateImage(~BW, SE));
        end

        function openingAndClosingAreIdempotent(tc)
            SE = structuringElement('square', 3);
            BW = tc.Img > 0.55;
            O = openImage(BW, SE);
            C = closeImage(BW, SE);
            tc.verifyEqual(openImage(O, SE), O);
            tc.verifyEqual(closeImage(C, SE), C);
            tc.verifyTrue(all(O(:) <= BW(:)));              % opening is anti-extensive
            tc.verifyTrue(all(C(:) >= BW(:)));              % closing is extensive
        end

        function boundaryOfSquare(tc)
            BW = false(9); BW(3:7, 3:7) = true;
            B = morphBoundary(BW, true(3));
            tc.verifyEqual(nnz(B), 16);
            tc.verifyFalse(B(5, 5));
        end

        function fillHolesFillsOnlyEnclosedBackground(tc)
            BW = false(12); BW(2:8, 2:8) = true; BW(4:6, 4:6) = false;   % ring with a 3x3 hole
            BW(10:12, 10:12) = true; BW(11:12, 12) = false;              % notch open to the border
            [F, holes] = fillHoles(BW);
            tc.verifyEqual(nnz(holes), 9);
            tc.verifyTrue(all(F(4:6, 4:6), 'all'));
            tc.verifyFalse(F(12, 12));
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

        function morphologyStepsErodeAndDilate(tc)
            A = zeros(5); A(2:4, 2:4) = 1;
            E = morphologySteps(A, ones(3), 'erode');
            tc.verifyEqual(cell2mat(E.output.data), [zeros(1, 12) 1 zeros(1, 12)]);
            D = morphologySteps(A, ones(3), 'dilate');
            tc.verifyEqual(sum(cell2mat(D.output.data)), 25);
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

        % -------------------------------------------------- quiz
        function weakTopicQuizFocusesOnWeakCategory(tc)
            stats = struct('name', {'Noise', 'Histogram'}, 'answered', {20, 20}, 'correct', {2, 20});
            rng(1);
            [qs, plan] = quizEngine('weak', stats, 15);
            tc.verifyEqual(numel(qs), 15);
            tc.verifyEqual(plan(1).category, 'Noise');
            tc.verifyGreaterThan(nnz(strcmp({qs.category}, 'Noise')), nnz(strcmp({qs.category}, 'Histogram')));
            tc.verifyEqual(numel(unique({qs.id})), 15);      % no repeated questions
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
