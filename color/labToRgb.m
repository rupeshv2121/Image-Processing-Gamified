function I = labToRgb(Lab)
%LABTORGB Inverse of rgbToLab (CIE L*a*b* D65 -> sRGB).

v = reshape(Lab, [], 3);
fy = (v(:,1) + 16) / 116;
fx = fy + v(:,2) / 500;
fz = fy - v(:,3) / 200;
f = [fx fy fz];
delta = 6/29;
t = 3 * delta^2 * (f - 4/29);
big = f > delta;
t(big) = f(big) .^ 3;
xyz = t .* [0.95047 1.00000 1.08883];

M = [0.4124564 0.3575761 0.1804375;
     0.2126729 0.7151522 0.0721750;
     0.0193339 0.1191920 0.9503041];
lin = xyz / M';
rgb = 12.92 * lin;
hi = lin > 0.0031308;
rgb(hi) = 1.055 * lin(hi) .^ (1/2.4) - 0.055;
I = min(max(reshape(rgb, size(Lab)), 0), 1);
end
