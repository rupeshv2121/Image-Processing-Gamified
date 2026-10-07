function value = calculateSSIM(A, ref)
%CALCULATESSIM Structural similarity index (Wang et al., 2004).
%   Compares local luminance, contrast and structure in an 11x11 Gaussian
%   window (sigma = 1.5):
%
%       SSIM = ((2 mu_x mu_y + C1)(2 sigma_xy + C2)) /
%              ((mu_x^2 + mu_y^2 + C1)(sigma_x^2 + sigma_y^2 + C2))
%
%   C1 = (0.01)^2, C2 = (0.03)^2 for [0,1] images. 1 = identical structure.
%   Colour images: the mean SSIM of the three channels.

A = toDouble(A);
ref = toDouble(ref);
if ~isequal(size(A), size(ref))
    error('ImageLab:sizeMismatch', 'Images must have the same size to be compared.');
end

if hasIPT() && ismatrix(A)
    value = ssim(A, ref);
    return
end

w = gaussianKernel(11, 1.5);
C1 = 0.01^2;
C2 = 0.03^2;
vals = zeros(1, size(A, 3));
for c = 1:size(A, 3)
    x = A(:,:,c);
    y = ref(:,:,c);
    muX = filter2D(x, w);
    muY = filter2D(y, w);
    sxx = filter2D(x.^2, w) - muX.^2;
    syy = filter2D(y.^2, w) - muY.^2;
    sxy = filter2D(x.*y, w) - muX.*muY;
    map = ((2*muX.*muY + C1) .* (2*sxy + C2)) ./ ...
          ((muX.^2 + muY.^2 + C1) .* (sxx + syy + C2));
    vals(c) = mean(map(:));
end
value = mean(vals);
end
