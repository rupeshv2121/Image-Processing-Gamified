function P = padImage(I, padRows, padCols, mode)
%PADIMAGE Pad an image on all four sides (base-MATLAB version of padarray).
%   P = padImage(I, padRows, padCols, mode) adds padRows rows above and below
%   and padCols columns left and right of every channel of I.
%
%   mode:
%     'zero'      - pad with 0
%     'replicate' - repeat the border pixel            (default)
%     'symmetric' - mirror the image across its border
%
%   Example (replicate, 1 pixel):
%       1 2        1 1 2 2
%       3 4   ->   1 1 2 2
%                  3 3 4 4
%                  3 3 4 4

if nargin < 4 || isempty(mode)
    mode = 'replicate';
end
[h, w, ~] = size(I);

switch lower(mode)
    case 'zero'
        P = zeros(h + 2*padRows, w + 2*padCols, size(I, 3), 'like', I);
        P(padRows+1:padRows+h, padCols+1:padCols+w, :) = I;
        return
    case 'replicate'
        rowIdx = min(max(1-padRows:h+padRows, 1), h);
        colIdx = min(max(1-padCols:w+padCols, 1), w);
    case 'symmetric'
        rowIdx = mirrorIndex(1-padRows:h+padRows, h);
        colIdx = mirrorIndex(1-padCols:w+padCols, w);
    otherwise
        error('ImageLab:invalidPadding', ...
            'Unknown padding mode "%s". Use zero, replicate or symmetric.', mode);
end
P = I(rowIdx, colIdx, :);
end

function idx = mirrorIndex(idx, n)
% Map out-of-range indices back into 1..n by reflecting at the borders.
period = 2 * n;
idx = mod(idx - 1, period);
flip = idx >= n;
idx(flip) = period - 1 - idx(flip);
idx = idx + 1;
end
