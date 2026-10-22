function I = hsiToRgb(HSI)
%HSITORGB Convert HSI (all channels in [0,1], hue = angle / 360) back to RGB.
%   The formula depends on the 120-degree sector the hue lies in:
%     RG sector (0-120):    B = I(1-S),  R = I(1 + S cos H / cos(60-H)),  G = 3I - (R+B)
%     GB sector (120-240):  H = H - 120, R = I(1-S),  G = ...,  B = 3I - (R+G)
%     BR sector (240-360):  H = H - 240, G = I(1-S),  B = ...,  R = 3I - (G+B)

H = 360 * HSI(:,:,1); S = HSI(:,:,2); In = HSI(:,:,3);
R = zeros(size(H)); G = R; B = R;

k = H < 120;                                    % RG sector
B(k) = In(k) .* (1 - S(k));
R(k) = In(k) .* (1 + S(k) .* cosd(H(k)) ./ cosd(60 - H(k)));
G(k) = 3 * In(k) - (R(k) + B(k));

k = H >= 120 & H < 240;                         % GB sector
h = H(k) - 120;
R(k) = In(k) .* (1 - S(k));
G(k) = In(k) .* (1 + S(k) .* cosd(h) ./ cosd(60 - h));
B(k) = 3 * In(k) - (R(k) + G(k));

k = H >= 240;                                   % BR sector
h = H(k) - 240;
G(k) = In(k) .* (1 - S(k));
B(k) = In(k) .* (1 + S(k) .* cosd(h) ./ cosd(60 - h));
R(k) = 3 * In(k) - (G(k) + B(k));

I = min(max(cat(3, R, G, B), 0), 1);
end
