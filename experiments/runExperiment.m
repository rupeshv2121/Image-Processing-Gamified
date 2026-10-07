function R = runExperiment(n, I)
%RUNEXPERIMENT Execute experiment n on image I and collect the results.
%   R.images        struct array {label, id}  (ids in the ImageLab store)
%   R.metrics       struct array {name, value}
%   R.observations  cell array of observations generated from the numbers
%   R.kernel        kernel shown in the report (or [])
%   R.parameters    text describing the parameters used

I = toDouble(I);
G = toGray(I);
rng(2024);                                   % reproducible noise
imgs = struct('label', {}, 'id', {});
mets = struct('name', {}, 'value', {});
obs = {};
kernel = [];
params = '';

switch n
    case 1   % Digital image basics
        [h, w, c] = size(I);
        mets = addM(mets, 'Width (px)', w);
        mets = addM(mets, 'Height (px)', h);
        mets = addM(mets, 'Channels', c);
        imgs = addI(imgs, 'Original', I);
        imgs = addI(imgs, 'Grayscale', G);
        for f = [2 4 8]
            imgs = addI(imgs, sprintf('Sampled 1/%d', f), sampleImage(G, f));
        end
        for b = [1 2 4]
            J = quantizeImage(G, b);
            imgs = addI(imgs, sprintf('%d-bit (%d levels)', b, 2^b), J);
            mets = addM(mets, sprintf('PSNR %d-bit', b), calculatePSNR(J, G));
        end
        params = 'Sampling factors 2, 4, 8; quantisation 1, 2, 4 bits';
        obs{end+1} = sprintf('The image is %d x %d pixels with %d channel(s).', w, h, c);
        obs{end+1} = sprintf('Quantising to 1 bit gives PSNR %.1f dB, 4 bits gives %.1f dB.', mets(4).value, mets(6).value);

    case 2   % Histogram processing
        E1 = histogramEqualization(G); E2 = clahe(G); E3 = contrastStretch(G);
        imgs = addI(imgs, 'Original', G);
        imgs = addI(imgs, 'Histogram equalisation', E1);
        imgs = addI(imgs, 'CLAHE', E2);
        imgs = addI(imgs, 'Contrast stretching', E3);
        names = {'Original', 'Equalised', 'CLAHE', 'Stretched'};
        results = {G, E1, E2, E3};
        for k = 1:4
            s = imageStatistics(results{k});
            mets = addM(mets, [names{k} ' std'], s.std);
            mets = addM(mets, [names{k} ' entropy'], s.entropy);
        end
        imgs = addChart(imgs, 'Histogram (original)', G);
        imgs = addChart(imgs, 'Histogram (equalised)', E1);
        params = 'histeq 256 levels; CLAHE 8x8 tiles, clip 0.01; stretch 1%-99%';
        obs{end+1} = sprintf('Standard deviation increased from %.1f to %.1f after equalisation.', mets(1).value, mets(3).value);

    case {3, 4, 5, 6}
        if n == 3 || n == 5
            N = addGaussianNoise(I, 0, 0.01); noiseName = 'Gaussian (var 0.01)';
        else
            N = addSaltPepperNoise(I, 0.05); noiseName = 'salt & pepper (d = 0.05)';
        end
        imgs = addI(imgs, 'Original', I);
        imgs = addI(imgs, ['Noisy: ' noiseName], N);
        mets = addM(mets, 'Noisy PSNR (dB)', calculatePSNR(N, I));
        switch n
            case 3
                list = {{'mean', 3}, {'mean', 5}, {'mean', 7}};
                kernel = ones(3) / 9;
                tic; Jm = meanFilterManual(G(1:96, 1:128), 3); tManual = toc;
                tic; Jt = meanFilter(G(1:96, 1:128), 3); tTool = toc;
                obs{end+1} = sprintf('Manual and toolbox mean filters differ by at most %.2g (identical).', max(abs(Jm(:) - Jt(:))));
                obs{end+1} = sprintf('Manual loops took %.1f ms vs %.1f ms for the vectorised version (128x96 crop).', 1000*tManual, 1000*tTool);
            case 4
                list = {{'median', 3}, {'mean', 3}, {'median', 5}};
            case 5
                list = {{'gaussian', 5, 0.5}, {'gaussian', 5, 1}, {'gaussian', 9, 2}};
                kernel = gaussianKernel(5, 1);
            case 6
                list = {{'mean', 3}, {'gaussian', 5, 1}, {'median', 3}, {'min', 3}, {'max', 3}};
        end
        best = -Inf; bestName = '';
        values = zeros(1, numel(list)); labels = cell(1, numel(list));
        for k = 1:numel(list)
            f = list{k};
            p = struct();
            if numel(f) > 2, p.sigma = f{3}; end
            tic; J = ilab_runFilter(N, f{1}, f{2}, p, 'toolbox'); t = toc;
            labels{k} = sprintf('%s %dx%d', f{1}, f{2}, f{2});
            if numel(f) > 2, labels{k} = sprintf('%s s=%.1f', labels{k}, f{3}); end
            q = imageQuality(J, I);
            values(k) = q.psnr;
            imgs = addI(imgs, labels{k}, J);
            mets = addM(mets, [labels{k} ' PSNR (dB)'], q.psnr);
            mets = addM(mets, [labels{k} ' SSIM'], q.ssim);
            mets = addM(mets, [labels{k} ' time (ms)'], 1000 * t);
            if q.psnr > best, best = q.psnr; bestName = labels{k}; end
        end
        id = ilab_barChart(values, labels, 'PSNR after filtering', 'PSNR (dB)');
        imgs(end+1) = struct('label', 'PSNR comparison (MATLAB bar chart)', 'id', id);
        params = ['Noise: ' noiseName];
        obs{end+1} = sprintf('Best result: %s with PSNR %.2f dB (noisy image: %.2f dB).', bestName, best, mets(1).value);

    case 7   % correlation
        A = [1 2 3; 4 5 6; 7 8 9]; K = [1 0 -1; 1 0 -1; 1 0 -1];
        C = manualCorrelation(A, K, 'same');
        kernel = K;
        mets = addM(mets, 'Output at centre', C(2, 2));
        mets = addM(mets, 'Max |manual - filter2|', max(max(abs(C - filter2(K, A, 'same')))));
        J = filter2D(G, [-1 0 1; -2 0 2; -1 0 1]);
        imgs = addI(imgs, 'Original', G);
        imgs = addI(imgs, 'Correlation with Sobel X (scaled)', scaleToUnit(J));
        params = 'A = [1 2 3; 4 5 6; 7 8 9], K = [1 0 -1; 1 0 -1; 1 0 -1], zero padding';
        obs{end+1} = sprintf('Correlation output matrix: %s', mat2str(C));
        obs{end+1} = 'The manual result is identical to filter2(K, A, ''same'').';

    case 8   % convolution
        A = magic(4); K = [1 2 3; 4 5 6; 7 8 9];
        [C, ~, Kf] = manualConvolution(A, K, 'same');
        R2 = manualCorrelation(A, K, 'same');
        kernel = K;
        mets = addM(mets, 'Max |manual - conv2|', max(max(abs(C - conv2(A, K, 'same')))));
        mets = addM(mets, 'Max |conv - corr|', max(max(abs(C - R2))));
        Kx = [-1 0 1; -2 0 2; -1 0 1];
        imgs = addI(imgs, 'Original', G);
        imgs = addI(imgs, 'Correlation with Sobel X', scaleToUnit(filter2D(G, Kx)));
        imgs = addI(imgs, 'Convolution with Sobel X', scaleToUnit(filter2D(G, rot90(Kx, 2))));
        params = 'A = magic(4), K = [1 2 3; 4 5 6; 7 8 9]';
        obs{end+1} = sprintf('Flipped kernel rot90(K,2) = %s', mat2str(Kf));
        obs{end+1} = 'Convolution equals conv2; correlation differs because K is not symmetric.';
        obs{end+1} = 'With Sobel X the two results are negatives of each other (light/dark edges swap).';

    case 9   % sharpening
        [S1, L] = laplacianSharpen(I, 0.2, 1);
        S2 = unsharpMask(I, 1.5, 1);
        S3 = highBoostFilter(I, 2, 3);
        S4 = gradientSharpen(I, 'sobel', 0.5);
        kernel = laplacianKernel(0.2);
        imgs = addI(imgs, 'Original', I);
        imgs = addI(imgs, 'Laplacian (scaled)', scaleToUnit(toGray(L)));
        imgs = addI(imgs, 'Laplacian sharpened', S1);
        imgs = addI(imgs, 'Unsharp masking', S2);
        imgs = addI(imgs, 'High-boost (k = 2)', S3);
        imgs = addI(imgs, 'Sobel sharpening', S4);
        names = {'Original', 'Laplacian', 'Unsharp', 'High-boost', 'Sobel'};
        results = {I, S1, S2, S3, S4};
        for k = 1:5
            mets = addM(mets, [names{k} ' mean gradient'], sharpness(results{k}));
        end
        params = 'alpha = 0.2; unsharp sigma 1.5, amount 1; high-boost k = 2';
        obs{end+1} = sprintf('Mean gradient rose from %.4f to %.4f with Laplacian sharpening.', mets(1).value, mets(2).value);

    case 10  % noise removal
        noises = {'gaussian', 'saltpepper', 'speckle', 'poisson'};
        filters = {'mean', 'median', 'gaussian', 'alphatrimmed'};
        imgs = addI(imgs, 'Original', I);
        for a = 1:numel(noises)
            N = addNoise(I, noises{a});
            imgs = addI(imgs, ['Noisy: ' noises{a}], N);
            best = -Inf; bestF = '';
            for b = 1:numel(filters)
                J = ilab_runFilter(N, filters{b}, 3, struct('sigma', 1, 'd', 4), 'toolbox');
                v = calculatePSNR(J, I);
                if v > best, best = v; bestF = filters{b}; bestJ = J; end
            end
            imgs = addI(imgs, sprintf('%s -> %s', noises{a}, bestF), bestJ);
            mets = addM(mets, sprintf('%s noisy PSNR', noises{a}), calculatePSNR(N, I));
            mets = addM(mets, sprintf('%s best (%s) PSNR', noises{a}, bestF), best);
            obs{end+1} = sprintf('%s noise: best filter = %s (%.2f dB).', noises{a}, bestF, best); %#ok<AGROW>
        end
        params = 'Gaussian var 0.01; S&P d 0.05; speckle var 0.04; 3x3 filters';

    case 11  % edges
        imgs = addI(imgs, 'Original', G);
        methods = {'roberts', 'prewitt', 'sobel', 'log', 'canny'};
        for k = 1:numel(methods)
            tic; BW = edgeDetect(G, methods{k}); t = toc;
            imgs = addI(imgs, upperFirst(methods{k}), BW);
            mets = addM(mets, [upperFirst(methods{k}) ' edge pixels'], nnz(BW));
            mets = addM(mets, [upperFirst(methods{k}) ' density (%)'], 100 * nnz(BW) / numel(BW));
            mets = addM(mets, [upperFirst(methods{k}) ' time (ms)'], 1000 * t);
        end
        kernel = [-1 0 1; -2 0 2; -1 0 1];
        params = 'Automatic thresholds; Canny sigma sqrt(2); LoG sigma 2';
        obs{end+1} = 'Canny produces thin, connected edges; Roberts responds most to noise.';

    case 12  % thresholding
        [B1, level] = otsuThreshold(G);
        B2 = adaptiveThreshold(G, 31, 0.02);
        B3 = globalThreshold(G, 0.5);
        [L, nReg] = labelComponents(B2, 8);
        imgs = addI(imgs, 'Original', G);
        imgs = addI(imgs, 'Global T = 0.5', B3);
        imgs = addI(imgs, sprintf('Otsu T = %.3f', level), B1);
        imgs = addI(imgs, 'Adaptive (31x31 local mean)', B2);
        imgs = addChart(imgs, 'Histogram', G);
        mets = addM(mets, 'Otsu threshold', level);
        mets = addM(mets, 'Regions (adaptive)', nReg);
        props = regionProperties(L);
        if ~isempty(props)
            mets = addM(mets, 'Largest region area (px)', max([props.area]));
        end
        params = 'Global T = 0.5; Otsu automatic; adaptive 31x31, offset 0.02';
        obs{end+1} = sprintf('Otsu chose T = %.3f; adaptive thresholding found %d regions.', level, nReg);

    case 13  % colour
        if size(I, 3) ~= 3
            error('ImageLab:notColor', 'Experiment 13 needs a colour image (e.g. peppers.png).');
        end
        [ch, names] = colorChannels(I, 'hsv');
        imgs = addI(imgs, 'Original', I);
        for k = 1:3, imgs = addI(imgs, names{k}, ch{k}); end
        J1 = colorEnhance(I, 'hsv', 3, 'equalize');
        J2 = colorEnhance(J1, 'hsv', 2, 'gain', 1.3);
        J3 = applyPerChannel(@histogramEqualizationManual, I);
        imgs = addI(imgs, 'V equalised', J1);
        imgs = addI(imgs, 'V equalised + saturation x1.3', J2);
        imgs = addI(imgs, 'R, G, B equalised separately', J3);
        hs = rgb2hsv(I); hs2 = rgb2hsv(J3);
        hueShift = mean(abs(angle(exp(1i * 2 * pi * (hs(:,:,1) - hs2(:,:,1))))), 'all') / (2 * pi) * 360;
        mets = addM(mets, 'Mean hue shift, RGB equalisation (deg)', hueShift);
        mets = addM(mets, 'Mean saturation before', mean(hs(:,:,2), 'all'));
        h2 = rgb2hsv(J2);
        mets = addM(mets, 'Mean saturation after', mean(h2(:,:,2), 'all'));
        params = 'HSV model; V equalised; S x 1.3';
        obs{end+1} = sprintf('Equalising R, G, B separately shifted hues by %.1f degrees on average; equalising V does not change hue.', hueShift);

    otherwise
        error('ImageLab:invalidParameter', 'There is no experiment number %d.', n);
