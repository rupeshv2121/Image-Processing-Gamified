function [out, steps] = manualCorrelation(I, K, shape, padMode)
%MANUALCORRELATION Spatial correlation with every step recorded.
%   [out, steps] = manualCorrelation(I, K, shape, padMode)
%
%   CORRELATION slides the kernel over the image WITHOUT flipping it. At each
%   position the overlapping values are multiplied element-by-element and
%   summed:
%
%       g(x,y) = sum_s sum_t  w(s,t) * f(x+s, y+t)
%
%   shape   : 'same' (default, output size = input size)
%             'valid' (only positions where the kernel fits completely)
%             'full'  (every position where the kernel overlaps the image)
%   padMode : 'zero' (default) or 'replicate' - values used outside the image
%
%   steps(n) describes kernel position n:
%       .row, .col   output position
%       .window      image values under the kernel
%       .products    window .* K
%       .sum         sum of the products (= out(row,col))
%
%   Checks: for zero padding, out equals filter2(K, I, shape).

if nargin < 3 || isempty(shape), shape = 'same'; end
if nargin < 4 || isempty(padMode), padMode = 'zero'; end
if ~isnumeric(I) || ~ismatrix(I) || isempty(I)
    error('ImageLab:invalidMatrix', 'The input must be a non-empty 2-D numeric matrix.');
end
I = double(I);
K = validateKernel(K);
[kh, kw] = size(K);
[h, w] = size(I);

switch lower(shape)
    case 'same',  pr = floor(kh/2); pc = floor(kw/2);
    case 'full',  pr = kh - 1;      pc = kw - 1;
    case 'valid', pr = 0;           pc = 0;
    otherwise
        error('ImageLab:invalidParameter', 'shape must be same, valid or full.');
end

P = padImage(I, pr, pc, padMode);
outRows = size(P, 1) - kh + 1;
outCols = size(P, 2) - kw + 1;
if outRows < 1 || outCols < 1
    error('ImageLab:invalidKernelSize', ...
        'The kernel (%dx%d) is larger than the image (%dx%d) for a "valid" result.', ...
        kh, kw, h, w);
end

out = zeros(outRows, outCols);
recordSteps = nargout > 1;
if recordSteps
    steps = repmat(struct('row', 0, 'col', 0, 'window', [], ...
        'products', [], 'sum', 0), outRows * outCols, 1);
end

n = 0;
for i = 1:outRows                 % move the kernel row by row ...
    for j = 1:outCols             % ... and column by column
        window   = P(i:i+kh-1, j:j+kw-1);   % values under the kernel
        products = window .* K;             % element-wise multiplication
        total    = sum(products(:));        % sum of products
        out(i, j) = total;
        if recordSteps
            n = n + 1;
            steps(n) = struct('row', i, 'col', j, 'window', window, ...
                'products', products, 'sum', total);
        end
    end
end
end
