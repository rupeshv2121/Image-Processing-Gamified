function J = filter2D(I, K, padMode)
%FILTER2D Fast spatial correlation of an image with a kernel.
%   J = filter2D(I, K, padMode) computes, for every pixel,
%
%       J(x,y) = sum_s sum_t K(s,t) * I(x+s, y+t)
%
%   which is CORRELATION (the kernel is not flipped) - the same operation as
%   imfilter's default. The output has the same size as the input.
%
%   Uses imfilter when the Image Processing Toolbox is available. Otherwise
%   it pads the image and calls the base-MATLAB conv2 with the kernel rotated
%   by 180 degrees (convolution with a flipped kernel == correlation).
%
%   padMode: 'replicate' (default), 'zero' or 'symmetric'.

if nargin < 3 || isempty(padMode), padMode = 'replicate'; end
I = toDouble(I);
K = validateKernel(K);

if hasIPT()
    if strcmpi(padMode, 'zero')
        J = imfilter(I, K, 0, 'corr', 'same');
    else
        J = imfilter(I, K, padMode, 'corr', 'same');
    end
    return
end

[kh, kw] = size(K);
J = zeros(size(I));
for c = 1:size(I, 3)
    P = padImage(I(:,:,c), floor(kh/2), floor(kw/2), padMode);
    J(:,:,c) = conv2(P, rot90(K, 2), 'valid');
end
end