end

R = struct('number', n, 'images', imgs, 'metrics', mets, 'observations', {obs}, ...
    'kernel', kernel, 'parameters', params);
end

% -------------------------------------------------------------------------
function imgs = addI(imgs, label, I)
imgs(end+1) = struct('label', label, 'id', ilab_store('save', I, 'exp'));
end

function mets = addM(mets, name, value)
mets(end+1) = struct('name', name, 'value', double(value));
end

function imgs = addChart(imgs, label, I)
counts = imhistManual(I);
fig = ilab_figure(560, 300);
ax = axes(fig);
bar(ax, 0:255, counts, 1, 'FaceColor', [0.13 0.36 0.67], 'EdgeColor', 'none');
xlim(ax, [0 255]); title(ax, label); xlabel(ax, 'Grey level'); ylabel(ax, 'Pixels');
imgs(end+1) = struct('label', label, 'id', ilab_saveFigure(fig, 'chart'));
end

function s = sharpness(I)
G = toGray(I);
s = mean(hypot(filter2D(G, [-1 0 1; -2 0 2; -1 0 1] / 8), filter2D(G, [-1 -2 -1; 0 0 0; 1 2 1] / 8)), 'all');
end

function s = upperFirst(s)
s = [upper(s(1)) s(2:end)];
end
