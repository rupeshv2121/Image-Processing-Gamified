function data = analysisOps(op, p)
%ANALYSISOPS Histogram and intensity transformations, edges and edge
%   linking, segmentation, regions and their descriptors, colour and
%   pseudocolour, neighbourhoods and the step-by-step animations.
%   data = analysisOps(op, p) - called by ilab_dispatch for:
%   histogram, bitPlanes, edges, edgeLink, segment, regions,
%   describeRegion, color, colorEnhance, pseudocolor, neighborhood, steps

switch op
    case 'histogram'
        I = ilab_img(p);
        method = char(ilab_param(p, 'method', 'histeq'));
        [J, mapping, implementation, target] = histogramMethod(I, method, p);
        data = struct('id', ilab_put(J, method), ...
            'histBefore', imhistManual(I), 'histAfter', imhistManual(J), ...
            'statsBefore', imageStatistics(I), 'statsAfter', imageStatistics(J), ...
            'mapping', {mapping}, 'implementation', implementation, 'target', {target});

    case 'bitPlanes'
        keep = ilab_param(p, 'keep', 5:8);
        [planes, R] = bitPlaneSlicing(ilab_img(p), keep);
        G = toGray(ilab_img(p));
        ids = cellfun(@(b) ilab_put(b, 'bitplane'), planes, 'UniformOutput', false);
        data = struct('planes', {ids}, 'id', ilab_put(R, 'bits'), 'keep', {num2cell(keep(:)')}, ...
            'psnr', calculatePSNR(R, toDouble(toUint8(G))), ...
            'ones', cellfun(@(b) 100 * mean(b(:)), planes));

    case 'edges'
        data = edges(ilab_img(p), p);

    case 'edgeLink'
        data = edgeLinking(ilab_img(p), p);

    case 'segment'
        data = segmentImage(ilab_img(p), p);

    case 'regions'
        data = regionAnalysis(ilab_img(p), p);

    case 'describeRegion'
        data = describeRegion(ilab_img(p), p);

    case 'color'
        I = ilab_img(p);
        [ch, names] = colorChannels(I, char(ilab_param(p, 'space', 'rgb')));
        channels = cell(1, numel(ch));
        for k = 1:numel(ch)
            channels{k} = struct('name', names{k}, 'id', ilab_put(ch{k}, 'ch'), ...
                'mean', mean(ch{k}(:)), 'std', std(ch{k}(:)));
        end
        data = struct('channels', {channels});

    case 'colorEnhance'
        J = colorEnhance(ilab_img(p), char(ilab_param(p, 'space', 'hsv')), ilab_param(p, 'channel', 2), ...
            char(ilab_param(p, 'operation', 'gain')), ilab_param(p, 'amount', 1.3));
        data = struct('id', ilab_put(J, 'color'));

    case 'pseudocolor'
        I = ilab_img(p);
        if strcmp(char(ilab_param(p, 'method', 'slicing')), 'transform')
            f = ilab_param(p, 'frequency', 1);
            ph = ilab_param(p, 'phases', [0 60 120]) * pi / 180;
            [J, curves] = grayToColor(I, f, ph);
            data = struct('id', ilab_put(J, 'pseudo'), 'curves', ...
                struct('r', round(255 * curves(:, 1)'), 'g', round(255 * curves(:, 2)'), 'b', round(255 * curves(:, 3)')));
        else
            [J, colors, limits] = intensitySlicing(I, ilab_param(p, 'slices', 8), char(ilab_param(p, 'map', 'jet')));
            hex = arrayfun(@(k) sprintf('#%02x%02x%02x', round(255 * colors(k, :))), 1:size(colors, 1), 'UniformOutput', false);
            data = struct('id', ilab_put(J, 'pseudo'), 'colors', {hex}, 'edges', round(255 * limits));
        end
        data.grayId = ilab_put(toGray(I), 'gray');

    case 'neighborhood'
        V = double(ilab_param(p, 'matrix', zeros(5)));
        info = pixelNeighborhood(V, ilab_param(p, 'row', 3), ilab_param(p, 'col', 3), double(ilab_param(p, 'valueSet', 1)));
        data = struct('N4', {pts(info.N4)}, 'ND', {pts(info.ND)}, 'N8', {pts(info.N8)}, ...
            'adjacent4', {pts(info.adjacent4)}, 'adjacent8', {pts(info.adjacent8)}, ...
            'adjacentM', {pts(info.adjacentM)}, 'centerInSet', info.centerInSet, ...
            'euclidean', ilab_mat(info.euclidean), 'cityBlock', ilab_mat(info.cityBlock), ...
            'chessboard', ilab_mat(info.chessboard));

    case 'steps'
        A = double(ilab_param(p, 'matrix', magic(5)));
        switch char(ilab_param(p, 'algorithm', 'median'))
            case 'median',     data = medianSteps(A, ilab_param(p, 'k', 3));
            case 'histeq',     data = histeqSteps(A, ilab_param(p, 'levels', 8));
            case 'regiongrow'
                data = regionGrowingSteps(A, ilab_param(p, 'seedRow', 1), ilab_param(p, 'seedCol', 1), ...
                    ilab_param(p, 'tolerance', 10), ilab_param(p, 'conn', 8));
            otherwise
                error('ImageLab:invalidParameter', 'Unknown animation "%s".', char(ilab_param(p, 'algorithm', '')));
        end

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
% Histogram lab
function [J, mapping, implementation, target] = histogramMethod(I, method, p)
ramp = (0:255)' / 255;
mapping = [];
target = [];
implementation = 'Manual (base MATLAB)';
switch method
    case 'none'
        J = I;
        mapping = 0:255;
    case 'histeq'
        J = histogramEqualization(I);
        if hasIPT(), implementation = 'histeq (Image Processing Toolbox)'; end
        if size(I, 3) == 1, [~, mapping] = histogramEqualizationManual(I); end
    case 'histeqManual'
        [~, mapping] = histogramEqualizationManual(toGray(I));
        J = applyToLuminance(@histogramEqualizationManual, I);
    case 'stretch'
        [J, limits] = contrastStretch(I, ilab_param(p, 'low', []), ilab_param(p, 'high', []));
        mapping = round(255 * min(max((ramp - limits(1)) / (limits(2) - limits(1)), 0), 1));
        if hasIPT(), implementation = 'imadjust (Image Processing Toolbox)'; end
    case 'gamma'
        g = ilab_param(p, 'gamma', 0.5);
        J = gammaCorrection(I, g);
        mapping = round(255 * gammaCorrection(ramp, g));
    case 'log'
        k = ilab_param(p, 'k', 10);
        J = logTransform(I, k);
        mapping = round(255 * logTransform(ramp, k));
    case 'negative'
        J = negativeTransform(I);
        mapping = round(255 * negativeTransform(ramp));
    case 'match'
        shape = char(ilab_param(p, 'shape', 'gaussian'));
        if strcmp(shape, 'sample')
            name = char(ilab_param(p, 'refSample', 'peppers.png'));
            generateSampleImages(false);
            ref = toDouble(imread(sampleImages('path', name)));
            if size(ref, 3) == 4, ref = ref(:,:,1:3); end
            target = imhistManual(ref);
        else
            target = targetHistogram(shape, ilab_param(p, 'targetMean', 0.5), ilab_param(p, 'targetStd', 0.15));
        end
        [J, mapping] = histogramMatching(I, target);
        target = round(target / max(target) * 1e4);  % scaled for plotting
        target = num2cell(target(:)');
    case 'piecewise'
        pts = [ilab_param(p, 'r1', 0.3), ilab_param(p, 's1', 0.1), ilab_param(p, 'r2', 0.7), ilab_param(p, 's2', 0.9)];
        J = piecewiseLinear(I, pts(1), pts(2), pts(3), pts(4));
        mapping = round(255 * piecewiseLinear(ramp, pts(1), pts(2), pts(3), pts(4)));
    case 'slice'
        a = ilab_param(p, 'a', 0.4); b = ilab_param(p, 'b', 0.6);
        mode = char(ilab_param(p, 'sliceMode', 'binary'));
        J = grayLevelSlicing(I, a, b, mode);
        mapping = round(255 * grayLevelSlicing(ramp, a, b, mode));
    otherwise
        error('ImageLab:invalidParameter', 'Unknown histogram method "%s".', method);
end
if ~isempty(mapping), mapping = num2cell(mapping(:)'); end
end

% =========================================================================
% Edge lab
function data = edges(I, p)
methods = cellstr(ilab_param(p, 'methods', {'sobel'}));
thresh = ilab_param(p, 'thresh', []);
results = cell(1, numel(methods));
for n = 1:numel(methods)
    m = methods{n};
    tic;
    [BW, used, mag, implementation] = edgeDetect(I, m, thresh, ilab_param(p, 'sigma', []));
    t = 1000 * toc;
    results{n} = struct('method', m, 'id', ilab_put(BW, 'edge'), 'magId', ilab_put(mag, 'mag'), ...
        'edgePixels', nnz(BW), 'density', 100 * nnz(BW) / numel(BW), 'timeMs', t, ...
        'threshold', used, 'implementation', implementation);
end
data = struct('results', {results});
if logical(ilab_param(p, 'manualGradients', false))
    tic; [mag, gx, gy] = sobelManual(I); tS = 1000 * toc;
    tic; [magP, gxP, gyP] = prewittManual(I); tP = 1000 * toc;
    data.manual = struct( ...
        'sobel', struct('gx', ilab_put(scaleToUnit(gx), 'gx'), 'gy', ilab_put(scaleToUnit(gy), 'gy'), ...
                        'mag', ilab_put(min(mag / 4, 1), 'mag'), 'timeMs', tS), ...
        'prewitt', struct('gx', ilab_put(scaleToUnit(gxP), 'gx'), 'gy', ilab_put(scaleToUnit(gyP), 'gy'), ...
                          'mag', ilab_put(min(magP / 3, 1), 'mag'), 'timeMs', tP));
end
end

% =========================================================================
% Segmentation lab
function data = segmentImage(I, p)
G = toGray(I);
method = char(ilab_param(p, 'method', 'otsu'));
level = [];
extraId = '';
L = [];
switch method
    case 'global'
        level = ilab_param(p, 'threshold', 0.5);
        BW = globalThreshold(G, level);
    case 'iterative'
        [BW, level] = iterativeThreshold(G);
    case 'otsu'
        [BW, level] = otsuThreshold(G);
    case 'adaptive'
        [BW, localMean] = adaptiveThreshold(G, ilab_param(p, 'window', 25), ilab_param(p, 'offset', 0.02));
        extraId = ilab_put(localMean, 'localmean');
    case 'point'
        [BW, R] = pointDetection(G, ilab_param(p, 'threshold', 0.9));
        extraId = ilab_put(min(abs(R) / max(max(abs(R(:))), eps), 1), 'response');
    case 'line'
        [BW, R] = lineDetection(G, char(ilab_param(p, 'direction', 'horizontal')), ilab_param(p, 'threshold', 0.5));
        extraId = ilab_put(R / max(max(R(:)), eps), 'response');
    case 'regiongrow'
        [h, w] = size(G);
        BW = regionGrowing(G, ilab_param(p, 'seedRow', round(h / 2)), ilab_param(p, 'seedCol', round(w / 2)), ...
            ilab_param(p, 'tolerance', 0.1), ilab_param(p, 'conn', 8));
    case 'splitmerge'
        [L, meanImage] = splitAndMerge(G, ilab_param(p, 'stdThreshold', 0.05), ilab_param(p, 'minBlock', 8), ...
            ilab_param(p, 'mergeThreshold', 0.08));
        B = false(size(L));
        B(:, 1:end-1) = L(:, 1:end-1) ~= L(:, 2:end);
        B(1:end-1, :) = B(1:end-1, :) | L(1:end-1, :) ~= L(2:end, :);
        extraId = ilab_put(meanImage, 'regions');
        BW = B;
    otherwise
        error('ImageLab:invalidParameter', 'Unknown segmentation method "%s".', method);
end

if isempty(L)
    [L, n] = labelComponents(BW, 8);
else
    n = max(L(:));
end
props = regionProperties(L);
if ~isempty(props)
    [~, order] = sort([props.area], 'descend');
    props = props(order(1:min(15, numel(order))));
end

% Overlay: segmented pixels tinted green, boundaries red
base = repmat(G, 1, 1, 3);
tint = cat(3, zeros(size(G)), ones(size(G)), zeros(size(G)));
mask = repmat(BW, 1, 1, 3);
overlay = base;
overlay(mask) = 0.55 * base(mask) + 0.45 * tint(mask);
edgeMask = extractBoundary(BW);
for c = 1:3
    ch = overlay(:, :, c);
    ch(edgeMask) = double(c == 1);
    overlay(:, :, c) = ch;
end

data = struct('id', ilab_put(BW, 'bw'), 'overlayId', ilab_put(overlay, 'overlay'), ...
    'extraId', extraId, 'threshold', level, ...
    'foreground', 100 * nnz(BW) / numel(BW), 'regions', n, 'props', {ilab_list(props)}, ...
    'histogram', imhistManual(G));
end

% =========================================================================
% Edge linking and boundary detection
function data = edgeLinking(I, p)
G = toGray(I);
if strcmp(char(ilab_param(p, 'method', 'hough')), 'local')
    TM = ilab_param(p, 'magnitude', 0.3);
    TA = ilab_param(p, 'angle', 45);
    K = round(ilab_param(p, 'gap', 5));
    tic;
    [linked, cand, M] = localEdgeLinking(G, TM, TA, K);
    t = 1000 * toc;
    added = linked & ~cand;
    % candidates white, pixels added by gap filling green
    overlay = cat(3, double(cand), double(cand | added), double(cand));
    data = struct('method', 'local', 'magId', ilab_put(M / max(max(M(:)), eps), 'mag'), ...
        'candidatesId', ilab_put(cand, 'candidates'), 'id', ilab_put(linked, 'linked'), ...
        'overlayId', ilab_put(overlay, 'linking'), 'candidates', nnz(cand), 'linked', nnz(linked), ...
        'added', nnz(added), 'timeMs', t);
    return
end

detector = char(ilab_param(p, 'detector', 'canny'));
BW = logical(edgeDetect(G, detector, [], ilab_param(p, 'sigma', [])));
tic;
[H, theta, rho] = houghTransform(BW, 1);
peaks = houghPeaks(H, round(ilab_param(p, 'peaks', 8)), ilab_param(p, 'threshold', 0.3) * max(H(:)));
lines = houghLines(BW, theta, rho, peaks, ilab_param(p, 'fillGap', 5), ilab_param(p, 'minLength', 20));
t = 1000 * toc;

% overlay: dimmed image, edges grey, linked line segments red, ends yellow
base = 0.45 * G;
base(BW) = 0.75;
C = repmat(base, 1, 1, 3);
segs = cell(1, numel(lines));
for k = 1:numel(lines)
    a = lines(k).point1; b = lines(k).point2;
    C = drawSegment(C, [a(2) a(1)], [b(2) b(1)], [1 0.15 0.15], 1);
    C = paintPixels(C, [a(2) a(1); b(2) b(1)], [1 0.85 0], 2);
    segs{k} = struct('x1', a(1), 'y1', a(2), 'x2', b(1), 'y2', b(2), ...
        'length', lines(k).length, 'theta', lines(k).theta, 'rho', lines(k).rho);
end

% accumulator: log scale, theta across, rho down; peaks marked red
A = log(1 + H);
A = A / max(max(A(:)), eps);
f = max(1, floor(360 / numel(theta)));
acc = repmat(repelem(A, 1, f), 1, 1, 3);
list = cell(1, size(peaks, 1));
for k = 1:size(peaks, 1)
    acc = paintPixels(acc, [peaks(k, 1), (peaks(k, 2) - 0.5) * f + 0.5], [1 0.2 0.2], 4);
    list{k} = struct('rho', rho(peaks(k, 1)), 'theta', theta(peaks(k, 2)), 'votes', H(peaks(k, 1), peaks(k, 2)));
end
data = struct('method', 'hough', 'edgeId', ilab_put(BW, 'edges'), 'id', ilab_put(C, 'hough'), ...
    'accumulatorId', ilab_put(acc, 'accumulator'), 'peaks', {list}, 'lines', {segs}, ...
    'edgePixels', nnz(BW), 'maxVotes', max(H(:)), 'rhoRange', [rho(1) rho(end)], 'timeMs', t);
end

function C = drawSegment(C, p1, p2, color, width)
% Line from p1 to p2 ([row col]), sampled every quarter pixel
n = max(2, ceil(4 * hypot(p2(1) - p1(1), p2(2) - p1(2))));
pts = [linspace(p1(1), p2(1), n)', linspace(p1(2), p2(2), n)'];
C = paintPixels(C, pts, color, width);
end

function C = paintPixels(C, pts, color, radius)
% Colour every pixel within a (square) radius of each [row col] point
[h, w, ~] = size(C);
pts = round(pts);
for dr = -radius + 1:radius - 1
    for dc = -radius + 1:radius - 1
        r = pts(:, 1) + dr; c = pts(:, 2) + dc;
        ok = r >= 1 & r <= h & c >= 1 & c <= w;
        idx = sub2ind([h w], r(ok), c(ok));
        for ch = 1:3
            C(idx + (ch - 1) * h * w) = color(ch);
        end
    end
end
end

% =========================================================================
% Region analysis (representation & description)
function R = labelRegions(I, p)
% Binary image -> the separate regions (8-connected), largest first. Shared
% by the region table and describeRegion, so both number them the same way.
G = toGray(I);
if strcmp(char(ilab_param(p, 'method', 'otsu')), 'global')
    level = ilab_param(p, 'threshold', 0.5);
    BW = G > level;
else
    [BW, level] = otsuThreshold(G);
    BW = logical(BW);
end
if logical(ilab_param(p, 'invert', false)), BW = ~BW; end
minArea = max(1, round(ilab_param(p, 'minArea', 20)));

[L, n] = labelComponents(BW, 8);
areas = accumarray(L(L > 0), 1, [max(n, 1) 1]);
if n == 0, areas = zeros(0, 1); end
[~, byArea] = sort(areas, 'descend');
byArea = byArea(areas(byArea) >= minArea);
R = struct('G', G, 'BW', BW, 'L', L, 'n', n, 'level', level, ...
    'minArea', minArea, 'total', numel(byArea), ...
    'shown', byArea(1:min(40, numel(byArea))));
end

function data = regionAnalysis(I, p)
Rg = labelRegions(I, p);
G = Rg.G; BW = Rg.BW; L = Rg.L; level = Rg.level;
minArea = Rg.minArea; total = Rg.total; shown = Rg.shown;

% Colour every kept region; regions below minArea stay dark grey
% (golden-ratio hue steps keep neighbouring labels clearly different)
palette = zeros(numel(shown), 3);
if ~isempty(shown)
    palette = hsv2rgb([mod((0:numel(shown)-1)' * 0.618034, 1), 0.62 * ones(numel(shown), 1), 0.95 * ones(numel(shown), 1)]);
end
R = 0.25 * G; Gc = R; B = R;
small = BW & ~ismember(L, shown);
R(small) = 0.45; Gc(small) = 0.45; B(small) = 0.45;
regions = cell(1, numel(shown));
for k = 1:numel(shown)
    mask = L == shown(k);
    R(mask) = palette(k, 1); Gc(mask) = palette(k, 2); B(mask) = palette(k, 3);

    [r, c] = find(mask);
    r0 = min(r); r1 = max(r); c0 = min(c); c1 = max(c);
    [code, bnd] = chainCode(mask(r0:r1, c0:c1));
    bnd = bnd + [r0 c0] - 1;
    d = chainCodeDescriptors(code);
    area = numel(r);
    if d.perimeter > 0, circ = 4 * pi * area / d.perimeter^2; else, circ = 1; end
    regions{k} = struct('label', k, 'area', area, ...
        'centroidX', mean(c), 'centroidY', mean(r), ...
        'bboxX', c0, 'bboxY', r0, 'bboxWidth', c1 - c0 + 1, 'bboxHeight', r1 - r0 + 1, ...
        'boundaryPixels', size(bnd, 1), 'perimeter', d.perimeter, ...
        'circularity', min(circ, 1), 'equivDiameter', sqrt(4 * area / pi), ...
        'color', sprintf('#%02x%02x%02x', round(255 * palette(k, :))), ...
        'chainLength', numel(code), 'chain', clip(sprintf('%d', code), 800), ...
        'firstDifference', clip(sprintf('%d', d.firstDifference), 800), ...
        'shapeNumber', clip(sprintf('%d', d.shapeNumber), 800), ...
        'nEven', d.nEven, 'nOdd', d.nOdd, 'startRow', r0, 'startCol', bnd(1, 2), ...
        'cropId', ilab_put(regionCrop(G, mask, bnd, r0, r1, c0, c1), 'region'));
end
data = struct('id', ilab_put(cat(3, R, Gc, B), 'regions'), 'binaryId', ilab_put(BW, 'bw'), ...
    'threshold', level, 'minArea', minArea, 'kept', total, 'shown', numel(shown), ...
    'regions', {regions}, 'implementation', 'chainCode.m (Moore-neighbour boundary tracing)');
end

function data = describeRegion(I, p)
% Signature, polygon, skeleton, moments, Fourier descriptors and texture
% of ONE region, numbered as in the region table (1 = largest)
Rg = labelRegions(I, p);
k = round(ilab_param(p, 'region', 1));
if k < 1 || k > numel(Rg.shown)
    error('ImageLab:invalidParameter', 'Region %d does not exist - label the regions again.', k);
end
mask = Rg.L == Rg.shown(k);
[r, c] = find(mask);
m = 2;
rr = max(1, min(r) - m):min(size(mask, 1), max(r) + m);
cc = max(1, min(c) - m):min(size(mask, 2), max(c) + m);
mk = mask(rr, cc);
g = Rg.G(rr, cc);
[~, bnd] = chainCode(mk);
centroid = [mean(r) - rr(1) + 1, mean(c) - cc(1) + 1];
f = max(1, min(10, floor(220 / max(size(mk)))));
up = @(P) (P - 1) * f + (f + 1) / 2;                % pixel centre after enlarging

[sig, angles] = boundarySignature(bnd, centroid);
tol = ilab_param(p, 'tolerance', 2);
v = polygonApprox(bnd, tol);
poly = baseCrop(g, mk, f);
P = up(bnd(v, :));
for j = 1:numel(v)
    poly = drawSegment(poly, P(j, :), P(mod(j, numel(v)) + 1, :), [1 0.2 0.2], max(1, round(f / 3)));
end
poly = paintPixels(poly, P, [1 0.85 0], max(2, round(f / 2)));

[S, K] = morphSkeleton(mk, ones(3));
[sr, sc] = find(S);
skel = paintPixels(baseCrop(g, mk, f), up([sr sc]), [1 0.2 0.2], max(1, ceil(f / 2)));

nB = size(bnd, 1);
counts = unique(min([4 8 16 32 nB], nB));
fd = cell(1, numel(counts));
for j = 1:numel(counts)
    [~, rebuilt] = fourierDescriptors(bnd, counts(j));
    C = baseCrop(g, mk, f);
    Q = up(rebuilt);
    for q = 1:size(Q, 1)
        C = drawSegment(C, Q(q, :), Q(mod(q, size(Q, 1)) + 1, :), [1 0.2 0.2], 1);
    end
    fd{j} = struct('count', counts(j), 'id', ilab_put(C, 'fourier'));
end
[~, ~, invariant] = fourierDescriptors(bnd);
mo = regionMoments(mk);

data = struct('region', k, 'area', nnz(mk), 'boundaryPoints', nB, ...
    'signature', struct('angles', angles, 'r', sig), ...
    'polygonId', ilab_put(poly, 'polygon'), 'vertices', numel(v), 'tolerance', tol, ...
    'skeletonId', ilab_put(skel, 'skeleton'), 'skeletonPixels', nnz(S), 'skeletonSteps', K, ...
    'fourier', {fd}, 'fourierInvariant', invariant, ...
    'hu', mo.hu, 'huLog', -sign(mo.hu) .* log10(abs(mo.hu) + realmin), ...
    'orientation', mo.orientation, 'majorAxis', mo.majorAxis, 'minorAxis', mo.minorAxis, ...
    'eccentricity', mo.eccentricity, 'texture', textureDescriptors(g, mk));
end

function C = baseCrop(g, k, f)
% Enlarged close-up: the grey image dimmed, the region tinted
R = g * 0.45; Gc = R; B = R;
R(k) = 0.3 + 0.25 * g(k); Gc(k) = 0.5 + 0.25 * g(k); B(k) = 0.45 + 0.25 * g(k);
C = repelem(cat(3, R, Gc, B), f, f, 1);
end

function C = regionCrop(G, mask, bnd, r0, r1, c0, c1)
% Close-up of one region: grey image, region tinted, traced boundary red,
% start pixel yellow. Enlarged with nearest-neighbour so pixels stay visible.
m = 3;
rr = max(1, r0 - m):min(size(G, 1), r1 + m);
cc = max(1, c0 - m):min(size(G, 2), c1 + m);
g = G(rr, cc);
k = mask(rr, cc);
R = g * 0.5; Gc = R; B = R;
R(k) = 0.35 + 0.3 * g(k); Gc(k) = 0.6 + 0.3 * g(k); B(k) = 0.45 + 0.3 * g(k);
idx = sub2ind(size(g), bnd(:, 1) - rr(1) + 1, bnd(:, 2) - cc(1) + 1);
R(idx) = 1; Gc(idx) = 0.15; B(idx) = 0.15;
R(idx(1)) = 1; Gc(idx(1)) = 0.85; B(idx(1)) = 0;
C = cat(3, R, Gc, B);
f = max(1, min(12, floor(160 / max(size(C, 1), size(C, 2)))));
C = repelem(C, f, f, 1);
end

function s = clip(s, n)
if numel(s) > n, s = [s(1:n) '...']; end
end

function c = pts(Pm)
c = arrayfun(@(k) struct('r', Pm(k, 1), 'c', Pm(k, 2)), 1:size(Pm, 1), 'UniformOutput', false);
end
