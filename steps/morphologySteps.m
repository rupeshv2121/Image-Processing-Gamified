function S = morphologySteps(A, SE, op)
%MORPHOLOGYSTEPS Binary erosion or dilation of a small matrix, step by step.
%   S = morphologySteps(A, SE, op)   op = 'erode' (default) or 'dilate'
%
%   For every pixel the structuring element is placed with its origin on the
%   pixel. Erosion: the output is 1 only if EVERY pixel under a 1 of SE is 1
%   (the element FITS). Dilation: the output is 1 if ANY pixel under the
%   reflected element is 1 (the element HITS).
%
%   S.steps: row, col, covered (k-by-k, NaN where SE is 0), misses / hits
%   (positions that decided the result), result. Output = morphologyManual.

if nargin < 3 || isempty(op), op = 'erode'; end
SE = validateSE(SE);
A = double(A ~= 0);
if ~ismatrix(A) || isempty(A) || numel(A) > 144
    error('ImageLab:invalidMatrix', 'Use a matrix of at most 12x12 values for the step-by-step view.');
end
erode = strcmpi(op, 'erode');
used = SE;
if ~erode, used = rot90(SE, 2); end
[kh, kw] = size(used);
pr = (kh - 1) / 2; pc = (kw - 1) / 2;
[h, w] = size(A);
if erode, padValue = 1; else, padValue = 0; end   % = +Inf / -Inf for a binary image
P = padValue * ones(h + 2*pr, w + 2*pc);
P(pr+1:pr+h, pc+1:pc+w) = A;
out = zeros(h, w);
steps = cell(1, h * w);
n = 0;
for i = 1:h
    for j = 1:w
        win = P(i:i+kh-1, j:j+kw-1);
        covered = win;
        covered(~used) = NaN;
        if erode
            decisive = used & win == 0;          % 0s under the element: it does not fit
            res = ~any(decisive(:));
        else
            decisive = used & win == 1;          % 1s under the element: it hits
            res = any(decisive(:));
        end
        out(i, j) = res;
        n = n + 1;
        steps{n} = struct('row', i, 'col', j, 'covered', ilab_mat(covered), ...
            'decisive', ilab_mat(double(decisive)), 'result', double(res));
    end
end
assert(isequal(out, double(morphologyManual(logical(A), SE, lower(op)))), 'morphologySteps must match morphologyManual');
S = struct('padded', ilab_mat(P), 'padRows', pr, 'padCols', pc, 'se', ilab_mat(double(SE)), ...
    'used', ilab_mat(double(used)), 'op', lower(op), 'steps', {steps}, 'output', ilab_mat(out));
end
