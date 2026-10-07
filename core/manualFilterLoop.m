function J = manualFilterLoop(I, K, padMode)
%MANUALFILTERLOOP Linear spatial filtering written with explicit loops.
%   J = manualFilterLoop(I, K) slides kernel K over every pixel of I and
%   computes the sum of products (correlation). This is the educational,
%   step-by-step version of filter2D/imfilter.
%
%   Algorithm, for each pixel (i,j):
%     1. extract the neighbourhood the same size as K, centred on (i,j)
%     2. multiply it element-by-element with K
%     3. add up the products
%     4. store the sum as the output pixel

if nargin < 3 || isempty(padMode), padMode = 'replicate'; end
I = toDouble(I);
K = validateKernel(K);
[kh, kw] = size(K);
pr = floor(kh/2);
pc = floor(kw/2);
[h, w, nc] = size(I);
J = zeros(h, w, nc);

for c = 1:nc
    P = padImage(I(:,:,c), pr, pc, padMode);
    for i = 1:h
        for j = 1:w
            window = P(i:i+kh-1, j:j+kw-1);       % step 1
            products = window .* K;              % step 2
            J(i,j,c) = sum(products(:));         % steps 3 and 4
        end
    end
end
end
