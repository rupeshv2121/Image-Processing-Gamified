function [counts, levels] = imhistManual(I)
%IMHISTMANUAL 256-bin grey-level histogram, computed manually (like imhist).
%   counts(k+1) = number of pixels with grey level k  (k = 0..255)
%   RGB images are converted to grayscale first.

G = toUint8(toGray(I));
counts = accumarray(double(G(:)) + 1, 1, [256 1]);
levels = (0:255)';
end
