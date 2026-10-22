function [a, rebuilt, invariant] = fourierDescriptors(boundary, P)
%FOURIERDESCRIPTORS Fourier descriptors of a closed boundary.
%   [a, rebuilt, invariant] = fourierDescriptors(boundary, P)
%   boundary  - n-by-2 [row col] points in tracing order
%   a         - the n complex descriptors a(u) = DFT of s(k) = x(k) + j y(k)
%   rebuilt   - n-by-2 [row col] boundary rebuilt from only the P
%               lowest-frequency descriptors (default P = n: exact)
%   invariant - |a(u)| / |a(1)| for u = 2..11: invariant to translation
%               (a(0) dropped), rotation and start point (magnitude only)
%               and scale (divided by |a(1)|)
%
%   The boundary is treated as a 1-D complex signal and described by its
%   DFT. Low frequencies carry the overall shape, high frequencies the
%   fine detail - a few descriptors already rebuild a recognisable shape.
%   This transforms a list of boundary points, not the image.

n = size(boundary, 1);
if nargin < 2 || isempty(P), P = n; end
P = max(1, min(n, round(P)));
s = boundary(:, 2) + 1i * boundary(:, 1);           % x + j y
a = fft(s);
% keep the P coefficients of lowest |frequency|: u = 0, 1, -1, 2, -2, ...
u = [0:ceil(n / 2) - 1, -floor(n / 2):-1]';
[~, order] = sort(abs(u) - 0.1 * (u > 0));           % 0, 1, -1, 2, -2, ...
keepA = zeros(n, 1);
keepA(order(1:P)) = a(order(1:P));
z = ifft(keepA);
rebuilt = [imag(z), real(z)];
mags = abs(a(2:min(n, 11)));
invariant = (mags / max(abs(a(2)), eps))';
end
