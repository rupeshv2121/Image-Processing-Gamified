function [H, E, stats] = errorMap(A, ref)
%ERRORMAP Per-pixel absolute error |A - ref| as a colour heat map.
%   [H, E, stats] = errorMap(A, ref)
%
%   E      - absolute error per pixel (averaged over the colour channels), 0..1
%   H      - RGB heat map of E: dark blue = no change, red = largest change.
%            The colours are scaled to the largest error so small
%            differences are still visible (stats.scaleMax gives the scale).
%   stats  - meanAbs, maxError, scaleMax (grey levels 0..255),
%            changedPct (% of pixels that differ by at least 1 grey level),
%            mse, psnr and colorStops (hex colours of the scale)

A = toDouble(A);
ref = toDouble(ref);
if size(A, 1) ~= size(ref, 1) || size(A, 2) ~= size(ref, 2)
    error('ImageLab:sizeMismatch', ...
        'The two images have different sizes (%dx%d vs %dx%d), so they cannot be compared pixel by pixel.', ...
        size(A, 1), size(A, 2), size(ref, 1), size(ref, 2));
end
if size(A, 3) ~= size(ref, 3)              % colour vs grayscale: compare luminance
    A = toGray(A);
    ref = toGray(ref);
end

E = mean(abs(A - ref), 3);
scale = max(E(:));
cmap = turbo(256);
if scale < eps
    idx = ones(size(E));
else
    idx = 1 + round(255 * E / scale);
end
H = reshape(cmap(idx, :), [size(E) 3]);

q = imageQuality(A, ref);
stops = cmap(round(linspace(1, 256, 9)), :);
stats = struct('meanAbs', 255 * mean(E(:)), 'maxError', 255 * scale, 'scaleMax', 255 * scale, ...
    'changedPct', 100 * mean(E(:) >= 0.5 / 255), ...
    'mse', q.mse, 'psnr', q.psnr, ...
    'colorStops', {cellstr(reshape(sprintf('#%02x%02x%02x', round(255 * stops')), 7, []).')'});
end
