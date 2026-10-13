function S = medianSteps(A, k)
%MEDIANSTEPS Every step of a k-by-k median filter on a small matrix (for animation).
%   S = medianSteps(A, k) returns
%     S.padded  - A padded symmetrically by (k-1)/2 (as medianFilterManual does)
%     S.pad     - the padding width
%     S.steps   - one struct per output pixel: row, col, window (k-by-k),
%                 values (window(:) in reading order), sorted, median, position
%     S.output  - the filtered matrix (identical to medianFilterManual(A, k))
%
%   For each pixel: take the window, sort its values, the middle one wins.

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
A = double(A);
checkSmall(A);
r = (k - 1) / 2;
P = padImage(A, r, r, 'symmetric');
[h, w] = size(A);
mid = (k * k + 1) / 2;
steps = cell(1, h * w);
out = zeros(h, w);
n = 0;
for i = 1:h
    for j = 1:w
        win = P(i:i+k-1, j:j+k-1);
        vals = reshape(win.', 1, []);        % reading order: row by row
        sorted = sort(vals);
        out(i, j) = sorted(mid);
        n = n + 1;
        steps{n} = struct('row', i, 'col', j, 'window', ilab_mat(win), 'values', vals, ...
            'sorted', sorted, 'median', sorted(mid), 'position', mid);
    end
end
assert(isequal(out, medianFilterManual(A, k)), 'medianSteps must match medianFilterManual');
S = struct('padded', ilab_mat(P), 'pad', r, 'k', k, 'steps', {steps}, 'output', ilab_mat(out));
end

function checkSmall(A)
if ~ismatrix(A) || isempty(A) || numel(A) > 144
    error('ImageLab:invalidMatrix', 'Use a matrix of at most 12x12 values for the step-by-step view.');
end
end
