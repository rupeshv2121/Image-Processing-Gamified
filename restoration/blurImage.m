function g = blurImage(f, h)
%BLURIMAGE Linear, position-invariant degradation  g = h * f  (convolution).
%   g = blurImage(f, h) convolves every channel of f with the PSF h.
%   Convolution = correlation with the kernel rotated by 180 degrees.
%   Symmetric padding avoids dark borders.
%       g = imfilter(f, h, 'conv', 'symmetric');     % toolbox

g = filter2D(f, rot90(h, 2), 'symmetric');
end
