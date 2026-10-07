function J = claheManual(G, numTiles, clipLimit)
%CLAHEMANUAL Contrast-Limited Adaptive Histogram Equalisation (manual).
%   J = claheManual(G, numTiles, clipLimit)
%
%   1. Divide the image into numTiles(1) x numTiles(2) tiles (contextual regions).
%   2. Compute the histogram of every tile.
%   3. CLIP each histogram at clipLimit and redistribute the excess counts
%      evenly - this limits how much noise in flat areas gets amplified.
%   4. Turn every clipped histogram into an equalisation mapping (its CDF).
%   5. For each pixel, bilinearly interpolate between the mappings of the
%      four nearest tile centres - this removes visible tile borders.
%
%   clipLimit is normalised (0..1) like adapthisteq's ClipLimit (default 0.01).

if nargin < 2 || isempty(numTiles), numTiles = [8 8]; end
if nargin < 3 || isempty(clipLimit), clipLimit = 0.01; end
if isscalar(numTiles), numTiles = [numTiles numTiles]; end
if any(numTiles < 2) || clipLimit < 0 || clipLimit > 1
    error('ImageLab:invalidParameter', 'Use at least 2x2 tiles and a clip limit between 0 and 1.');
end

G = toUint8(toGray(G));
[h, w] = size(G);
nBins = 256;
tileH = ceil(h / numTiles(1));
tileW = ceil(w / numTiles(2));
padded = padImage(G, 0, 0, 'replicate');            % copy
padded(end+1:numTiles(1)*tileH, :) = repmat(padded(end, :), numTiles(1)*tileH - h, 1);
padded(:, end+1:numTiles(2)*tileW) = repmat(padded(:, end), 1, numTiles(2)*tileW - w);

pixPerTile = tileH * tileW;
minClip = ceil(pixPerTile / nBins);
actualClip = minClip + round(clipLimit * (pixPerTile - minClip));

maps = zeros(nBins, numTiles(1), numTiles(2));
for ty = 1:numTiles(1)
    for tx = 1:numTiles(2)
        tile = padded((ty-1)*tileH + (1:tileH), (tx-1)*tileW + (1:tileW));
        counts = accumarray(double(tile(:)) + 1, 1, [nBins 1]);   % 2
        excess = sum(max(counts - actualClip, 0));               % 3
        counts = min(counts, actualClip) + excess / nBins;
        cdf = cumsum(counts) / sum(counts);                      % 4
        maps(:, ty, tx) = cdf;
    end
end

% 5. Bilinear interpolation between tile mappings
[cc, rr] = meshgrid(1:w, 1:h);
fy = (rr - 0.5) / tileH - 0.5;            % position in "tile-centre" units
fx = (cc - 0.5) / tileW - 0.5;
fy = min(max(fy, 0), numTiles(1) - 1);
fx = min(max(fx, 0), numTiles(2) - 1);
y0 = floor(fy); y1 = min(y0 + 1, numTiles(1) - 1); ay = fy - y0;
x0 = floor(fx); x1 = min(x0 + 1, numTiles(2) - 1); ax = fx - x0;
v = double(G) + 1;
lookup = @(ty, tx) maps(sub2ind(size(maps), v, ty + 1, tx + 1));
J = (1 - ay) .* ((1 - ax) .* lookup(y0, x0) + ax .* lookup(y0, x1)) + ...
         ay  .* ((1 - ax) .* lookup(y1, x0) + ax .* lookup(y1, x1));
end
