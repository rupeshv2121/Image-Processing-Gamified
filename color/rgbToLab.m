function Lab = rgbToLab(I)
%RGBTOLAB sRGB -> CIE L*a*b* (D65 white point), like rgb2lab.
%   1. Undo the sRGB gamma (linearise).
%   2. Linear RGB -> XYZ (3x3 matrix).
%   3. XYZ -> Lab with the cube-root perceptual non-linearity.
%   L* = lightness 0..100, a* = green(-)..red(+), b* = blue(-)..yellow(+).
%   Lab is approximately perceptually uniform.

I = toDouble(I);
rgb = reshape(I, [], 3);
lin = rgb / 12.92;
hi = rgb > 0.04045;
lin(hi) = ((rgb(hi) + 0.055) / 1.055) .^ 2.4;

M = [0.4124564 0.3575761 0.1804375;
     0.2126729 0.7151522 0.0721750;
     0.0193339 0.1191920 0.9503041];
xyz = lin * M';
white = [0.95047 1.00000 1.08883];
t = xyz ./ white;

delta = 6/29;
f = t / (3 * delta^2) + 4/29;
big = t > delta^3;
f(big) = t(big) .^ (1/3);

L = 116 * f(:,2) - 16;
a = 500 * (f(:,1) - f(:,2));
b = 200 * (f(:,2) - f(:,3));
Lab = reshape([L a b], size(I));
end
