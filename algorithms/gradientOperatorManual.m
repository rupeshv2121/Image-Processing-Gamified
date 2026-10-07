function [mag, gx, gy] = gradientOperatorManual(I, Kx, Ky)
%GRADIENTOPERATORMANUAL First-derivative edge operator written with loops.
%   [mag, gx, gy] = gradientOperatorManual(I, Kx, Ky) correlates the
%   grayscale image with the two 3x3 derivative kernels pixel by pixel:
%
%       gx(i,j) = sum( window .* Kx )      horizontal change
%       gy(i,j) = sum( window .* Ky )      vertical change
%       mag     = sqrt(gx.^2 + gy.^2)      gradient magnitude (edge strength)
%
%   Used by sobelManual and prewittManual.

G = toGray(I);
[h, w] = size(G);
P = padImage(G, 1, 1, 'replicate');
gx = zeros(h, w);
gy = zeros(h, w);

for i = 1:h
    for j = 1:w
        window = P(i:i+2, j:j+2);
        gx(i,j) = sum(sum(window .* Kx));
        gy(i,j) = sum(sum(window .* Ky));
    end
end
mag = sqrt(gx.^2 + gy.^2);
end
