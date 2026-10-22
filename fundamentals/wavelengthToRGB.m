function rgb = wavelengthToRGB(lambda)
%WAVELENGTHTORGB Approximate display colour of monochromatic light.
%   rgb = wavelengthToRGB(lambda) for wavelengths in nanometres (n-by-1 or
%   1-by-n) returns n-by-3 RGB values in [0,1]. Outside the visible band
%   (about 380-780 nm) the result is black.
%
%   Piecewise-linear approximation of the spectral colours (after Dan
%   Bruton), with the intensity falling off at the edges of the visible
%   range where the eye is less sensitive.

L = double(lambda(:));
R = zeros(size(L)); G = R; B = R;
k = L >= 380 & L < 440; R(k) = -(L(k) - 440) / 60;  B(k) = 1;
k = L >= 440 & L < 490; G(k) = (L(k) - 440) / 50;   B(k) = 1;
k = L >= 490 & L < 510; G(k) = 1;                   B(k) = -(L(k) - 510) / 20;
k = L >= 510 & L < 580; R(k) = (L(k) - 510) / 70;   G(k) = 1;
k = L >= 580 & L < 645; R(k) = 1;                   G(k) = -(L(k) - 645) / 65;
k = L >= 645 & L <= 780; R(k) = 1;
f = zeros(size(L));                                 % eye sensitivity fall-off
k = L >= 380 & L < 420;  f(k) = 0.3 + 0.7 * (L(k) - 380) / 40;
k = L >= 420 & L <= 700; f(k) = 1;
k = L > 700 & L <= 780;  f(k) = 0.3 + 0.7 * (780 - L(k)) / 80;
rgb = [R G B] .* f;
rgb = rgb .^ 0.8;                                   % display gamma
end
