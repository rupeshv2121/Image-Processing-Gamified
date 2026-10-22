function HSI = rgbToHsi(I)
%RGBTOHSI Convert RGB to the HSI (hue, saturation, intensity) colour model.
%   HSI = rgbToHsi(I) with all three channels in [0,1] (hue = angle / 360).
%
%   Gonzalez & Woods:
%       theta = acos( ((R-G) + (R-B)) / 2 / sqrt((R-G)^2 + (R-B)(G-B)) )
%       H = theta if B <= G, otherwise 360 - theta
%       S = 1 - 3 min(R,G,B) / (R + G + B)
%       I = (R + G + B) / 3
%   Unlike V = max(R,G,B) of HSV, the intensity is the plain average.

I = toDouble(I);
R = I(:,:,1); G = I(:,:,2); B = I(:,:,3);
num = 0.5 * ((R - G) + (R - B));
den = sqrt((R - G).^2 + (R - B) .* (G - B));
theta = acosd(min(max(num ./ max(den, eps), -1), 1));
H = theta;
H(B > G) = 360 - H(B > G);
H = H / 360;
S = 1 - 3 * min(min(R, G), B) ./ (R + G + B + eps);
In = (R + G + B) / 3;
H(S == 0) = 0;                       % grey: hue is undefined
HSI = cat(3, H, S, In);
end
