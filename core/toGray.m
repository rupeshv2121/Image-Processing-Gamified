function G = toGray(I)
%TOGRAY Convert an RGB image to grayscale (double, [0,1]).
%   Uses the ITU-R BT.601 luminance weights, the same weights as rgb2gray:
%       Y = 0.2989 R + 0.5870 G + 0.1140 B
%   Grayscale input is returned unchanged (converted to double).

I = toDouble(I);
if size(I, 3) == 3
    G = 0.298936021293775 * I(:,:,1) + ...
        0.587043074451121 * I(:,:,2) + ...
        0.114020904255103 * I(:,:,3);
else
    G = I(:,:,1);
end
end
