function data = analysisOps(op, p)
%ANALYSISOPS Histogram, edges, segmentation, morphology, regions, colour,
%   neighbourhoods and the step-by-step animations.
%   data = analysisOps(op, p) - called by ilab_dispatch for:
%   histogram, edges, segment, morphology, structuringElement, regions,
%   color, colorEnhance, neighborhood, steps

switch op
    case 'histogram'
        I = ilab_img(p);
        method = char(ilab_param(p, 'method', 'histeq'));
        [J, mapping, implementation] = histogramMethod(I, method, p);
        data = struct('id', ilab_put(J, method), ...
            'histBefore', imhistManual(I), 'histAfter', imhistManual(J), ...
            'statsBefore', imageStatistics(I), 'statsAfter', imageStatistics(J), ...
            'mapping', {mapping}, 'implementation', implementation);

    case 'edges'
        data = edges(ilab_img(p), p);

    case 'segment'
        data = segmentImage(ilab_img(p), p);

    case 'structuringElement'
        data = ilab_mat(structuringElement(char(ilab_param(p, 'shape', 'square')), ilab_param(p, 'size', 3)));

    case 'morphology'
        data = morphologyOp(ilab_img(p), p);

    case 'regions'
        data = regionAnalysis(ilab_img(p), p);

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
            case 'morphology'
                data = morphologySteps(A, double(ilab_param(p, 'se', ones(3))), char(ilab_param(p, 'operation', 'erode')));
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
function [J, mapping, implementation] = histogramMethod(I, method, p)
ramp = (0:255)' / 255;
mapping = [];
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
    case 'clahe'
        tiles = ilab_param(p, 'tiles', 8);
        J = clahe(I, [tiles tiles], ilab_param(p, 'clipLimit', 0.01));
        if hasIPT(), implementation = 'adapthisteq (Image Processing Toolbox)'; end
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
    case 'boundary'
        BW = extractBoundary(otsuThreshold(G));
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
% Morphology lab
function data = morphologyOp(I, p)
op = char(ilab_param(p, 'operation', 'erode'));
SE = validateSE(double(ilab_param(p, 'se', ones(3))));
mode = char(ilab_param(p, 'mode', 'binary'));
if any(strcmp(op, {'boundary', 'fill'})), mode = 'binary'; end
level = [];
if strcmp(mode, 'binary')
    [A, level] = otsuThreshold(I);
    A = logical(A);
    if logical(ilab_param(p, 'invert', false)), A = ~A; end
else
    A = toDouble(I);
end
manual = strcmp(char(ilab_param(p, 'impl', 'toolbox')), 'manual');
if manual
    er = @(X) morphologyManual(X, SE, 'erode');
    di = @(X) morphologyManual(X, SE, 'dilate');
else
    er = @(X) erodeImage(X, SE);
    di = @(X) dilateImage(X, SE);
end
tic;
switch op
    case 'erode',    J = er(A);        fname = 'erodeImage';
    case 'dilate',   J = di(A);        fname = 'dilateImage';
    case 'open',     J = di(er(A));    fname = 'openImage';
    case 'close',    J = er(di(A));    fname = 'closeImage';
    case 'boundary', J = A & ~er(A);   fname = 'morphBoundary';
    case 'fill',     J = fillHoles(A); fname = 'fillHoles';
    otherwise
        error('ImageLab:invalidParameter', 'Unknown morphological operation "%s".', op);
end
t = 1000 * toc;
if manual && ~strcmp(op, 'fill'), fname = 'morphologyManual'; end

if islogical(J)
    % Change map: kept object white, removed pixels red, added pixels green
    kept = A & J; removed = A & ~J; added = ~A & J;
    change = 0.04 + 0.92 * cat(3, double(kept | removed), double(kept | added), double(kept));
    [~, nBefore] = labelComponents(A, 8);
    [~, nAfter] = labelComponents(J, 8);
    stats = struct('foregroundBefore', 100 * nnz(A) / numel(A), 'foregroundAfter', 100 * nnz(J) / numel(J), ...
        'regionsBefore', nBefore, 'regionsAfter', nAfter, 'removed', nnz(removed), 'added', nnz(added));
else
    change = min(abs(J - A) * 4, 1);
    stats = struct('meanBefore', 255 * mean(A(:)), 'meanAfter', 255 * mean(J(:)), ...
        'changed', 100 * mean(any(abs(J - A) > 0.5 / 255, 3), 'all'));
end
if strcmp(op, 'fill')
    implementation = 'Connected-component labelling of the background (base MATLAB)';
elseif manual
    implementation = 'Manual implementation (explicit loops)';
elseif hasIPT()
    implementation = 'MATLAB Image Processing Toolbox (imerode / imdilate)';
else
    implementation = 'Vectorised base MATLAB (one shifted min/max per SE element)';
end
data = struct('id', ilab_put(J, op), 'inputId', ilab_put(A, 'morphin'), 'changeId', ilab_put(change, 'change'), ...
    'operation', op, 'mode', mode, 'binary', islogical(J), 'threshold', level, ...
    'se', ilab_mat(SE), 'timeMs', t, 'functionName', fname, 'implementation', implementation, ...
    'stats', stats);
end

% =========================================================================
% Region analysis (representation & description)
function data = regionAnalysis(I, p)
G = toGray(I);
if strcmp(char(ilab_param(p, 'method', 'otsu')), 'global')
    level = ilab_param(p, 'threshold', 0.5);
    BW = G > level;
else
    [BW, level] = otsuThreshold(G);
    BW = logical(BW);
end
if logical(ilab_param(p, 'invert', false)), BW = ~BW; end
conn = ilab_param(p, 'conn', 8);
if ~any(conn == [4 8]), conn = 8; end
minArea = max(1, round(ilab_param(p, 'minArea', 20)));

tic;
[L, n] = labelComponents(BW, conn);
tLabel = 1000 * toc;
areas = accumarray(L(L > 0), 1, [max(n, 1) 1]);
if n == 0, areas = zeros(0, 1); end
[~, byArea] = sort(areas, 'descend');
byArea = byArea(areas(byArea) >= minArea);
total = numel(byArea);
shown = byArea(1:min(40, total));

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
if hasIPT()
    implementation = 'bwlabel (toolbox) + chainCode.m';
else
    implementation = 'labelComponents.m (BFS) + chainCode.m';
end
data = struct('id', ilab_put(cat(3, R, Gc, B), 'labels'), 'binaryId', ilab_put(BW, 'bw'), ...
    'threshold', level, 'conn', conn, 'minArea', minArea, ...
    'components', n, 'kept', total, 'shown', numel(shown), ...
    'labelTimeMs', tLabel, 'regions', {regions}, 'implementation', implementation);
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
